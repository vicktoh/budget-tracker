import { NextResponse } from "next/server";
import { createBatch, importableLedgers, listBatches, MAX_FILE_BYTES } from "@/lib/imports/server";
import { importErrorResponse, importRouteContext } from "@/lib/imports/route-context";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const { client, profile } = await importRouteContext();
    const batches = await listBatches(client, profile);
    return NextResponse.json({ batches, ledgers: importableLedgers(profile), max_file_bytes: MAX_FILE_BYTES });
  } catch (error) {
    return importErrorResponse(error);
  }
}

/** Upload a CSV/XLSX file and create a draft batch. Nothing reaches the ledger. */
export async function POST(request: Request) {
  try {
    const { client, profile } = await importRouteContext();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const ledger = form?.get("ledger_type");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a .csv or .xlsx file." }, { status: 400 });
    }
    if (ledger !== "funding" && ledger !== "expenditure") {
      return NextResponse.json({ error: "Choose funding or expenditure entries." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });
    }
    const batchId = await createBatch({
      client,
      profile,
      ledger,
      fileName: file.name,
      contentType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ id: batchId }, { status: 201 });
  } catch (error) {
    return importErrorResponse(error);
  }
}
