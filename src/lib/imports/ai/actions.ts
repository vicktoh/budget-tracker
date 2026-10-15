/**
 * Server actions for AI-assisted imports. Each action loads the user's own
 * batch under RLS, sends only that batch's sheet profiles (and, for value
 * matching, reference names) to the model, validates the structured result
 * and stores it on the batch as a suggestion. Answers the user confirms are
 * stored as value aliases and applied by the deterministic validator.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppProfile } from "@/lib/auth-types";
import { UNSPECIFIED_FUNDING_SOURCE_SLUG } from "@/lib/expenditure/funding-allocations";
import { parseCsv } from "@/lib/imports/csv";
import { normalizeKey } from "@/lib/imports/normalize";
import { gridFromCsv, type SourceGridRow } from "@/lib/imports/table";
import { inventorySheets, loadWorkbook, readSheetGrid } from "@/lib/imports/xlsx";
import {
  ImportError,
  SOURCE_BUCKET,
  assertOpen,
  loadBatch,
  loadReference,
  loadRows,
  permittedMdaIds,
  revalidateBatch,
  throwIf,
  type ImportBatchRow,
  type ImportRowRecord,
} from "@/lib/imports/server";
import { ALIASABLE_FIELDS, aliasFor, type ImportOptions } from "@/lib/imports/validate";
import type { ImportField } from "@/lib/imports/fields";
import {
  MAX_SHEETS,
  SAMPLE_ROWS,
  buildSheetProfile,
  classifyByHeuristics,
  type SheetProfile,
} from "@/lib/imports/ai/profile";
import {
  PROMPT_VERSION,
  aiConfigured,
  classifySheets,
  importModelId,
  suggestColumnMapping,
  suggestValueMatches,
  type MappingSuggestion,
  type ReferenceOption,
  type SheetClassification,
  type ValueMatch,
  type ValueQuestion,
} from "@/lib/imports/ai/assist";
import type { LanguageModel } from "ai";
import type { SheetKind } from "@/lib/imports/ai/kinds";

type Db = SupabaseClient;

/** Hard cap on model calls per batch, so a draft can't run up cost. */
export const MAX_AI_CALLS_PER_BATCH = 12;

export type AiCallLog = { action: string; model: string; prompt_version: string; at: string; by: string; inputs: string };

export type BatchAiState = {
  heuristics?: Array<{ sheet_name: string; kind: SheetKind; reason: string }>;
  classification?: { sheets: SheetClassification[]; workbook_notes: string[]; model: string; at: string } | null;
  classification_error?: string | null;
  mapping_suggestions?: { suggestions: MappingSuggestion[]; model: string; at: string; sheet: string | null } | null;
  value_matches?: { matches: ValueMatch[]; model: string; at: string } | null;
  calls?: AiCallLog[];
};

export type ValueQuestionView = ValueQuestion & {
  key: string;
  answer: string | null | undefined;
  options: ReferenceOption[];
  suggestion: ValueMatch | null;
};

function aiState(batch: ImportBatchRow): BatchAiState {
  return ((batch.extraction?.ai as BatchAiState | undefined) ?? {}) as BatchAiState;
}

async function saveAiState(client: Db, batch: ImportBatchRow, next: BatchAiState): Promise<void> {
  const { error } = await client
    .from("import_batches")
    .update({ extraction: { ...batch.extraction, ai: next } })
    .eq("id", batch.id);
  throwIf(error, "Saving AI results");
}

function guardAiCall(batch: ImportBatchRow): void {
  if (!aiConfigured()) {
    throw new ImportError("AI assistance isn't configured on this server (no OPENAI_API_KEY). You can still map columns and answer questions manually.", 503, "ai_unavailable");
  }
  if ((aiState(batch).calls?.length ?? 0) >= MAX_AI_CALLS_PER_BATCH) {
    throw new ImportError(`This batch has used its ${MAX_AI_CALLS_PER_BATCH} AI requests. Continue manually or start a new batch.`, 429, "ai_limit");
  }
}

function logCall(state: BatchAiState, profile: AppProfile, action: string, inputs: string): AiCallLog[] {
  return [
    ...(state.calls ?? []),
    { action, model: importModelId(), prompt_version: PROMPT_VERSION, at: new Date().toISOString(), by: profile.id, inputs },
  ];
}

async function loadSourceGrids(client: Db, batch: ImportBatchRow): Promise<Array<{ name: string; state: SheetProfile["state"]; grid: SourceGridRow[] }>> {
  const { data, error } = await client.storage.from(SOURCE_BUCKET).download(batch.source_storage_path);
  throwIf(error, "Reading the source file");
  const buffer = Buffer.from(await data!.arrayBuffer());
  if (batch.source_format === "csv") {
    return [{ name: "CSV", state: "visible", grid: gridFromCsv(parseCsv(new TextDecoder("utf-8").decode(buffer))) }];
  }
  const workbook = await loadWorkbook(buffer);
  return inventorySheets(workbook)
    .slice(0, MAX_SHEETS)
    .map((sheet) => ({ name: sheet.name, state: sheet.state, grid: readSheetGrid(workbook, sheet.name) ?? [] }));
}

