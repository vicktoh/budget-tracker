import fs from "node:fs/promises";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { PublicDataset, PublicFigure, PublicReport } from "@/lib/public/types";

/** Cache tag for everything built from the public dataset. Revalidate it after a load or publish. */
export const PUBLIC_DATASET_TAG = "public-dataset";

const PAGE = 1000;

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and publishable key are required for the public site.");
  // Deliberately the anon role with no session: the public site sees exactly what any visitor can.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normaliseFigure(row: Record<string, unknown>): PublicFigure {
  return {
    ...(row as unknown as PublicFigure),
    original_budget: toNumber(row.original_budget),
    revised_budget: toNumber(row.revised_budget),
    quarter_actual: toNumber(row.quarter_actual),
    ytd_actual: toNumber(row.ytd_actual),
  };
}

async function fetchFromSupabase(): Promise<PublicDataset> {
  const db = anonClient();
  const { data: reports, error: reportsError } = await db
    .from("bir_reports")
    .select(
      "id, slug, fiscal_year, quarter, full_year_only, title, source_url, source_note, storage_path, sha256, file_bytes, page_count, data_status, data_note, published_at",
    )
    .order("fiscal_year")
    .order("quarter");
  if (reportsError) throw reportsError;

  const figures: PublicFigure[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("bir_figures")
      .select(
        "report_id, lens, econ_class, code, row_key, name, mda_code, original_budget, revised_budget, quarter_actual, ytd_actual, table_number, page, note",
      )
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    figures.push(...(data ?? []).map(normaliseFigure));
    if (!data || data.length < PAGE) break;
  }

  const { data: entities, error: entitiesError } = await db
    .from("bir_entities")
    .select("lens, code, name, short_name, sort_order");
  if (entitiesError) throw entitiesError;

  return { reports: (reports ?? []) as PublicReport[], figures, entities: entities ?? [] };
}

async function fetchFromFixture(path: string): Promise<PublicDataset> {
  const raw = JSON.parse(await fs.readFile(path, "utf8")) as PublicDataset;
  return { ...raw, figures: raw.figures.map((f) => normaliseFigure(f as unknown as Record<string, unknown>)) };
}

const cachedDataset = unstable_cache(fetchFromSupabase, ["public-dataset-v1"], {
  tags: [PUBLIC_DATASET_TAG],
  revalidate: 3600,
});

/**
 * The whole published dataset (a few thousand rows), cached across requests.
 * PUBLIC_DATASET_FIXTURE points local development at a JSON export from
 * `scripts/bir/load.ts --export` (read fresh, never cached).
 */
export async function loadPublicDataset(): Promise<PublicDataset> {
  const fixture = process.env.PUBLIC_DATASET_FIXTURE;
  if (fixture && process.env.NODE_ENV !== "production") return fetchFromFixture(fixture);
  return cachedDataset();
}

/** Public URL of a mirrored PDF, optionally opened at a page. */
export function reportPdfUrl(report: Pick<PublicReport, "storage_path">, page?: number | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !report.storage_path) return null;
  const url = `${base}/storage/v1/object/public/bir-reports/${encodeURIComponent(report.storage_path)}`;
  return page ? `${url}#page=${page}` : url;
}

export type PublicBrief = {
  id: string;
  kind: string;
  fiscal_year: number;
  quarter: number | null;
  title: string;
  publisher: string | null;
  storage_path: string;
  file_bytes: number | null;
  published_at: string;
};

const cachedBriefs = unstable_cache(
  async (): Promise<PublicBrief[]> => {
    const { data, error } = await anonClient()
      .from("public_briefs")
      .select("id, kind, fiscal_year, quarter, title, publisher, storage_path, file_bytes, published_at")
      .order("fiscal_year", { ascending: false })
      .order("quarter", { ascending: false, nullsFirst: true });
    if (error) throw error;
    return (data ?? []) as PublicBrief[];
  },
  ["public-briefs-v1"],
  { tags: [PUBLIC_DATASET_TAG], revalidate: 3600 },
);

/** Briefs an admin has published to the public site (e.g. the Accountability Brief). */
export async function loadPublicBriefs(): Promise<PublicBrief[]> {
  // The Reports page must still render the State's reports if this list cannot load.
  return cachedBriefs().catch((error) => {
    console.error("Could not load public briefs:", error);
    return [];
  });
}

export function briefPdfUrl(brief: Pick<PublicBrief, "storage_path">): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/public-briefs/${encodeURIComponent(brief.storage_path)}` : null;
}
