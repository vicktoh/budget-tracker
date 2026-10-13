/**
 * Server-side import service. Every call uses the requesting user's own
 * Supabase session (cookie client), never the service role: RLS scopes batch
 * metadata, staged rows and source files to their owner, and the commit RPC
 * writes ledger rows under the same policies and triggers as manual entry.
 */
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expenditureSubmittableMdaIds,
  fundingSubmittableMdaIds,
  isAdmin,
} from "@/lib/access";
import type { AppProfile } from "@/lib/auth-types";
import { parseCsv } from "@/lib/imports/csv";
import {
  FIELD_DEFINITIONS,
  suggestMapping,
  type ImportField,
  type ImportMapping,
  type LedgerType,
} from "@/lib/imports/fields";
import { summarizeRows, type ImportSummary } from "@/lib/imports/summary";
import { buildTable, gridFromCsv, type SourceGridRow, type SourceRowMeta } from "@/lib/imports/table";
import {
  entryKey,
  validateBatch,
  type AopRef,
  type Disposition,
  type ExistingEntry,
  type FacilityRef,
  type ImportOptions,
  type ImportReference,
  type ItemRef,
  type MdaRef,
  type RefValue,
  type RowIssue,
  type StagedRowInput,
  type ValidationContext,
} from "@/lib/imports/validate";
import {
  inspectZipArchive,
  inventorySheets,
  loadWorkbook,
  readSheetGrid,
  type SheetInventory,
} from "@/lib/imports/xlsx";

// The hand-authored Database type does not describe the import tables, so the
// service uses an untyped client view. Row shapes are declared below.
type Db = SupabaseClient;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DATA_ROWS = 5000;
const SOURCE_BUCKET = "import-sources";
const WRITE_CHUNK = 500;
const PAGE = 1000;

export type BatchStatus = "needs_sheet" | "needs_mapping" | "ready_for_review" | "completed" | "cancelled";

export type ImportBatchRow = {
  id: string;
  created_by: string;
  ledger_type: LedgerType;
  status: BatchStatus;
  source_file_name: string;
  source_format: "csv" | "xlsx";
  source_storage_path: string;
  source_sha256: string;
  source_size_bytes: number;
  sheets: SheetInventory[];
  sheet_name: string | null;
  header_row_number: number | null;
  headers: string[];
  mapping: ImportMapping;
  options: Partial<ImportOptions>;
  extraction: Record<string, unknown>;
  revision: number;
  plan_hash: string | null;
  summary: Partial<ImportSummary>;
  receipt: ImportReceipt | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
};

export type ImportRowRecord = {
  id: string;
  batch_id: string;
  source_row_number: number;
  raw: Record<string, string>;
  source_meta: SourceRowMeta;
  overrides: Record<string, string>;
  proposed: Record<string, unknown> | null;
  disposition: Disposition;
  issues: RowIssue[];
  user_excluded: boolean;
  committed_entry_id: string | null;
  committed_public_id: string | null;
};

export type ImportReceipt = {
  ledger_type: LedgerType;
  inserted_count: number;
  inserted_total: string;
  committed_at: string;
  plan_hash: string;
  replayed?: boolean;
  entries: Array<{ row_id: string; source_row_number: number; entry_id: string; public_id: string | null; amount: number | string }>;
  not_inserted: { blocked: number; duplicate: number; excluded: number };
};

export class ImportError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "import_error",
  ) {
    super(message);
  }
}

function throwIf(error: { message: string; code?: string } | null, context: string): void {
  if (error) throw new ImportError(`${context}: ${error.message}`, 500, error.code ?? "db_error");
}

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    throwIf(error, "Loading data");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Can this profile use imports at all, and for which ledgers? */
export function importableLedgers(profile: AppProfile): LedgerType[] {
  if (isAdmin(profile)) return ["funding", "expenditure"];
  if (profile.role !== "mda_user") return [];
  const ledgers: LedgerType[] = [];
  if (fundingSubmittableMdaIds(profile).length) ledgers.push("funding");
  if (expenditureSubmittableMdaIds(profile).length) ledgers.push("expenditure");
  return ledgers;
}

