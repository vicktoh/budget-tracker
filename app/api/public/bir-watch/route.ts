import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/server/auth";
import { authorizeNotificationJob } from "@/lib/server/notifications";
import { PUBLIC_DATASET_TAG } from "@/lib/public/dataset";

export const dynamic = "force-dynamic";

const ARCHIVE_PAGE = "https://budget.kn.gov.ng/budget-performance-report/";

/** Same file regardless of http/https or host spelling. */
function fileKey(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").toLowerCase();
}

/** Best guess of year/quarter from a link label or file name; admins confirm on review. */
function guessPeriod(text: string): { year: number; quarter: number; fullYear: boolean } | null {
  const year = Number(text.match(/20\d\d/)?.[0]);
  if (!year) return null;
  const q = text.match(/\bQ([1-4])\b/i)?.[1] ?? text.match(/\b(first|second|third|fourth)\b/i)?.[1];
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
  const quarter = q ? Number(q) || words[q.toLowerCase()] : 4;
  return { year, quarter, fullYear: !q };
}

/**
 * Weekly check of budget.kn.gov.ng for new Budget Performance Reports (pg_cron
 * `bir-archive-watch`, or an admin). New PDFs are recorded unlisted and admins
 * are notified; nothing is downloaded, parsed or published automatically;
 * see docs/public-site.md for the review steps.
 */
export async function POST(request: Request) {
  try {
    await authorizeNotificationJob(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(ARCHIVE_PAGE, { headers: { "User-Agent": "kanohealthbudget.org archive watcher" }, cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: `Archive page returned ${res.status}` }, { status: 502 });
  const html = await res.text();
  const links = [...html.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    url: m[1],
    label: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  }));

  const db = createServiceClient();
  const { data: known, error } = await db.from("bir_reports").select("source_url, slug");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const knownKeys = new Set((known ?? []).map((r) => fileKey(r.source_url)));
  const knownSlugs = new Set((known ?? []).map((r) => r.slug));

  const found: { slug: string; url: string; label: string }[] = [];
  for (const link of links) {
    if (knownKeys.has(fileKey(link.url))) continue;
    const period = guessPeriod(`${link.label} ${link.url}`);
    if (!period) continue;
    let slug = period.fullYear ? `${period.year}-FY` : `${period.year}-Q${period.quarter}`;
    if (knownSlugs.has(slug)) slug = `${slug}-new-${Date.now().toString(36)}`;
    const { error: insertError } = await db.from("bir_reports").insert({
      slug,
      fiscal_year: period.year,
      quarter: period.quarter,
      full_year_only: period.fullYear,
      title: link.label || `Kano State ${period.year} report`,
      source_url: link.url,
      data_status: "download_only",
      data_note: "New report found on budget.kn.gov.ng; waiting for review.",
      is_listed: false,
    });
    if (!insertError) {
      found.push({ slug, url: link.url, label: link.label });
      knownKeys.add(fileKey(link.url));
      knownSlugs.add(slug);
    }
  }

  if (found.length) {
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
    if (admins?.length) {
      await db.from("notifications").insert(
        admins.map((a) => ({
          recipient_id: a.id,
          notification_type: "bir_report_found",
          title: `${found.length} new Budget Performance Report${found.length === 1 ? "" : "s"} on budget.kn.gov.ng`,
          body: `${found.map((f) => f.label || f.slug).join("; ")}. Mirror, parse and check it before it appears on the public site (docs/public-site.md).`,
        })),
      );
    }
  }

  revalidateTag(PUBLIC_DATASET_TAG);
  return NextResponse.json({ checked: links.length, found });
}
