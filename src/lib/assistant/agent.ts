import { ToolLoopAgent, isStepCount, type InferAgentUIMessage } from "ai";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { AppProfile } from "@/lib/auth-types";
import { getRoleLabel } from "@/lib/access";
import { createAssistantTools } from "@/lib/assistant/tools";
import { SCHEMA_REFERENCE } from "@/lib/assistant/schema-reference";

function describeUser(profile: AppProfile): string {
  const lines = [
    `Name: ${profile.full_name ?? "Unknown"}`,
    `Role: ${getRoleLabel(profile.role)} (${profile.role})`,
  ];

  if (profile.role === "admin" || profile.role === "reviewer") {
    lines.push("Data scope: all MDAs statewide.");
  }

  if (profile.memberships.length > 0) {
    const memberships = profile.memberships
      .map(
        (m) =>
          `${m.mdas?.name ?? m.mda_id} (${m.membership_role.replace("_", " ")})`,
      )
      .join("; ");
    lines.push(`MDA memberships: ${memberships}`);
  }

  if (profile.facilityAssignments.length > 0) {
    const assignments = profile.facilityAssignments
      .map(
        (a) =>
          `${a.facilities?.name ?? a.facility_id} under ${a.mdas?.name ?? a.mda_id}`,
      )
      .join("; ");
    lines.push(`Facility assignments: ${assignments}`);
  }

  return lines.join("\n");
}

function buildInstructions(profile: AppProfile): string {
  const today = new Date().toISOString().slice(0, 10);

  return `You are the built-in data assistant for the Kano State Health Accountability Tracker, a public-finance system that records health-sector funding and expenditure for Kano State, Nigeria.

Today's date: ${today}. All monetary amounts are Nigerian Naira (NGN). Format amounts with thousand separators and the ₦ symbol (e.g. ₦1,234,567.89).

## Current user
${describeUser(profile)}

## How you access data
You answer questions by querying the live database with the queryDatabase tool. Every query runs with the current user's own credentials, and Postgres row-level security limits results to what this user is allowed to see — you can never leak other users' data, so query freely. If a result comes back empty, it may mean either no data exists or the user lacks access to it; say so neutrally instead of guessing.

## Query guidance
- Prefer the reporting views (mda_budget_vs_actual, funding_by_source, expenditure_by_category, expenditure_by_funding_source, programme_area_summary, phc_lga_expenditure_summary, phc_facility_expenditure_summary, aop_planned_vs_actual, unlinked_expenditure) for totals and summaries — they are pre-aggregated.
- For custom aggregates over raw tables, use PostgREST aggregate select syntax, e.g. select "amount.sum()" or "mda_id,total_amount.sum()". If an aggregate query fails, fall back to fetching rows and computing yourself.
- Resolve human names to ids first (e.g. look up an MDA in mdas by name with ilike) before filtering ledger tables.
- Use countOnly for "how many" questions.
- Keep limits modest and paginate with offset when you genuinely need more rows.
- Never fabricate numbers. Every figure you present must come from a query result in this conversation. If you cannot find the data, say so.

## Answer style
- Lead with the answer, then show supporting figures.
- Use markdown tables for multi-row comparisons.
- Mention the fiscal year/quarter a figure belongs to whenever relevant.
- Amounts in monthly_expenditure_tracking: a row with amount 0 means the MDA reported zero; a missing row means nothing was reported. Never treat the two as the same thing.
- This is a read-only assistant: you cannot create, modify, approve, or publish anything. If asked to change data, point the user to the relevant screen instead.

## Database schema
${SCHEMA_REFERENCE}`;
}

export function createAssistantAgent(options: {
  supabase: TypedSupabaseClient;
  profile: AppProfile;
}) {
  return new ToolLoopAgent({
    model: "anthropic/claude-sonnet-5",
    instructions: buildInstructions(options.profile),
    tools: createAssistantTools(options.supabase),
    stopWhen: isStepCount(15),
  });
}

export type AssistantUIMessage = InferAgentUIMessage<
  ReturnType<typeof createAssistantAgent>
>;