function permittedMdaIds(profile: AppProfile, ledger: LedgerType): Set<string> | "all" {
  if (isAdmin(profile)) return "all";
  return new Set(ledger === "funding" ? fundingSubmittableMdaIds(profile) : expenditureSubmittableMdaIds(profile));
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "");
  return (cleaned || "upload").slice(-120);
}

type ParsedSource =
  | { format: "csv"; grid: SourceGridRow[]; sheets: SheetInventory[] }
  | { format: "xlsx"; sheets: SheetInventory[]; buffer: Buffer };

function detectFormat(fileName: string): "csv" | "xlsx" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xlsm") || lower.endsWith(".xls")) {
    throw new ImportError("Only .xlsx workbooks and .csv files are supported. Macro-enabled (.xlsm) and legacy .xls files must be re-saved as .xlsx.");
  }
  throw new ImportError("Upload a .csv file or an .xlsx workbook.");
}

async function inspectSource(fileName: string, buffer: Buffer): Promise<ParsedSource> {
  const format = detectFormat(fileName);
  if (format === "csv") {
    if (buffer.includes(0)) {
      throw new ImportError("This file contains binary data and is not a CSV. If it is a workbook, upload the .xlsx file.");
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new ImportError("The CSV is not UTF-8 text. In Excel choose Save As → \"CSV UTF-8\" and upload again.");
    }
    let rows: string[][];
    try {
      rows = parseCsv(text);
    } catch (error) {
      throw new ImportError((error as Error).message);
    }
    return { format, grid: gridFromCsv(rows), sheets: [{ name: "CSV", state: "visible", rowCount: rows.length }] };
  }

  const zip = inspectZipArchive(buffer);
  if (!zip.ok) throw new ImportError(zip.message);
  try {
    const workbook = await loadWorkbook(buffer);
    return { format, sheets: inventorySheets(workbook), buffer };
  } catch (error) {
    throw new ImportError(
      `The workbook could not be read (${(error as Error).message}). Its internal structure may be damaged; open it in Excel, re-save as .xlsx and upload again. Nothing was imported.`,
    );
  }
}

/** Upload → private storage → draft batch. Never touches the ledger. */
export async function createBatch(args: {
  client: Db;
  profile: AppProfile;
  ledger: LedgerType;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}): Promise<string> {
  const { client, profile, ledger, fileName, buffer } = args;
  if (!importableLedgers(profile).includes(ledger)) {
    throw new ImportError(`You don't have a ${ledger} submit grant, so you can't import ${ledger} entries.`, 403, "forbidden");
  }
  if (buffer.length === 0) throw new ImportError("The file is empty.");
  if (buffer.length > MAX_FILE_BYTES) throw new ImportError("Files must be 10 MB or smaller.");

  const source = await inspectSource(fileName, buffer);
  const batchId = randomUUID();
  const storagePath = `${profile.id}/${batchId}/${sanitizeFileName(fileName)}`;
  const { error: uploadError } = await client.storage
    .from(SOURCE_BUCKET)
    .upload(storagePath, buffer, { contentType: args.contentType || "application/octet-stream", upsert: false });
  throwIf(uploadError, "Storing the source file");

  const { error } = await client.from("import_batches").insert({
    id: batchId,
    created_by: profile.id,
    ledger_type: ledger,
    status: "needs_sheet",
    source_file_name: fileName.slice(0, 255),
    source_format: source.format,
    source_storage_path: storagePath,
    source_sha256: createHash("sha256").update(buffer).digest("hex"),
    source_size_bytes: buffer.length,
    sheets: source.sheets,
  });
  throwIf(error, "Creating the import batch");

  if (source.format === "csv") {
    await stageGrid(client, profile, batchId, "CSV", source.grid);
  } else {
    const candidates = source.sheets.filter((sheet) => sheet.state === "visible" && sheet.rowCount > 1);
    if (candidates.length === 1) {
      await selectSheet(client, profile, batchId, candidates[0].name, buffer);
    }
  }
  return batchId;
}

