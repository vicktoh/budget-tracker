"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Script from "next/script";
import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2Icon, RotateCcwIcon, SparklesIcon, XCircleIcon } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AssistantChartCard } from "@/components/assistant/chart-card";
import { useAsk } from "@/components/public/ask-context";
import { AskTableCard } from "@/components/public/ask-table";
import type { PublicAssistantUIMessage } from "@/lib/public/assistant";
import type { AssistantTableInput } from "@/lib/public/assistant-table";
import type { AssistantChartInput } from "@/lib/assistant/tools";

/** IBP categorical order for Ask AI charts (validated: adjacent CVD ΔE ≥ 16, normal ΔE ≥ 26). */
const ASK_CHART_COLORS = ["#00879B", "#FF7A2E", "#14B0C8", "#E14242", "#7A5CC7"] as const;

const SUGGESTIONS = [
  "How much has Kano spent on health so far this year, and what share of the budget is that?",
  "Which health MDAs have spent the smallest share of their budget? Show a chart.",
  "Compare health spending at mid-year from 2023 to 2026.",
  "What capital projects does the Primary Health Care Board have, and how far along is spending?",
  "Nawa aka kashe a fannin lafiya a Kano zuwa yanzu a wannan shekara?",
];

const TOOL_LABEL: Record<string, string> = {
  "tool-listPeriods": "available reports",
  "tool-getHealthSummary": "health sector totals",
  "tool-getBreakdown": "the breakdown",
  "tool-compareYears": "earlier years",
  "tool-findEntity": "names",
  "tool-getValue": "the figures",
  "tool-getPrimaryHealthCare": "primary health care",
  "tool-getHealthProgrammes": "health programmes",
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      getResponse: (id?: string) => string | undefined;
    };
  }
}

/**
 * Answers cite sources in plain text. As a safety net, drop any external link
 * or bare web address the model still writes; site-relative links stay.
 */
export function stripExternalLinks(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((?:https?:)?\/\/[^)\s]+\)/g, "$1")
    .replace(/<?https?:\/\/[^\s)>]+>?/g, "")
    .replace(/\(\s*\)/g, "");
}

/** Drop "[Table: …]" / "(rendered chart)" stand-ins; the card itself is drawn beside the text. */
export function stripVisualPlaceholders(text: string): string {
  return text
    .replace(/^[ \t]*[\[(](?:table|chart)(?:\s*:|\s+(?:below|above))[^\])\n]*[\])][ \t]*$\n?/gim, "")
    .replace(/[ \t]*\((?:rendered|see) (?:the )?(?:table|chart)( below| above)?\)/gi, "");
}

/**
 * House style: no em dashes. The model is told not to write them; any that
 * slip through become commas, or "n/a" in an empty table cell.
 */
export function replaceEmDashes(text: string): string {
  return text
    .replace(/(\|)[ \t]*\u2014[ \t]*(?=\|)/g, "$1 n/a ")
    .replace(/[ \t]*\u2014[ \t]*/g, ", ")
    .replace(/, ([.,;:!?)])/g, "$1")
    .replace(/\(, /g, "(")
    .replace(/^, /gm, "");
}

type Visual = "table" | "chart";
export type AnswerSegment = { text: string } | { visual: Visual; index: number };

/**
 * Split answer text at the [[table]] / [[chart]] markers the model writes
 * where each card belongs. `counters` runs across a message's text parts so
 * the n-th [[table]] marker takes the n-th renderTable call.
 */
export function splitAnswer(text: string, counters: Record<Visual, number>): AnswerSegment[] {
  // A marker still streaming in ("[[tab") stays hidden until it is complete.
  const complete = text.replace(/\[\[[a-z]*\]?$/i, "");
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of complete.matchAll(/\[\[(table|chart)\]\]/gi)) {
    const visual = match[1].toLowerCase() as Visual;
    segments.push({ text: complete.slice(last, match.index) });
    segments.push({ visual, index: counters[visual]++ });
    last = (match.index ?? 0) + match[0].length;
  }
  segments.push({ text: complete.slice(last) });
  return segments.filter((seg) => !("text" in seg) || seg.text.trim() !== "");
}