/**
 * Classify every sheet. The keyword classifier always runs; the AI
 * classification runs when configured and is stored beside it, never
 * replacing the user's own sheet choice.
 */
export async function analyzeWorkbook(client: Db, profile: AppProfile, batchId: string, model?: LanguageModel): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  const sheets = await loadSourceGrids(client, batch);
  const profiles = sheets.map((s) => buildSheetProfile(s.name, s.state, s.grid));
  const state = aiState(batch);
  const heuristics = profiles.map((p) => ({ sheet_name: p.name, ...classifyByHeuristics(p) }));

  if (!aiConfigured()) {
    await saveAiState(client, batch, { ...state, heuristics, classification_error: "AI isn't configured on this server; showing the keyword classification only." });
    return;
  }
  guardAiCall(batch);
  const calls = logCall(state, profile, "classify_sheets", `${profiles.length} sheet profiles (headers + up to ${SAMPLE_ROWS} sample rows each)`);
  try {
    const result = await classifySheets(profiles, model);
    await saveAiState(client, batch, {
      ...state,
      heuristics,
      calls,
      classification_error: null,
      classification: { ...result, model: importModelId(), at: new Date().toISOString() },
    });
  } catch (error) {
    await saveAiState(client, batch, { ...state, heuristics, calls, classification_error: `AI classification failed: ${(error as Error).message}` });
    throw new ImportError("The AI classification request failed. The keyword classification is still shown; try again later.", 502, "ai_failed");
  }
}

/** Profile of the staged sheet, rebuilt from staged rows (no file re-read). */
function stagedProfile(batch: ImportBatchRow, rows: ImportRowRecord[]): SheetProfile {
  const headers = batch.headers;
  return buildSheetProfile(batch.sheet_name ?? "CSV", "visible", [
    { rowNumber: batch.header_row_number ?? 1, cells: headers.map((text) => ({ text })) },
    ...rows.slice(0, SAMPLE_ROWS * 3).map((row) => ({
      rowNumber: row.source_row_number,
      cells: headers.map((h) => ({ text: row.raw[h] ?? "" })),
    })),
  ]);
}

export async function suggestMappingWithAi(client: Db, profile: AppProfile, batchId: string, model?: LanguageModel): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  if (!batch.headers.length) throw new ImportError("Choose a sheet first.");
  guardAiCall(batch);
  const rows = await loadRows(client, batchId);
  const state = aiState(batch);
  const calls = logCall(state, profile, "suggest_mapping", `headers + ${SAMPLE_ROWS} sample rows of "${batch.sheet_name}"`);
  try {
    const suggestions = await suggestColumnMapping(batch.ledger_type, stagedProfile(batch, rows), batch.mapping, model);
    await saveAiState(client, batch, {
      ...state,
      calls,
      mapping_suggestions: { suggestions, model: importModelId(), at: new Date().toISOString(), sheet: batch.sheet_name },
    });
  } catch (error) {
    await saveAiState(client, batch, { ...state, calls });
    throw new ImportError(`The AI mapping request failed (${(error as Error).message}). Map the columns manually.`, 502, "ai_failed");
  }
}

/**
 * Reference options a user may answer with. MDA questions list every active
 * MDA, with the user's own marked, so a row naming another MDA can be answered
 * truthfully (and then stays blocked by the grant check) rather than forced
 * onto the user's MDA.
 */
async function answerOptions(client: Db, profile: AppProfile, batch: ImportBatchRow): Promise<Partial<Record<ImportField, ReferenceOption[]>>> {
  const ref = await loadReference(client);
  const permitted = permittedMdaIds(profile, batch.ledger_type);
  const active = <T extends { active: boolean }>(values: T[]) => values.filter((v) => v.active);
  return {
    mda: active(ref.mdas).map((m) => ({
      id: m.id,
      name: m.name,
      aliases: [m.code, ...(m.abbreviation ? [m.abbreviation] : [])],
      ...(permitted === "all" || permitted.has(m.id) ? {} : { note: "not your MDA — rows will stay blocked" }),
    })),
    programme_area: active(ref.programmeAreas).map(({ id, name }) => ({ id, name })),
    // Manual expenditure entry never offers the Unspecified source.
    funding_source: active(ref.fundingSources)
      .filter((s) => batch.ledger_type !== "expenditure" || s.slug !== UNSPECIFIED_FUNDING_SOURCE_SLUG)
      .map(({ id, name }) => ({ id, name })),
    expenditure_category: active(ref.expenditureCategories).map(({ id, name }) => ({ id, name })),
    payment_method: active(ref.paymentMethods).map(({ id, name }) => ({ id, name })),
    lga: active(ref.lgas).map(({ id, name }) => ({ id, name })),
  };
}