export async function loadBatch(client: Db, batchId: string): Promise<ImportBatchRow> {
  const { data, error } = await client.from("import_batches").select("*").eq("id", batchId).maybeSingle();
  throwIf(error, "Loading the import batch");
  if (!data) throw new ImportError("Import batch not found.", 404, "not_found");
  return data as ImportBatchRow;
}

export async function loadRows(client: Db, batchId: string): Promise<ImportRowRecord[]> {
  return fetchAll<ImportRowRecord>((from, to) =>
    client
      .from("import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .order("source_row_number", { ascending: true })
      .range(from, to),
  );
}

function assertOpen(batch: ImportBatchRow, profile: AppProfile): void {
  if (batch.created_by !== profile.id) {
    throw new ImportError("Only the user who uploaded this batch can change it.", 403, "forbidden");
  }
  if (batch.status === "completed" || batch.status === "cancelled") {
    throw new ImportError(`This batch is ${batch.status} and can no longer change.`, 409, "batch_closed");
  }
}

export async function selectSheet(
  client: Db,
  profile: AppProfile,
  batchId: string,
  sheetName: string,
  buffer?: Buffer,
): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  if (batch.source_format !== "xlsx") throw new ImportError("Only workbooks have sheets to choose.");
  if (!batch.sheets.some((sheet) => sheet.name === sheetName)) throw new ImportError("That sheet is not in the workbook.");

  let source = buffer;
  if (!source) {
    const { data, error } = await client.storage.from(SOURCE_BUCKET).download(batch.source_storage_path);
    throwIf(error, "Reading the source file");
    source = Buffer.from(await data!.arrayBuffer());
  }
  const workbook = await loadWorkbook(source);
  const grid = readSheetGrid(workbook, sheetName);
  if (!grid) throw new ImportError("That sheet could not be read.");
  await stageGrid(client, profile, batchId, sheetName, grid);
}

async function stageGrid(
  client: Db,
  profile: AppProfile,
  batchId: string,
  sheetName: string,
  grid: SourceGridRow[],
): Promise<void> {
  const batch = await loadBatch(client, batchId);
  const table = buildTable(grid);
  if (!table) {
    throw new ImportError(`No table was found in ${sheetName === "CSV" ? "the file" : `sheet "${sheetName}"`}: it needs a header row with at least two column names.`);
  }
  if (table.rows.length === 0) throw new ImportError("The table has a header row but no data rows.");
  if (table.rows.length > MAX_DATA_ROWS) {
    throw new ImportError(`The table has ${table.rows.length} data rows. Split it into files of ${MAX_DATA_ROWS} rows or fewer.`);
  }

  const { error: deleteError } = await client.from("import_rows").delete().eq("batch_id", batchId);
  throwIf(deleteError, "Clearing previous rows");
  for (const part of chunk(table.rows, WRITE_CHUNK)) {
    const { error } = await client.from("import_rows").insert(
      part.map((row) => ({
        batch_id: batchId,
        source_row_number: row.sourceRowNumber,
        raw: row.raw,
        source_meta: row.meta,
      })),
    );
    throwIf(error, "Staging rows");
  }

  const { error } = await client
    .from("import_batches")
    .update({
      status: "needs_mapping",
      sheet_name: sheetName,
      header_row_number: table.headerRowNumber,
      headers: table.headers,
      mapping: suggestMapping(batch.ledger_type, table.headers),
      options: { date_convention: null, default_mda_id: null },
      extraction: {
        data_rows: table.rows.length,
        blank_rows_skipped: table.blankRowsSkipped,
        formula_only_rows_skipped: table.formulaOnlyRowsSkipped,
        hidden_rows: table.hiddenRows,
      },
      plan_hash: null,
      revision: batch.revision + 1,
    })
    .eq("id", batchId);
  throwIf(error, "Saving the table layout");
  await revalidateBatch(client, profile, batchId, { bumpRevision: false });
}