function describeError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed?.error === "string") return parsed.error;
  } catch {
    // not JSON
  }
  return "The assistant is unavailable right now. Please try again later.";
}

export function AskView({ variant = "page" }: { variant?: "page" | "panel" }) {
  const { pending, takePending } = useAsk();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat<PublicAssistantUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/public/chat",
      headers: (): Record<string, string> => {
        const token = widgetId.current ? window.turnstile?.getResponse(widgetId.current) : undefined;
        return token ? { "x-turnstile-token": token } : {};
      },
    }),
    throttle: 80,
    onFinish: () => {
      // Turnstile tokens are single-use: fetch a fresh one for the next question.
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  });

  function renderTurnstile() {
    if (!siteKey || !widget.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(widget.current, { sitekey: siteKey, size: "flexible", appearance: "interaction-only" });
  }
  useEffect(renderTurnstile);

  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
  };

  // Questions sent from the hero box or an "Ask about this" button.
  useEffect(() => {
    if (!pending || busy) return;
    const q = takePending();
    if (q) void sendMessage({ text: q });
  }, [pending, busy, takePending, sendMessage]);
  const last = messages.at(-1);
  const thinking = status === "submitted" || (status === "streaming" && last?.role !== "assistant");

  return (
    <div className={variant === "panel" ? "flex h-full flex-col gap-3" : "flex flex-col gap-4"}>
      {siteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderTurnstile} />
      ) : null}
      <Conversation className={variant === "panel" ? "min-h-0 flex-1 rounded-2xl border border-[var(--pub-line)] bg-white" : "min-h-[24rem] rounded-2xl border border-[var(--pub-line)] bg-white"}>
        <ConversationContent className={variant === "panel" ? "gap-5 px-3 py-4" : "mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:px-6"}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-start gap-4 py-4">
              <p className="text-sm text-[var(--pub-ink-2)]">Try one of these, or ask your own question in English or Hausa:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--pub-line)] bg-[var(--pub-canvas)] px-3.5 py-2 text-left text-sm text-[var(--pub-ink)] transition hover:border-[var(--pub-brand)] hover:bg-[var(--pub-brand-soft)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "assistant" ? (
                <Message className="max-w-full" from="assistant" key={m.id}>
                  <div className="flex w-full gap-3">
                    <Avatar />
                    <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5 text-[15px] leading-relaxed">
                      <AssistantParts message={m} />
                    </div>
                  </div>
                </Message>
              ) : (
                <Message from="user" key={m.id}>
                  <MessageContent className="group-[.is-user]:rounded-xl group-[.is-user]:rounded-br-sm group-[.is-user]:bg-[var(--pub-brand-deep)] group-[.is-user]:text-white">
                    {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
                  </MessageContent>
                </Message>
              ),
            )
          )}
          {thinking ? (
            <div className="flex gap-3">
              <Avatar />
              <Shimmer className="pt-1 text-sm">Reading the reports…</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="space-y-2">
        {error ? (
          <p className="text-sm text-[#9a3412]" role="alert">
            {describeError(error)}
          </p>
        ) : null}
        <PromptInput onSubmit={(m: PromptInputMessage) => send(m.text)}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about Kano's health budget… (English or Hausa)" maxLength={1500} />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {messages.length ? (
                <button
                  type="button"
                  onClick={() => {
                    stop();
                    setMessages([]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--pub-muted)] hover:text-[var(--pub-ink)]"
                >
                  <RotateCcwIcon className="size-3.5" /> New conversation
                </button>
              ) : null}
            </PromptInputTools>
            <PromptInputSubmit onStop={stop} status={status} />
          </PromptInputFooter>
        </PromptInput>
        <div ref={widget} />
        <p className={variant === "panel" ? "text-[11px] leading-snug text-[var(--pub-muted)]" : "text-xs leading-relaxed text-[var(--pub-muted)]"}>
          Answers are generated by AI from the published figures and can contain mistakes. Each answer names the report and page it
          relies on. Questions are logged anonymously (no names, no IP addresses) to improve the service.
        </p>
      </div>
    </div>
  );
}

