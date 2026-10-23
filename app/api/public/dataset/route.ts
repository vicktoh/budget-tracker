import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadPublicDataset } from "@/lib/public/dataset";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://kanohealthbudget.org";

const COLUMNS = [
  "fiscal_year",
  "quarter",
  "report",
  "table_kind",
  "spending_type",
  "code",
  "name",
  "display_name",
  "original_budget",
  "revised_budget",
  "quarter_actual",
  "year_to_date_actual",
  "table_number",
  "page",
  "note",
  "source_pdf",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The full published dataset, CC BY 4.0. ?format=csv (default) or json.
 * Only figures of published reports are included: the same rows any visitor can read.
 */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const ds = await loadPublicDataset();
  const reports = new Map(ds.reports.filter((r) => r.data_status === "published").map((r) => [r.id, r]));
  const names = new Map(ds.entities.map((e) => [`${e.lens}:${e.code}`, e.name]));

  const rows = ds.figures
    .filter((f) => reports.has(f.report_id))
    .map((f) => {
      const r = reports.get(f.report_id)!;
      return {
        fiscal_year: r.fiscal_year,
        quarter: r.quarter,
        report: r.title,
        table_kind: f.lens,
        spending_type: f.econ_class,
        code: f.code ?? f.mda_code ?? f.row_key,
        name: f.name,
        display_name: f.code ? names.get(`${f.lens === "revenue" ? "mda" : f.lens}:${f.code}`) ?? null : null,
        original_budget: f.original_budget,
        revised_budget: f.revised_budget,
        quarter_actual: f.quarter_actual,
        year_to_date_actual: f.ytd_actual,
        table_number: f.table_number,
        page: f.page,
        note: f.note,
        source_pdf: `${SITE}/reports/${r.slug}/pdf${f.page ? `?page=${f.page}` : ""}`,
      };
    });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && key) {
    const db = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    await db.rpc("record_public_download", { p_kind: "dataset", p_report_slug: null }).then(
      () => undefined,
      () => undefined,
    );
  }

  const licence = "CC BY 4.0: Kano State Government, Budget Performance Reports, via kanohealthbudget.org";
  if (format === "json") {
    return NextResponse.json(
      { licence, generated_at: new Date().toISOString(), columns: COLUMNS, rows },
      { headers: { "Content-Disposition": 'attachment; filename="kano-health-budget.json"' } },
    );
  }
  const csv = [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((c) => csvCell(row[c])).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kano-health-budget.csv"',
      // Header values must be ASCII; the full credit line is in the JSON body and on /data.
      "X-Licence": "CC-BY-4.0",
    },
  });
}
