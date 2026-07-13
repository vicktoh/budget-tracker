import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TableInsert } from "@/lib/db/types";
import type { ReportTemplateId } from "@/lib/reporting/report-templates";

export type ReportNarrative = {
  sectionKey: string;
  body: string;
  editedBy: string | null;
  updatedAt: string;
};

type NarrativeRow = Tables<"report_narratives">;
type NarrativeInsert = TableInsert<"report_narratives">;

// supabase-js's generic `from()` resolves this hand-authored table to `never`,
// so we cast to a minimal query interface and keep the result strongly typed
// via `Tables<>` (same pragmatic approach as `asRpc` in db/review.ts).
type NarrativeResult = Promise<{
  data: NarrativeRow[] | null;
  error: { message: string } | null;
}>;
type NarrativeFilter = NarrativeResult & {
  eq: (column: string, value: unknown) => NarrativeFilter;
  is: (column: string, value: null) => NarrativeFilter;
};
type NarrativeQuery = {
  select: (columns: string) => NarrativeFilter;
  upsert: (
    values: NarrativeInsert,
    options: { onConflict: string },
  ) => Promise<{ error: { message: string } | null }>;
};

function narrativeTable(client: TypedSupabaseClient): NarrativeQuery {
  return client.from("report_narratives") as unknown as NarrativeQuery;
}

/** Saved narrative overrides for a template+period, keyed by section. */
export async function loadReportNarratives(
  client: TypedSupabaseClient,
  template: ReportTemplateId,
  fiscalYear: number,
  quarter: number | null,
): Promise<Record<string, ReportNarrative>> {
  let query = narrativeTable(client)
    .select("*")
    .eq("template", template)
    .eq("fiscal_year", fiscalYear);
  query = quarter === null ? query.is("quarter", null) : query.eq("quarter", quarter);

  const result = await query;
  if (result.error) throw new Error(result.error.message);

  const map: Record<string, ReportNarrative> = {};
  for (const row of result.data ?? []) {
    map[row.section_key] = {
      sectionKey: row.section_key,
      body: row.body,
      editedBy: row.edited_by,
      updatedAt: row.updated_at,
    };
  }
  return map;
}

/**
 * Insert or update a single narrative override. Stamps the current user as
 * `edited_by`. Relies on the `(template, fiscal_year, quarter, section_key)`
 * unique constraint for the upsert conflict target.
 */
export async function upsertReportNarrative(
  client: TypedSupabaseClient,
  input: {
    template: ReportTemplateId;
    fiscalYear: number;
    quarter: number | null;
    sectionKey: string;
    body: string;
  },
): Promise<void> {
  const { data: userData } = await client.auth.getUser();
  const editedBy = userData.user?.id ?? null;

  const result = await narrativeTable(client).upsert(
    {
      template: input.template,
      fiscal_year: input.fiscalYear,
      quarter: input.quarter,
      section_key: input.sectionKey,
      body: input.body,
      edited_by: editedBy,
    },
    { onConflict: "template,fiscal_year,quarter,section_key" },
  );
  if (result.error) throw new Error(result.error.message);
}