/** Titles and captions the model writes for tables and charts follow the same house style. */
function tidySpec<T extends { title: string; description?: string }>(spec: T): T {
  return { ...spec, title: replaceEmDashes(spec.title), ...(spec.description ? { description: replaceEmDashes(spec.description) } : {}) };
}

function AssistantParts({ message }: { message: PublicAssistantUIMessage }) {
  // Tables and charts in the order the model drew them.
  const visuals: Record<Visual, ReactNode[]> = { table: [], chart: [] };
  const natural = new Map<number, { visual: Visual; index: number }>();
  message.parts.forEach((part, i) => {
    const key = `${message.id}-${i}`;
    if (part.type === "tool-renderTable") {
      const ready = part.state === "input-available" || part.state === "output-available";
      natural.set(i, { visual: "table", index: visuals.table.length });
      visuals.table.push(
        ready ? <AskTableCard key={key} spec={tidySpec(part.input as AssistantTableInput)} /> : <Shimmer key={key} className="text-sm">Building a table…</Shimmer>,
      );
    } else if (part.type === "tool-renderChart") {
      const ready = part.state === "input-available" || part.state === "output-available";
      natural.set(i, { visual: "chart", index: visuals.chart.length });
      visuals.chart.push(
        ready ? (
          <AssistantChartCard key={key} spec={tidySpec(part.input as AssistantChartInput)} colors={ASK_CHART_COLORS} />
        ) : (
          <Shimmer key={key} className="text-sm">Drawing a chart…</Shimmer>
        ),
      );
    }
  });

  // Where the text places them; the rest stay where they were drawn.
  const counters: Record<Visual, number> = { table: 0, chart: 0 };
  const segments = new Map<number, AnswerSegment[]>();
  message.parts.forEach((part, i) => {
    if (part.type === "text") segments.set(i, splitAnswer(part.text, counters));
  });

  const checked = new Set<string>();
  return message.parts.map((part, i) => {
    const key = `${message.id}-${i}`;
    if (part.type === "text") {
      return (segments.get(i) ?? []).map((seg, j) =>
        "text" in seg ? (
          <MessageResponse key={`${key}-${j}`}>{replaceEmDashes(stripVisualPlaceholders(stripExternalLinks(seg.text)))}</MessageResponse>
        ) : (
          (visuals[seg.visual][seg.index] ?? null)
        ),
      );
    }
    const drawn = natural.get(i);
    if (drawn) return drawn.index < counters[drawn.visual] ? null : visuals[drawn.visual][drawn.index];
    if (part.type.startsWith("tool-") && "state" in part) {
      const label = TOOL_LABEL[part.type] ?? "the data";
      if (part.state === "output-available") {
        if (checked.has(label)) return null;
        checked.add(label);
        return (
          <p key={key} className="flex items-center gap-1.5 text-xs text-[var(--pub-muted)]">
            <CheckCircle2Icon className="size-3.5 text-[var(--pub-brand)]" /> Checked {label}
          </p>
        );
      }
      if (part.state === "output-error") {
        return (
          <p key={key} className="flex items-center gap-1.5 text-xs text-[var(--pub-muted)]">
            <XCircleIcon className="size-3.5" /> Could not read {label}
          </p>
        );
      }
      return <Shimmer key={key} className="text-xs">{`Reading ${label}…`}</Shimmer>;
    }
    return null;
  });
}

function Avatar() {
  return (
    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--pub-brand-soft)] text-[var(--pub-brand-deep)]">
      <SparklesIcon className="size-3.5" />
    </div>
  );
}
