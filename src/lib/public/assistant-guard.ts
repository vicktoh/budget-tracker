import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/server/auth";

/**
 * Guardrails for the anonymous public assistant:
 * - per-visitor rate limit (messages per hour) and conversation length cap;
 * - a hard monthly spend cap: when reached, the assistant says it is busy and
 *   the rest of the site keeps working;
 * - optional Cloudflare Turnstile check (when TURNSTILE_SECRET_KEY is set);
 * - an anonymous log: a salted hash of the visitor, never the IP itself.
 */

export const MESSAGES_PER_HOUR = Number(process.env.PUBLIC_ASSISTANT_MESSAGES_PER_HOUR ?? 20);
export const MAX_USER_TURNS = Number(process.env.PUBLIC_ASSISTANT_MAX_TURNS ?? 6);
export const MONTHLY_CAP_USD = Number(process.env.PUBLIC_ASSISTANT_MONTHLY_CAP_USD ?? 100);
// USD per million tokens; defaults are gpt-5-mini list prices.
const PRICE_IN = Number(process.env.PUBLIC_ASSISTANT_PRICE_IN_PER_M ?? 0.25);
const PRICE_OUT = Number(process.env.PUBLIC_ASSISTANT_PRICE_OUT_PER_M ?? 2);

export function visitorHash(request: Request): string {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  // Salted so the hash cannot be reversed by trying IPs; rotates monthly.
  const salt = `${process.env.PUBLIC_ASSISTANT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "kano"}:${new Date().toISOString().slice(0, 7)}`;
  return createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

export function costUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000;
}

export type GuardResult = { ok: true } | { ok: false; status: number; reason: "rate_limited" | "budget_exhausted" | "rejected"; message: string };

export async function checkGuards(visitor: string): Promise<GuardResult> {
  const db = createServiceClient();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await db
    .from("public_assistant_log")
    .select("id", { count: "exact", head: true })
    .eq("visitor_hash", visitor)
    .gte("created_at", hourAgo);
  if (error) throw error;
  if ((count ?? 0) >= MESSAGES_PER_HOUR) {
    return { ok: false, status: 429, reason: "rate_limited", message: "You have asked a lot of questions in the last hour. Please try again a little later." };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  let spent = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error: costError } = await db
      .from("public_assistant_log")
      .select("cost_usd")
      .gte("created_at", monthStart.toISOString())
      .gt("cost_usd", 0)
      .range(from, from + 999);
    if (costError) throw costError;
    spent += (data ?? []).reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0);
    if (!data || data.length < 1000) break;
  }
  if (spent >= MONTHLY_CAP_USD) {
    return { ok: false, status: 503, reason: "budget_exhausted", message: "The assistant is busy right now. Please try again later. The charts and figures on the rest of the site are all available." };
  }
  return { ok: true };
}

export async function verifyTurnstile(token: string | null, request: Request): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured: rate limit + cap still apply
  if (!token) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean };
  return Boolean(json.success);
}

export async function logExchange(entry: {
  visitor: string;
  conversationId: string;
  question: string;
  answer?: string | null;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  status: "ok" | "rate_limited" | "budget_exhausted" | "error" | "rejected";
}) {
  // Local development talks to the production database: keep test chats out of the log.
  if (process.env.NODE_ENV !== "production" && process.env.PUBLIC_ASSISTANT_LOG_IN_DEV !== "1") return;
  const db = createServiceClient();
  const { error } = await db.from("public_assistant_log").insert({
    visitor_hash: entry.visitor,
    conversation_id: entry.conversationId.slice(0, 80),
    question: entry.question.slice(0, 4000),
    answer: entry.answer?.slice(0, 20000) ?? null,
    model: entry.model ?? null,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    cost_usd: costUsd(entry.inputTokens ?? 0, entry.outputTokens ?? 0),
    status: entry.status,
  });
  if (error) console.error("public assistant log failed:", error.message);
}