export async function updateMapping(
  client: Db,
  profile: AppProfile,
  batchId: string,
  mapping: ImportMapping,
  options: ImportOptions,
): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  const validFields = new Set(FIELD_DEFINITIONS[batch.ledger_type].map((def) => def.field));
  const cleanMapping: ImportMapping = {};
  const used = new Set<string>();
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue;
    if (!validFields.has(field as ImportField)) throw new ImportError(`Unknown field "${field}".`);
    if (!batch.headers.includes(header)) throw new ImportError(`Column "${header}" is not in this file.`);
    if (used.has(header)) throw new ImportError(`Column "${header}" is mapped to more than one field.`);
    used.add(header);
    cleanMapping[field as ImportField] = header;
  }
  if (options.default_mda_id) {
    if (cleanMapping.mda) throw new ImportError("Choose either an MDA column or one MDA for every row, not both.");
    const permitted = permittedMdaIds(profile, batch.ledger_type);
    if (permitted !== "all" && !permitted.has(options.default_mda_id)) {
      throw new ImportError("You can only choose an MDA you hold a submit grant for.", 403, "forbidden");
    }
  }
  const { error } = await client
    .from("import_batches")
    .update({ mapping: cleanMapping, options, plan_hash: null })
    .eq("id", batchId);
  throwIf(error, "Saving the mapping");
  await revalidateBatch(client, profile, batchId);
}

export async function updateRow(
  client: Db,
  profile: AppProfile,
  batchId: string,
  rowId: string,
  change: { overrides?: Record<string, string>; user_excluded?: boolean },
): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  const patch: Record<string, unknown> = {};
  if (change.overrides) {
    const overrides: Record<string, string> = {};
    for (const [header, value] of Object.entries(change.overrides)) {
      if (!batch.headers.includes(header)) throw new ImportError(`Column "${header}" is not in this file.`);
      if (value.length > 500) throw new ImportError("Cell values must be 500 characters or fewer.");
      overrides[header] = value;
    }
    patch.overrides = overrides;
  }
  if (typeof change.user_excluded === "boolean") patch.user_excluded = change.user_excluded;
  if (!Object.keys(patch).length) return;
  const { error, count } = await client
    .from("import_rows")
    .update(patch, { count: "exact" })
    .eq("id", rowId)
    .eq("batch_id", batchId);
  throwIf(error, "Updating the row");
  if (!count) throw new ImportError("Row not found in this batch.", 404, "not_found");
  await revalidateBatch(client, profile, batchId);
}

export async function cancelBatch(client: Db, profile: AppProfile, batchId: string): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  const { error } = await client.from("import_batches").update({ status: "cancelled", plan_hash: null }).eq("id", batchId);
  throwIf(error, "Cancelling the batch");
}

type BaseReference = Omit<ImportReference, "facilities" | "aopActivities">;

// One request makes one client, so caching per client reuses reference data
// between validation and the response's label map without going stale.
const referenceCache = new WeakMap<Db, Promise<BaseReference>>();

function loadReference(client: Db): Promise<BaseReference> {
  let cached = referenceCache.get(client);
  if (!cached) {
    cached = fetchReference(client);
    referenceCache.set(client, cached);
    cached.catch(() => referenceCache.delete(client));
  }
  return cached;
}

async function fetchReference(client: Db): Promise<BaseReference> {
  const simple = (table: string) =>
    fetchAll<RefValue>((from, to) => client.from(table).select("id, name, slug, active").order("name").range(from, to));
  const [mdas, programmeAreas, fundingSources, expenditureCategories, expenditureItems, paymentMethods, lgas] =
    await Promise.all([
      fetchAll<MdaRef>((from, to) => client.from("mdas").select("id, name, code, abbreviation, active").order("name").range(from, to)),
      simple("programme_areas"),
      simple("funding_sources"),
      simple("expenditure_categories"),
      fetchAll<ItemRef>((from, to) =>
        client.from("expenditure_items").select("id, name, slug, active, expenditure_category_id").order("name").range(from, to),
      ),
      simple("payment_methods"),
      fetchAll<RefValue>((from, to) => client.from("lgas").select("id, name, active").order("name").range(from, to)),
    ]);
  return { mdas, programmeAreas, fundingSources, expenditureCategories, expenditureItems, paymentMethods, lgas };
}

