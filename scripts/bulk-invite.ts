/**
 * Bulk-provision users from a Google Form CSV export and email each one an
 * invite to set their password. Mirrors POST /api/admin/users (no explicit
 * password): auth user + profile + MDA grants + audit event + invite email.
 *
 * Health MDA staff become MDA users with the ledger grants they ticked.
 * Staff of the oversight agencies in OVERSIGHT_AGENCIES (Finance, Budget and
 * Planning, etc.) become Viewers (role "reviewer"): statewide read and comment
 * access, no entry. They are not MDAs and must not be added to the mdas table.
 *
 *   npx tsx scripts/bulk-invite.ts --list-mdas
 *   npx tsx scripts/bulk-invite.ts responses.csv --actor admin@example.gov.ng
 *   npx tsx scripts/bulk-invite.ts responses.csv --actor admin@example.gov.ng --send
 *
 * Without --send it is a dry run: nothing is created and no email is sent.
 * Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * RESEND_API_KEY, EMAIL_FROM), so it targets whichever database that file
 * points at.
 *
 * Expected form questions (header matching is case-insensitive, by keyword):
 *   - "Full name"                      -> header containing "name"
 *   - "Email"                          -> header containing "email"
 *   - "MDA or agency" (dropdown)       -> header containing "mda"
 *   - "Access needed" (checkboxes:     -> header containing "access"
 *     "Funding entry", "Expenditure entry"; ignored for oversight agencies.
 *     Without this column, pass --default-access funding,expenditure)
 * MDA answers match an active MDA's name, abbreviation, code or
 * "ABBR — Name" label, or an OVERSIGHT_AGENCIES entry. Use --list-mdas to get
 * the dropdown options.
 *
 * Writes <input>.results.csv with one row per person. For any invite that
 * could not be emailed it contains the one-time set-password link; treat that
 * file as sensitive and delete it after onboarding.
 */
import fs from "node:fs";
import path from "node:path";

process.loadEnvFile(path.join(__dirname, "..", ".env.local"));

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/server/auth";
import { replaceUserScope } from "@/lib/server/admin-users";
import { sendAccountActionLink, type InviteDelivery } from "@/lib/server/invites";
import { buildMembershipRows, validateUserAccess } from "@/lib/admin/user-access";
import { formatMdaLabel } from "@/lib/admin/users";

const DEFAULT_ORIGIN = "https://kano-budget-tracker.app";
// Resend allows ~2 requests/second by default; stay well under it.
const SEND_INTERVAL_MS = 700;

// Non-health PFM bodies whose staff get Viewer accounts. The form dropdown
// must offer these exact names (matching ignores case and spacing).
const OVERSIGHT_AGENCIES = [
  "Ministry of Finance",
  "Ministry of Planning and Budget",
  "Office of the Accountant-General",
  "Office of the Auditor-General",
  "Kano State House of Assembly",
];

type Mda = { id: string; code: string; name: string; abbreviation: string | null };

type Planned = {
  line: number;
  full_name: string;
  email: string;
  mda_answer: string;
  access_answer: string;
  mda: Mda | null;
  /** Set instead of `mda` for oversight-agency staff, who become Viewers. */
  agency: string | null;
  role: "mda_user" | "reviewer";
  funding: boolean;
  expenditure: boolean;
  problem: string | null;
};

type Result = Planned & {
  status: "created" | "skipped" | "failed" | "would_create";
  user_id?: string;
  invite?: InviteDelivery | null;
  error?: string;
};

function parseArgs(argv: string[]) {
  const args = { file: null as string | null, send: false, listMdas: false, actor: null as string | null, origin: null as string | null, defaultAccess: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--send") args.send = true;
    else if (arg === "--list-mdas") args.listMdas = true;
    else if (arg === "--actor") args.actor = argv[++i] ?? null;
    else if (arg === "--origin") args.origin = argv[++i] ?? null;
    else if (arg === "--default-access") args.defaultAccess = argv[++i] ?? null;
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else args.file = arg;
  }
  return args;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    )
    .join("\n");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[–—-]/g, "-").replace(/\s+/g, " ").trim();
}

function findColumn(headers: string[], keyword: string, exclude: string[] = []) {
  const index = headers.findIndex((h) => {
    const header = h.toLowerCase();
    return header.includes(keyword) && !exclude.some((word) => header.includes(word));
  });
  if (index === -1) {
    throw new Error(`No column header containing "${keyword}". Headers: ${headers.join(" | ")}`);
  }
  return index;
}

