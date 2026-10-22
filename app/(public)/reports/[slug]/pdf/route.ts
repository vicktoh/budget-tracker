import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";

/** Counts a report download or source click (no visitor data) and redirects to the mirrored PDF, at ?page= if given. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ds = await loadPublicDataset();
  const report = ds.reports.find((r) => r.slug === slug);
  const page = Number(new URL(request.url).searchParams.get("page")) || null;
  const url = report ? reportPdfUrl(report, page) : null;
  if (!report || !url) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && key) {
    const db = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    // Best effort: a failed count must never block the download.
    await db.rpc("record_public_download", { p_kind: "pdf", p_report_slug: slug }).then(
      () => undefined,
      () => undefined,
    );
  }
  return NextResponse.redirect(url, 302);
}