/**
 * Build the validation context. Facilities, AOP activities and existing
 * entries are loaded only for values that appear in this batch, so a large
 * reference table is never pulled wholesale.
 */
async function buildContext(
  client: Db,
  profile: AppProfile,
  batch: ImportBatchRow,
  rows: ImportRowRecord[],
): Promise<ValidationContext> {
  const options: ImportOptions = {
    date_convention: batch.options.date_convention ?? null,
    default_mda_id: batch.options.default_mda_id ?? null,
  };
  const cellValues = (field: ImportField): string[] => {
    const header = batch.mapping[field];
    if (!header) return [];
    return [...new Set(rows.map((row) => (row.overrides[header] ?? row.raw[header] ?? "").trim()).filter(Boolean))];
  };

  const [base, publications] = await Promise.all([
    loadReference(client),
    client.from("budget_implementation_report_publications").select("fiscal_year, quarter"),
  ]);
  throwIf(publications.error, "Loading BIR publications");

  // Which LGAs, MDAs and years the batch can touch, read straight from the
  // mapped cells, so the dependent lookups below can run in parallel.
  const lgaKeys = new Set(cellValues("lga").map((v) => v.toLowerCase()));
  const lgaIds = base.lgas.filter((lga) => lgaKeys.has(lga.name.toLowerCase())).map((lga) => lga.id);
  const mdaIds = new Set<string>(options.default_mda_id ? [options.default_mda_id] : []);
  const mdaValues = cellValues("mda").map((v) => v.toLowerCase());
  for (const mda of base.mdas) {
    if (mdaValues.some((v) => v === mda.code.toLowerCase() || v === mda.name.toLowerCase() || v === (mda.abbreviation ?? "").toLowerCase())) {
      mdaIds.add(mda.id);
    }
  }
  const years = new Set<number>();
  for (const value of cellValues("transaction_date")) {
    const year = /(\d{4})/.exec(value)?.[1];
    if (year) years.add(Number(year));
  }

  const referenceField = batch.ledger_type === "funding" ? "reference_no" : "voucher_ref_no";
  const ledgerTable = batch.ledger_type === "funding" ? "funding_entries" : "expenditure_entries";
  type ExistingRow = { public_id: string | null; amount: string; transaction_date: string; fiscal_year: number; mda_id: string; ref: string };

  const [facilities, aopActivities, ...existingParts] = await Promise.all([
    batch.ledger_type === "expenditure" && lgaIds.length
      ? fetchAll<FacilityRef>((from, to) =>
          client.from("facilities").select("id, name, lga_id, facility_type, active").in("lga_id", lgaIds).order("name").range(from, to),
        )
      : Promise.resolve([] as FacilityRef[]),
    batch.ledger_type === "expenditure" && batch.mapping.aop_activity_code && mdaIds.size && years.size
      ? fetchAll<AopRef>((from, to) =>
          client
            .from("aop_activities")
            .select("id, activity_code, mda_id, fiscal_year, active")
            .in("mda_id", [...mdaIds])
            .in("fiscal_year", [...years])
            .order("activity_code")
            .range(from, to),
        )
      : Promise.resolve([] as AopRef[]),
    ...chunk(cellValues(referenceField), 100).map((part) =>
      fetchAll<ExistingRow>((from, to) =>
        client
          .from(ledgerTable)
          .select(`public_id, amount::text, transaction_date, fiscal_year, mda_id, ref:${referenceField}`)
          .in(referenceField, part)
          .range(from, to),
      ),
    ),
  ]);

  const existingEntries = new Map<string, ExistingEntry>();
  for (const entry of (existingParts as ExistingRow[][]).flat()) {
    // numeric(18,2)::text always carries two decimals, matching proposals.
    existingEntries.set(entryKey(entry.fiscal_year, entry.mda_id, entry.ref), {
      public_id: entry.public_id,
      amount: entry.amount,
      transaction_date: entry.transaction_date,
    });
  }

  return {
    ledger: batch.ledger_type,
    mapping: batch.mapping,
    options,
    reference: { ...base, facilities: facilities as FacilityRef[], aopActivities: aopActivities as AopRef[] },
    permittedMdaIds: permittedMdaIds(profile, batch.ledger_type),
    publishedPeriods: new Set(
      ((publications.data ?? []) as Array<{ fiscal_year: number; quarter: number }>).map((p) => `${p.fiscal_year}-Q${p.quarter}`),
    ),
    existingEntries,
    today: new Date().toISOString().slice(0, 10),
  };
}

