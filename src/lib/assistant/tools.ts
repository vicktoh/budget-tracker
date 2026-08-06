import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

/**
 * Tables and views the assistant may query. Everything here is already
 * readable by authenticated users through PostgREST; row-level security
 * decides which rows the current user actually sees, so this list only
 * keeps the model away from plumbing tables, not from protected data.
 */
export const ASSISTANT_QUERYABLE_TABLES = [
  // Identity & access
  "profiles",
  "user_mda_memberships",
  "user_facility_assignments",
  // Reference data
  "mdas",
  "mda_types",
  "programme_areas",
  "funding_sources",
  "funding_partners",
  "expenditure_categories",
  "expenditure_items",
  "payment_methods",
  "lgas",
  "facilities",
  // Plans & budgets
  "approved_budgets",
  "approved_budget_lines",
  "budget_line_revenues",
  "budget_line_revenue_actuals",
  "aop_activities",
  "aop_activity_funding_allocations",
  "monthly_expenditure_tracking",
  // Ledger
  "funding_entries",
  "expenditure_entries",
  "expenditure_funding_allocations",
  "archived_ledger_entries",
  // BIR publications
  "budget_implementation_report_publications",
  "budget_implementation_report_amendments",
  "report_publishers",
  "report_narratives",
  // Entry workflow
  "entry_audit_events",
  "entry_comments",
  "entry_attachments",
  "entry_data_quality_warnings",
  "submission_windows",
  "reference_value_requests",
  "notifications",
  "admin_import_batches",
  "export_jobs",
  // Reporting views (pre-aggregated, RLS-respecting)
  "mda_budget_vs_actual",
  "funding_by_source",
  "expenditure_by_category",
  "expenditure_by_funding_source",
  "programme_area_summary",
  "phc_lga_expenditure_summary",
  "phc_facility_expenditure_summary",
  "aop_planned_vs_actual",
  "unlinked_expenditure",
] as const;

const filterSchema = z.object({
  column: z.string().describe("Column name to filter on"),
  operator: z
    .enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"])
    .describe(
      "Comparison operator. Use 'ilike' with % wildcards for fuzzy text search, 'in' with an array value, 'is' with null.",
    ),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.union([z.string(), z.number()])),
    ])
    .describe("Value to compare against. Must be an array for 'in'."),
});

/** Rough cap so a huge result set cannot blow up the model context. */
const MAX_RESULT_CHARS = 40_000;

export const chartInputSchema = z.object({
  type: z
    .enum(["bar", "horizontal-bar", "stacked-bar", "line", "area", "pie", "donut"])
    .describe(
      "Chart form. bar/horizontal-bar for comparisons (horizontal when category names are long), " +
        "stacked-bar for part-of-whole across categories, line/area for change over time, " +
        "pie/donut only for a single share-of-total with at most 6 slices.",
    ),
  title: z.string().max(90).describe("Short chart headline, e.g. 'Q2 2026 expenditure by category'"),
  description: z
    .string()
    .max(160)
    .optional()
    .describe("One-line caption clarifying scope, units, or source"),
  xKey: z
    .string()
    .describe("Key in each data row holding the category / x-axis value (a string)"),
  series: z
    .array(
      z.object({
        dataKey: z.string().describe("Key in each data row holding this numeric series"),
        label: z.string().optional().describe("Human label for the legend"),
      }),
    )
    .min(1)
    .max(5)
    .describe("Numeric series to plot. Pie/donut use only the first series."),
  data: z
    .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
    .min(1)
    .max(60)
    .describe("Rows of plain objects. Keep it under ~30 categories for readability."),
  valueFormat: z
    .enum(["naira", "number", "percent"])
    .default("naira")
    .describe("How to format numeric values on axes and tooltips"),
});

export type AssistantChartInput = z.infer<typeof chartInputSchema>;

export function createAssistantTools(supabase: TypedSupabaseClient) {
  // The whitelist includes views and tables newer than the hand-written
  // Database type, so queries go through an untyped handle. RLS on the
  // user-scoped client remains the authorization boundary.
  const db = supabase as unknown as SupabaseClient;

  const queryDatabase = tool({
    description:
      "Run a read-only query against the live finance database as the current user. " +
      "Row-level security applies: results only contain rows this user is allowed to see. " +
      "Prefer the reporting views for totals and summaries. " +
      "Supports PostgREST select syntax including nested relations " +
      "(e.g. 'id,amount,mdas(name)'). Aggregate functions like sum() are NOT enabled — " +
      "fetch rows (paginate with offset if needed) and compute totals yourself.",
    inputSchema: z.object({
      table: z
        .enum(ASSISTANT_QUERYABLE_TABLES)
        .describe("Table or view to query"),
      select: z
        .string()
        .max(1_000)
        .default("*")
        .describe(
          "PostgREST select string: columns, nested relations, aggregates. Defaults to all columns.",
        ),
      filters: z
        .array(filterSchema)
        .max(10)
        .default([])
        .describe("Filters combined with AND"),
      orderBy: z
        .object({
          column: z.string(),
          ascending: z.boolean().default(false),
        })
        .optional()
        .describe("Sort order for the results"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe("Maximum rows to return (1-200)"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Rows to skip, for pagination"),
      countOnly: z
        .boolean()
        .default(false)
        .describe(
          "When true, return only the number of matching rows without fetching them",
        ),
    }),
    execute: async ({
      table,
      select,
      filters,
      orderBy,
      limit,
      offset,
      countOnly,
    }) => {
      let query = db
        .from(table)
        .select(countOnly ? "*" : select, {
          count: countOnly ? "exact" : undefined,
          head: countOnly,
        });

      for (const filter of filters) {
        const { column, operator, value } = filter;
        if (operator === "in") {
          if (!Array.isArray(value)) {
            return {
              error: `Filter on '${column}': operator 'in' requires an array value.`,
            };
          }
          query = query.in(column, value);
        } else {
          query = query.filter(column, operator, value);
        }
      }

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }
      if (!countOnly) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return {
          error: error.message,
          hint: error.hint ?? undefined,
          details: error.details ?? undefined,
        };
      }

      if (countOnly) {
        return { table, matchingRows: count ?? 0 };
      }

      const rows = data ?? [];
      let serialized = JSON.stringify(rows);
      let truncatedTo: number | undefined;
      while (serialized.length > MAX_RESULT_CHARS && rows.length > 1) {
        rows.length = Math.ceil(rows.length / 2);
        truncatedTo = rows.length;
        serialized = JSON.stringify(rows);
      }

      return {
        table,
        rowCount: rows.length,
        // rows.length === limit means there may be more matching rows.
        possiblyMore: rows.length === limit,
        ...(truncatedTo === undefined
          ? {}
          : {
              note: `Result was large; only the first ${truncatedTo} rows are included. Use filters, a narrower select, or offset to see more.`,
            }),
        rows,
      };
    },
  });

  const renderChart = tool({
    description:
      "Render an interactive chart inline in the conversation. Use this whenever numbers would " +
      "read better as a picture: comparisons across MDAs or categories, trends across quarters or " +
      "months, budget vs actual, shares of a total. Always base the data on results you already " +
      "queried in this conversation — never invent values. Give values in plain Naira (not " +
      "millions) and let the chart handle formatting.",
    inputSchema: chartInputSchema,
    execute: async ({ type, data, series }) => ({
      rendered: true,
      type,
      points: data.length,
      seriesCount: series.length,
    }),
  });

  return { queryDatabase, renderChart };
}
