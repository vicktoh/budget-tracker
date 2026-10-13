import { NextResponse } from "next/server";
import { z } from "zod";
import { loadBatch, loadRows } from "@/lib/imports/server";
import { buildIssueReportCsv } from "@/lib/imports/summary";
import { importErrorResponse, importRouteContext } from "@/lib/imports/route-context";

export const runtime = "nodejs";

/** Downloadable issue report: every staged row, its disposition and issues. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }
    const { client } = await importRouteContext();
    const batch = await loadBatch(client, id);
    const rows = await loadRows(client, id);
    const csv = buildIssueReportCsv(
      batch.headers,
      rows.map((row) => ({
        sourceRowNumber: row.source_row_number,
        disposition: row.disposition,
        issues: row.issues,
        raw: row.raw,
        overrides: row.overrides,
        committedPublicId: row.committed_public_id,
      })),
    );
    const base = batch.source_file_name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base || "import"}-issues.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return importErrorResponse(error);
  }
}