const QUESTION_CODES = new Set(["reference_unknown", "reference_ambiguous", "matched_by_answer"]);

/**
 * One question per distinct unmatched value of an answerable field, with the
 * rows it affects. Includes values already answered so the user can revise.
 */
export function collectQuestions(batch: ImportBatchRow, rows: ImportRowRecord[]): ValueQuestion[] {
  const fields = new Set<string>(ALIASABLE_FIELDS);
  const byKey = new Map<string, ValueQuestion>();
  for (const row of rows) {
    if (row.user_excluded) continue;
    for (const issue of row.issues) {
      if (!issue.field || !fields.has(issue.field) || !QUESTION_CODES.has(issue.code)) continue;
      const header = batch.mapping[issue.field];
      const text = header ? (row.overrides[header] ?? row.raw[header] ?? "").trim() : "";
      if (!text) continue;
      const key = `${issue.field}:${normalizeKey(text)}`;
      const existing = byKey.get(key);
      if (existing) existing.rows++;
      else byKey.set(key, { field: issue.field, source_text: text, rows: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => b.rows - a.rows).slice(0, 100);
}

export async function questionsForBatch(client: Db, profile: AppProfile, batch: ImportBatchRow, rows: ImportRowRecord[]): Promise<ValueQuestionView[]> {
  const questions = collectQuestions(batch, rows);
  if (!questions.length) return [];
  const options = await answerOptions(client, profile, batch);
  const matches = aiState(batch).value_matches?.matches ?? [];
  return questions.map((q) => ({
    ...q,
    key: `${q.field}:${normalizeKey(q.source_text)}`,
    answer: aliasFor(batch.options as ImportOptions, q.field, q.source_text),
    options: options[q.field] ?? [],
    suggestion: matches.find((m) => m.field === q.field && normalizeKey(m.source_text) === normalizeKey(q.source_text)) ?? null,
  }));
}

export async function suggestValuesWithAi(client: Db, profile: AppProfile, batchId: string, model?: LanguageModel): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  guardAiCall(batch);
  const rows = await loadRows(client, batchId);
  const open = collectQuestions(batch, rows).filter((q) => aliasFor(batch.options as ImportOptions, q.field, q.source_text) === undefined);
  if (!open.length) throw new ImportError("There are no unanswered value questions.");
  const options = await answerOptions(client, profile, batch);
  const state = aiState(batch);
  const calls = logCall(state, profile, "suggest_values", `${open.length} unmatched values + reference names`);
  try {
    const matches = await suggestValueMatches(open.slice(0, 50), options, model);
    await saveAiState(client, batch, { ...state, calls, value_matches: { matches, model: importModelId(), at: new Date().toISOString() } });
  } catch (error) {
    await saveAiState(client, batch, { ...state, calls });
    throw new ImportError(`The AI matching request failed (${(error as Error).message}). Answer the questions manually.`, 502, "ai_failed");
  }
}

/** Store the user's answers and re-check the batch. */
export async function answerValueQuestions(
  client: Db,
  profile: AppProfile,
  batchId: string,
  answers: Array<{ field: string; source_text: string; ref_id: string | null }>,
): Promise<void> {
  const batch = await loadBatch(client, batchId);
  assertOpen(batch, profile);
  const options = await answerOptions(client, profile, batch);
  const aliases: NonNullable<ImportOptions["value_aliases"]> = { ...((batch.options as ImportOptions).value_aliases ?? {}) };
  for (const answer of answers) {
    if (!(ALIASABLE_FIELDS as readonly string[]).includes(answer.field)) throw new ImportError(`"${answer.field}" can't be answered here; fix those rows individually.`);
    const field = answer.field as ImportField;
    if (answer.ref_id && !(options[field] ?? []).some((o) => o.id === answer.ref_id)) {
      throw new ImportError("That answer isn't an active value you can use.", 403, "forbidden");
    }
    aliases[field] = { ...(aliases[field] ?? {}), [normalizeKey(answer.source_text)]: answer.ref_id };
  }
  const { error } = await client
    .from("import_batches")
    .update({ options: { ...batch.options, value_aliases: aliases }, plan_hash: null })
    .eq("id", batchId);
  throwIf(error, "Saving your answers");
  await revalidateBatch(client, profile, batchId);
}

export function batchAiView(batch: ImportBatchRow) {
  const state = aiState(batch);
  return {
    configured: aiConfigured(),
    model: importModelId(),
    calls_used: state.calls?.length ?? 0,
    calls_limit: MAX_AI_CALLS_PER_BATCH,
    heuristics: state.heuristics ?? null,
    classification: state.classification ?? null,
    classification_error: state.classification_error ?? null,
    mapping_suggestions: state.mapping_suggestions ?? null,
  };
}
