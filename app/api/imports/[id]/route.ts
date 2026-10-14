import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelBatch,
  commitBatch,
  loadBatch,
  loadRows,
  permittedMdaOptions,
  referenceLabels,
  selectSheet,
  updateMapping,
  updateRow,
} from "@/lib/imports/server";
import { importErrorResponse, importRouteContext } from "@/lib/imports/route-context";
import {
  analyzeWorkbook,
  answerValueQuestions,
  batchAiView,
  questionsForBatch,
  suggestMappingWithAi,
  suggestValuesWithAi,
} from "@/lib/imports/ai/actions";

export const runtime = "nodejs";
// AI requests on large workbooks can take a while.
export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

const uuid = z.string().uuid();

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select_sheet"), sheet_name: z.string().min(1).max(200) }),
  z.object({
    action: z.literal("set_mapping"),
    mapping: z.record(z.string(), z.string().max(300)),
    options: z.object({
      date_convention: z.enum(["dmy", "mdy"]).nullable(),
      default_mda_id: uuid.nullable(),
    }),
  }),
  z.object({
    action: z.literal("update_row"),
    row_id: uuid,
    overrides: z.record(z.string(), z.string()).optional(),
    user_excluded: z.boolean().optional(),
  }),
  z.object({ action: z.literal("commit"), plan_hash: z.string().regex(/^[0-9a-f]{64}$/) }),
  z.object({ action: z.literal("analyze_workbook") }),
  z.object({ action: z.literal("suggest_mapping") }),
  z.object({ action: z.literal("suggest_values") }),
  z.object({
    action: z.literal("answer_values"),
    answers: z
      .array(z.object({ field: z.string().max(40), source_text: z.string().min(1).max(500), ref_id: uuid.nullable() }))
      .min(1)
      .max(100),
  }),
  z.object({ action: z.literal("cancel") }),
]);

async function detail(id: string) {
  const { client, profile } = await importRouteContext();
  const [batch, rows, labels, permittedByLedger] = await Promise.all([
    loadBatch(client, id),
    loadRows(client, id),
    referenceLabels(client),
    Promise.all([
      permittedMdaOptions(client, profile, "funding"),
      permittedMdaOptions(client, profile, "expenditure"),
    ]),
  ]);
  const open = batch.status !== "completed" && batch.status !== "cancelled";
  return {
    batch,
    rows,
    labels,
    permitted_mdas: permittedByLedger[batch.ledger_type === "funding" ? 0 : 1],
    is_owner: batch.created_by === profile.id,
    ai: batchAiView(batch),
    questions: open ? await questionsForBatch(client, profile, batch, rows) : [],
  };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    return NextResponse.json(await detail(id));
  } catch (error) {
    return importErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid import request.", issues: parsed.error.issues }, { status: 400 });
    }
    const { client, profile } = await importRouteContext();
    const body = parsed.data;
    switch (body.action) {
      case "select_sheet":
        await selectSheet(client, profile, id, body.sheet_name);
        break;
      case "set_mapping":
        await updateMapping(client, profile, id, body.mapping, body.options);
        break;
      case "update_row":
        await updateRow(client, profile, id, body.row_id, {
          overrides: body.overrides,
          user_excluded: body.user_excluded,
        });
        break;
      case "commit": {
        const receipt = await commitBatch(client, profile, id, body.plan_hash);
        return NextResponse.json({ receipt, ...(await detail(id)) });
      }
      case "cancel":
        await cancelBatch(client, profile, id);
        break;
      case "analyze_workbook":
        await analyzeWorkbook(client, profile, id);
        break;
      case "suggest_mapping":
        await suggestMappingWithAi(client, profile, id);
        break;
      case "suggest_values":
        await suggestValuesWithAi(client, profile, id);
        break;
      case "answer_values":
        await answerValueQuestions(client, profile, id, body.answers);
        break;
    }
    return NextResponse.json(await detail(id));
  } catch (error) {
    return importErrorResponse(error);
  }
}
