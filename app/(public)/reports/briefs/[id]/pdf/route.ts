import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { briefPdfUrl, loadPublicBriefs } from "@/lib/public/dataset";

/** Counts a brief download (no visitor data) and redirects to the published PDF. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = (await loadPublicBriefs()).find((b) => b.id === id);
  const url = brief ? briefPdfUrl(brief) : null;
  if (!brief || !url) return NextResponse.json({ error: "Brief not found." }, { status: 404 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && key) {
    const db = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    // Best effort: a failed count must never block the download.
    await db.rpc("record_public_download", { p_kind: "pdf", p_report_slug: null }).then(
      () => undefined,
      () => undefined,
    );
  }
  return NextResponse.redirect(url, 302);
}