/** JSON with recursively sorted keys: jsonb returns keys in its own order. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function toInputs(rows: ImportRowRecord[]): StagedRowInput[] {
  return rows.map((row) => ({
    id: row.id,
    sourceRowNumber: row.source_row_number,
    raw: row.raw,
    overrides: row.overrides ?? {},
    meta: row.source_meta ?? {},
    userExcluded: row.user_excluded,
  }));
}

function mappingComplete(batch: ImportBatchRow): boolean {
  return FIELD_DEFINITIONS[batch.ledger_type].every(
    (def) =>
      !def.required ||
      Boolean(batch.mapping[def.field]) ||
      (def.field === "mda" && Boolean(batch.options.default_mda_id)),
  );
}

/**
 * Re-run validation over the whole batch (in-file duplicates depend on every
 * row), persist only rows whose outcome changed, recompute the summary from
 * the staged rows and refresh the plan hash. Returns the new plan hash.
 */
export async function revalidateBatch(
  client: Db,
  profile: AppProfile,
  batchId: string,
  { bumpRevision = true }: { bumpRevision?: boolean } = {},
): Promise<{ planHash: string | null; changed: boolean }> {
  const [batch, rows] = await Promise.all([loadBatch(client, batchId), loadRows(client, batchId)]);
  assertOpen(batch, profile);
  const ctx = await buildContext(client, profile, batch, rows);
  const results = validateBatch(toInputs(rows), ctx);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const changedRows = results.filter((result) => {
    const row = byId.get(result.id)!;
    return (
      row.disposition !== result.disposition ||
      stableJson(row.proposed) !== stableJson(result.proposed) ||
      stableJson(row.issues) !== stableJson(result.issues)
    );
  });
  for (const part of chunk(changedRows, WRITE_CHUNK)) {
    const { error } = await client.from("import_rows").upsert(
      part.map((result) => {
        const row = byId.get(result.id)!;
        return {
          id: row.id,
          batch_id: row.batch_id,
          source_row_number: row.source_row_number,
          raw: row.raw,
          disposition: result.disposition,
          proposed: result.proposed,
          issues: result.issues,
        };
      }),
      { onConflict: "id" },
    );
    throwIf(error, "Saving validation results");
  }

  const summary = summarizeRows(
    results.map((result) => ({
      disposition: result.disposition,
      issues: result.issues,
      proposed: result.proposed,
    })),
  );
  const ready = mappingComplete(batch) && summary.counts.eligible > 0;
  let planHash: string | null = null;
  if (ready) {
    const { data, error } = await client.rpc("import_batch_plan_hash", { p_batch_id: batchId });
    throwIf(error, "Computing the plan fingerprint");
    planHash = data as string;
  }
  const changed = changedRows.length > 0 || planHash !== batch.plan_hash;
  const { error } = await client
    .from("import_batches")
    .update({
      status: mappingComplete(batch) ? "ready_for_review" : "needs_mapping",
      summary,
      plan_hash: planHash,
      revision: bumpRevision && changed ? batch.revision + 1 : batch.revision,
      last_error: null,
    })
    .eq("id", batchId);
  throwIf(error, "Saving the batch summary");
  return { planHash, changed };
}