async function loadActiveMdas(client: SupabaseClient): Promise<Mda[]> {
  const { data, error } = await client
    .from("mdas")
    .select("id, code, name, abbreviation")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export function buildMdaLookup(mdas: Mda[]) {
  const lookup = new Map<string, Mda>();
  for (const mda of mdas) {
    for (const key of [mda.name, mda.code, mda.abbreviation, formatMdaLabel(mda.name, mda.abbreviation)]) {
      if (key) lookup.set(normalize(key), mda);
    }
  }
  return lookup;
}

async function listAuthEmails(client: SupabaseClient) {
  const emails = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users) if (user.email) emails.add(user.email.toLowerCase());
    if (data.users.length < 200) break;
  }
  return emails;
}

async function resolveActor(client: SupabaseClient, email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "admin") throw new Error(`--actor ${email} is not an admin.`);
      return user.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`--actor ${email} has no account.`);
}

const agencyLookup = new Map(OVERSIGHT_AGENCIES.map((name) => [normalize(name), name]));

export function plan(
  rows: string[][],
  mdaLookup: Map<string, Mda>,
  existingEmails: Set<string>,
  defaultAccess: string | null = null,
): Planned[] {
  const [headers, ...body] = rows;
  // "Name of your MDA" or "Email (user name)" must not be taken as the name.
  const nameCol = findColumn(headers, "name", ["email", "mda"]);
  const emailCol = findColumn(headers, "email");
  const mdaCol = findColumn(headers, "mda");
  // A form without an access question needs --default-access for MDA staff.
  const accessCol = headers.some((h) => h.toLowerCase().includes("access"))
    ? findColumn(headers, "access")
    : null;
  if (accessCol === null && defaultAccess === null) {
    throw new Error('No "access" column; pass --default-access funding,expenditure (or one of them).');
  }

  // Later submissions from the same email replace earlier ones.
  const byEmail = new Map<string, Planned>();
  body.forEach((row, i) => {
    const email = (row[emailCol] ?? "").trim().toLowerCase();
    const accessAnswer = accessCol === null ? defaultAccess! : (row[accessCol] ?? "").trim();
    const access = accessAnswer.toLowerCase();
    const both = /\bboth\b/.test(access);
    const mda = mdaLookup.get(normalize(row[mdaCol] ?? "")) ?? null;
    const agency = mda ? null : agencyLookup.get(normalize(row[mdaCol] ?? "")) ?? null;
    const entry: Planned = {
      line: i + 2,
      full_name: (row[nameCol] ?? "").trim().replace(/\s+/g, " "),
      email,
      mda_answer: (row[mdaCol] ?? "").trim(),
      access_answer: accessAnswer,
      mda,
      agency,
      role: agency ? "reviewer" : "mda_user",
      funding: !agency && (both || access.includes("fund")),
      expenditure: !agency && (both || access.includes("expend")),
      problem: null,
    };

    if (!entry.full_name) entry.problem = "missing name";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) entry.problem = "invalid email";
    else if (!entry.mda && !entry.agency) entry.problem = `unknown MDA or agency "${entry.mda_answer}"`;
    else if (existingEmails.has(email)) entry.problem = "already has an account (use Resend invite in Users)";
    else if (entry.mda) {
      entry.problem = validateUserAccess("mda_user", {
        mda_id: null,
        facility_ids: [],
        funding_mda_ids: entry.funding ? [entry.mda!.id] : [],
        expenditure_mda_ids: entry.expenditure ? [entry.mda!.id] : [],
      });
    }

    const previous = byEmail.get(email);
    if (previous && email) {
      console.log(`  note: line ${previous.line} superseded by line ${entry.line} (${email})`);
    }
    byEmail.set(email || `__line_${entry.line}`, entry);
  });

  return [...byEmail.values()];
}

