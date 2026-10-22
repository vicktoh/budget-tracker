/**
 * Load the BIR archive into the public dataset (bir_reports, bir_figures,
 * bir_entities) and mirror the PDFs into the public `bir-reports` bucket.
 *
 *   python3 -I scripts/bir/download.py scripts/bir/sources.json tmp/bir-pdfs
 *   python3 -I scripts/bir/parse.py tmp/bir-pdfs/manifest.json tmp/bir-pdfs tmp/bir-parsed
 *   npx tsx scripts/bir/load.ts                 # dry run: prints what would change
 *   npx tsx scripts/bir/load.ts --write         # writes to the database in .env.local
 *
 * Every report gets an archive row and a mirrored PDF. Figures are loaded and
 * the report marked published only when it is listed in PUBLISHABLE below
 * and its parse produced no failing checks. A current-year quarter must also
 * have a platform BIR publication (budget_implementation_report_publications);
 * the public site shows official quarters only.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.join(__dirname, "..", "..", ".env.local"));

const ROOT = path.join(__dirname, "..", "..");
const PDF_DIR = path.join(ROOT, "tmp", "bir-pdfs");
const PARSED_DIR = path.join(ROOT, "tmp", "bir-parsed");
const WRITE = process.argv.includes("--write");
// --export <file>: write the dataset that would be loaded as JSON (dev fixture),
// treating --assume-published slugs as having a platform publication.
const EXPORT_PATH = argValue("--export");
const ASSUME_PUBLISHED = new Set((argValue("--assume-published") ?? "").split(",").filter(Boolean));

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Reports whose figures are public once their checks pass.
const PUBLISHABLE = new Set([
  "2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4",
  "2024-Q1", "2024-Q2",
  "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4",
  "2026-Q2",
]);

// Shown on the archive card when a report's figures are not public.
const HELD_NOTES: Record<string, string> = {
  "2024-Q3": "Some tables in this report do not add up to the report's own totals. Its figures are held back while they are checked; the PDF is available to download.",
  "2024-Q4": "The tables in this report are images rather than text. Its figures are being transcribed; the PDF is available to download.",
  "2026-Q1": "Most tables in this report are images. Q1 2026 figures on this site come from the Q2 2026 report (year to date minus Q2).",
};
const NOT_EXTRACTED_NOTE =
  "Figures from this report have not been extracted yet. The PDF is available to download.";

const LENS: Record<string, string> = {
  state_summary: "state",
  revenue_admin: "revenue",
  exp_admin: "mda",
  exp_function: "function",
  exp_programme: "programme",
  phc_admin: "phc_mda",
  phc_function: "phc_function",
  phc_programme: "phc_programme",
  phc_economic: "phc_economic",
  phc_projects: "phc_project",
};

type ManifestEntry = {
  fiscal_year: number;
  quarter: number;
  full_year?: boolean;
  url: string;
  note?: string;
  slug: string;
  file: string;
  bytes: number;
  sha256: string;
  pages: number;
};

type ParsedRow = {
  code: string | null;
  name: string;
  key?: string;
  mda?: string;
  page: number;
  derived?: string;
  original_budget: number | null;
  revised_budget: number | null;
  quarter_actual: number | null;
  ytd_actual: number | null;
  original_budget_from?: string;
};

type ParsedTable = {
  number: number;
  kind: string;
  class: string | null;
  budget_column_note?: string;
  rows: ParsedRow[];
};

type Parsed = ManifestEntry & { tables: ParsedTable[]; checks: string[] };

function title(entry: ManifestEntry): string {
  return entry.full_year
    ? `Kano State ${entry.fiscal_year} Full Year Budget Performance Report`
    : `Kano State ${entry.fiscal_year} Q${entry.quarter} Budget Performance Report`;
}

function figureRows(parsed: Parsed, reportId: string) {
  const rows = [];
  for (const table of parsed.tables) {
    const lens = LENS[table.kind];
    if (!lens) continue;
    for (const r of table.rows) {
      const notes = [r.derived, table.budget_column_note,
        r.original_budget_from ? `Original budget taken from the ${parsed.fiscal_year} ${r.original_budget_from}.` : null]
        .filter(Boolean);
      rows.push({
        report_id: reportId,
        lens,
        econ_class: table.class ?? "total",
        code: r.code,
        row_key: lens === "state" ? r.key ?? null : r.code ? null : "table_total",
        name: r.name,
        mda_code: lens === "phc_project" ? r.code : null,
        original_budget: r.original_budget,
        revised_budget: r.revised_budget,
        quarter_actual: r.quarter_actual,
        ytd_actual: r.ytd_actual,
        table_number: table.number,
        page: r.page,
        note: notes.length ? notes.join(" ") : null,
      });
    }
  }
  // PHC project rows carry the MDA code, not a project code.
  return rows.map((row) => (row.lens === "phc_project" ? { ...row, code: null } : row));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(path.join(PDF_DIR, "manifest.json"), "utf8"));
  const sources: { url: string; note?: string }[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "sources.json"), "utf8"),
  );

  const { data: publications, error: pubError } = await db
    .from("budget_implementation_report_publications")
    .select("fiscal_year, quarter");
  if (pubError) throw pubError;
  const platformPublished = new Set([
    ...(publications ?? []).map((p) => `${p.fiscal_year}-Q${p.quarter}`),
    ...(EXPORT_PATH ? ASSUME_PUBLISHED : []),
  ]);
  const exported: { reports: unknown[]; figures: unknown[]; entities: unknown[] } = { reports: [], figures: [], entities: [] };
  // Years the platform ledger covers: their quarters need a platform publication too.
  const { data: firstEntry, error: ledgerError } = await db
    .from("expenditure_entries")
    .select("transaction_date")
    .order("transaction_date", { ascending: true })
    .limit(1);
  if (ledgerError) throw ledgerError;
  const firstLedgerYear = firstEntry?.[0] ? Number(String(firstEntry[0].transaction_date).slice(0, 4)) : Infinity;
  const platformYears = { has: (year: number) => year >= firstLedgerYear };

  // Display names.
  const entities = JSON.parse(fs.readFileSync(path.join(__dirname, "entities.json"), "utf8"));
  console.log(`entities: ${entities.length}`);
  exported.entities = entities;
  if (WRITE) {
    const { error } = await db.from("bir_entities").upsert(entities, { onConflict: "lens,code" });
    if (error) throw error;
  }

  for (const entry of manifest) {
    const storagePath = `${entry.slug}.pdf`;
    const parsedPath = path.join(PARSED_DIR, `${entry.slug}.json`);
    const parsed: Parsed | null = fs.existsSync(parsedPath) ? JSON.parse(fs.readFileSync(parsedPath, "utf8")) : null;

    let publish = PUBLISHABLE.has(entry.slug) && parsed !== null && parsed.checks.length === 0;
    let heldReason: string | null = null;
    if (publish && platformYears.has(entry.fiscal_year) && !platformPublished.has(entry.slug)) {
      publish = false;
      heldReason = "no platform BIR publication for this quarter";
    }
    if (PUBLISHABLE.has(entry.slug) && parsed && parsed.checks.length) {
      heldReason = `${parsed.checks.length} failing checks`;
    }

    const report = {
      slug: entry.slug,
      fiscal_year: entry.fiscal_year,
      quarter: entry.quarter,
      full_year_only: Boolean(entry.full_year),
      title: title(entry),
      source_url: entry.url,
      source_note: sources.find((s) => s.url === entry.url)?.note ?? null,
      storage_path: storagePath,
      sha256: entry.sha256,
      file_bytes: entry.bytes,
      page_count: entry.pages,
      data_status: publish ? "published" : "download_only",
      data_note: publish ? null : HELD_NOTES[entry.slug] ?? NOT_EXTRACTED_NOTE,
      checks: parsed ? { failing: parsed.checks.length, details: parsed.checks.slice(0, 50) } : {},
      is_listed: true,
      updated_at: new Date().toISOString(),
    };

    const figures = parsed && publish ? figureRows(parsed, entry.slug) : [];
    if (EXPORT_PATH) {
      exported.reports.push({ ...report, id: entry.slug, published_at: publish ? report.updated_at : null });
      exported.figures.push(...figures);
    }
    console.log(
      `${entry.slug}: ${report.data_status}${heldReason ? ` (held: ${heldReason})` : ""}, ${figures.length} figures`,
    );
    if (!WRITE) continue;

    // Mirror the PDF (unchanged bytes; sha256 is published alongside).
    const { data: existing } = await db.storage.from("bir-reports").list("", { search: storagePath });
    if (!existing?.some((f) => f.name === storagePath)) {
      const bytes = fs.readFileSync(path.join(PDF_DIR, entry.file));
      const { error } = await db.storage
        .from("bir-reports")
        .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false, cacheControl: "31536000" });
      if (error) throw error;
    }

    const { data: saved, error } = await db
      .from("bir_reports")
      .upsert(report, { onConflict: "slug" })
      .select("id, published_at")
      .single();
    if (error) throw error;

    await db.from("bir_figures").delete().eq("report_id", saved.id);
    if (publish && parsed) {
      const rows = figureRows(parsed, saved.id);
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insertError } = await db.from("bir_figures").insert(rows.slice(i, i + 500));
        if (insertError) throw insertError;
      }
      if (!saved.published_at) {
        await db.from("bir_reports").update({ published_at: new Date().toISOString() }).eq("id", saved.id);
      }
    } else if (saved.published_at) {
      await db.from("bir_reports").update({ published_at: null }).eq("id", saved.id);
    }
  }
  if (EXPORT_PATH) {
    fs.writeFileSync(EXPORT_PATH, JSON.stringify(exported));
    console.log(`\nExported ${exported.reports.length} reports, ${exported.figures.length} figures to ${EXPORT_PATH}`);
  }
  if (!WRITE) console.log("\nDry run. Re-run with --write to apply.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