function friendlyCommitError(error: { message: string; code?: string; hint?: string }): ImportError {
  const hint = error.hint ?? "";
  if (hint === "import_plan_stale") {
    return new ImportError("The batch changed after you reviewed it. Check the refreshed preview and confirm again.", 409, "plan_stale");
  }
  if (hint === "quarter_published" || /has been published/i.test(error.message)) {
    return new ImportError(`${error.message} Nothing was inserted.`, 409, "quarter_published");
  }
  if (error.code === "23505") {
    return new ImportError(
      "A reference in this batch was recorded by someone else while you were reviewing. Nothing was inserted; refresh to see which row now conflicts.",
      409,
      "duplicate_reference",
    );
  }
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return new ImportError("Your access changed and at least one row is no longer permitted. Nothing was inserted.", 403, "forbidden");
  }
  return new ImportError(`Nothing was inserted: ${error.message}`, 400, hint || error.code || "commit_failed");
}

/**
 * Confirm a reviewed plan. The batch is re-validated against current grants,
 * locks, references and existing entries first; if anything that would be
 * inserted changed, the confirmation is rejected so the user sees the new
 * preview. The insert itself is one database transaction.
 */
export async function commitBatch(
  client: Db,
  profile: AppProfile,
  batchId: string,
  planHash: string,
): Promise<ImportReceipt> {
  const batch = await loadBatch(client, batchId);
  if (batch.created_by !== profile.id) {
    throw new ImportError("Only the user who uploaded this batch can confirm it.", 403, "forbidden");
  }
  if (batch.status === "completed" && batch.receipt) {
    return { ...batch.receipt, replayed: true };
  }
  let fresh: string | null;
  try {
    ({ planHash: fresh } = await revalidateBatch(client, profile, batchId));
  } catch (error) {
    // A concurrent confirmation (double click, retry after a lost response)
    // may have completed the batch in the meantime: return its receipt.
    if (error instanceof ImportError && error.code === "batch_closed") {
      const latest = await loadBatch(client, batchId);
      if (latest.status === "completed" && latest.receipt) return { ...latest.receipt, replayed: true };
    }
    throw error;
  }
  if (!fresh || fresh !== planHash) {
    throw new ImportError("The batch changed after you reviewed it. Check the refreshed preview and confirm again.", 409, "plan_stale");
  }
  const { data, error } = await client.rpc("commit_import_batch", { p_batch_id: batchId, p_plan_hash: planHash });
  if (error) {
    const friendly = friendlyCommitError(error);
    await client.from("import_batches").update({ last_error: friendly.message }).eq("id", batchId);
    throw friendly;
  }
  return data as ImportReceipt;
}

/** id → display name for every reference value a proposal can point at. */
export async function referenceLabels(client: Db): Promise<Record<string, string>> {
  const base = await loadReference(client);
  const labels: Record<string, string> = {};
  for (const list of [base.programmeAreas, base.fundingSources, base.expenditureCategories, base.expenditureItems, base.paymentMethods, base.lgas]) {
    for (const value of list) labels[value.id] = value.name;
  }
  for (const mda of base.mdas) labels[mda.id] = mda.abbreviation ? `${mda.name} (${mda.abbreviation})` : mda.name;
  return labels;
}

/** MDAs the user may choose as the one MDA for every row. */
export async function permittedMdaOptions(
  client: Db,
  profile: AppProfile,
  ledger: LedgerType,
): Promise<Array<{ id: string; name: string }>> {
  const permitted = permittedMdaIds(profile, ledger);
  const { mdas } = await loadReference(client);
  return mdas
    .filter((mda) => mda.active && (permitted === "all" || permitted.has(mda.id)))
    .map((mda) => ({ id: mda.id, name: mda.abbreviation ? `${mda.name} (${mda.abbreviation})` : mda.name }));
}

export async function listBatches(client: Db, profile: AppProfile): Promise<ImportBatchRow[]> {
  const { data, error } = await client
    .from("import_batches")
    .select("id, created_by, ledger_type, status, source_file_name, source_format, summary, receipt, created_at, updated_at, committed_at")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);
  throwIf(error, "Loading your imports");
  return (data ?? []) as ImportBatchRow[];
}