async function provision(
  client: SupabaseClient,
  entry: Planned,
  actorId: string | null,
  origin: string,
): Promise<Result> {
  const access = {
    funding_mda_ids: entry.funding && entry.mda ? [entry.mda.id] : [],
    expenditure_mda_ids: entry.expenditure && entry.mda ? [entry.mda.id] : [],
  };

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email: entry.email,
    password: `${crypto.randomUUID()}${crypto.randomUUID().toUpperCase()}`,
    email_confirm: true,
    user_metadata: entry.agency
      ? { full_name: entry.full_name, organisation: entry.agency }
      : { full_name: entry.full_name },
  });
  if (createError || !created?.user) {
    return { ...entry, status: "failed", error: createError?.message ?? "Failed to create auth user." };
  }
  const userId = created.user.id;
  const rollback = async (error: string): Promise<Result> => {
    await client.auth.admin.deleteUser(userId).catch(() => undefined);
    return { ...entry, status: "failed", error };
  };

  const { error: profileError } = await client
    .from("profiles")
    .insert({ id: userId, full_name: entry.full_name, role: entry.role });
  if (profileError) return rollback(profileError.message);

  const scopeError = await replaceUserScope(client, userId, entry.role, {
    mda_id: null,
    facility_ids: [],
    membershipRows: buildMembershipRows(userId, entry.role, access),
  });
  if (scopeError) return rollback(scopeError.message);

  await client
    .from("entry_audit_events")
    .insert({
      entity_type: "profile",
      entity_id: userId,
      entity_key: entry.email,
      event_type: "user_created",
      new_values: {
        role: entry.role,
        full_name: entry.full_name,
        facility_ids: [],
        mda_id: null,
        ...access,
        ...(entry.agency ? { organisation: entry.agency } : {}),
        source: "bulk-invite",
      },
      actor_id: actorId,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  let invite: InviteDelivery;
  try {
    invite = await sendAccountActionLink({
      serviceClient: client,
      email: entry.email,
      fullName: entry.full_name,
      origin,
      kind: "invite",
    });
  } catch (error) {
    invite = {
      email_sent: false,
      email_error: error instanceof Error ? error.message : "Failed to send the invite email.",
    };
  }

  return { ...entry, status: "created", user_id: userId, invite };
}

function accessLabel(entry: Planned) {
  if (entry.role === "reviewer") return "viewer";
  return [entry.funding && "funding", entry.expenditure && "expenditure"].filter(Boolean).join("+") || "-";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = createServiceClient();
  const mdas = await loadActiveMdas(client);

  if (args.listMdas) {
    console.log("Paste these as the dropdown options in the Google Form:\n");
    for (const mda of mdas) console.log(mda.name);
    for (const agency of OVERSIGHT_AGENCIES) console.log(agency);
    return;
  }
  if (!args.file) throw new Error("Pass the Google Form CSV export path, or --list-mdas.");

  const origin = (args.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_ORIGIN).replace(/\/$/, "");
  const actorId = args.actor ? await resolveActor(client, args.actor) : null;
  if (args.send && !actorId) {
    throw new Error("--send requires --actor <your admin email> so the audit log records who created the users.");
  }
  if (args.send && !process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set in .env.local; invites could not be emailed.");
  }

  const rows = parseCsv(fs.readFileSync(args.file, "utf8"));
  if (rows.length < 2) throw new Error("The CSV has no responses.");

  console.log(`Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`Invite links: ${origin}/auth/accept-invite`);
  console.log(`Mode: ${args.send ? "SEND (creating users and emailing invites)" : "dry run"}\n`);

  const planned = plan(rows, buildMdaLookup(mdas), await listAuthEmails(client), args.defaultAccess);
  const results: Result[] = [];

  for (const entry of planned) {
    const label = `line ${entry.line}  ${entry.email || "(no email)"}  ${entry.mda?.abbreviation ?? entry.mda?.name ?? entry.agency ?? entry.mda_answer}  ${accessLabel(entry)}`;
    if (entry.problem) {
      console.log(`  SKIP  ${label}  — ${entry.problem}`);
      results.push({ ...entry, status: "skipped", error: entry.problem });
      continue;
    }
    if (!args.send) {
      console.log(`  OK    ${label}`);
      results.push({ ...entry, status: "would_create" });
      continue;
    }

    const result = await provision(client, entry, actorId, origin);
    results.push(result);
    if (result.status === "failed") {
      console.log(`  FAIL  ${label}  — ${result.error}`);
    } else if (result.invite?.email_sent) {
      console.log(`  SENT  ${label}`);
    } else {
      console.log(`  MAKE  ${label}  — created, email failed (${result.invite?.email_error}); link in results file`);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
  }

  const resultsPath = args.file.replace(/\.csv$/i, "") + ".results.csv";
  fs.writeFileSync(
    resultsPath,
    toCsv([
      ["line", "full_name", "email", "mda", "access", "status", "email_sent", "error", "user_id", "action_link"],
      ...results.map((r) => [
        String(r.line),
        r.full_name,
        r.email,
        r.mda?.name ?? r.agency ?? r.mda_answer,
        accessLabel(r),
        r.status,
        r.invite ? String(r.invite.email_sent) : "",
        r.error ?? r.invite?.email_error ?? "",
        r.user_id ?? "",
        r.invite?.action_link ?? "",
      ]),
    ]) + "\n",
  );

  const count = (status: Result["status"]) => results.filter((r) => r.status === status).length;
  const unsent = results.filter((r) => r.status === "created" && !r.invite?.email_sent).length;
  console.log(
    `\n${args.send ? `${count("created")} created (${unsent} without email), ${count("failed")} failed` : `${count("would_create")} ready`}, ${count("skipped")} skipped.`,
  );
  console.log(`Results: ${resultsPath}`);
  if (!args.send && count("would_create") > 0) console.log("Re-run with --actor <admin email> --send to create them.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
