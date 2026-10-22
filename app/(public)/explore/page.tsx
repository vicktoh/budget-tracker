import type { Metadata } from "next";
import Link from "next/link";
import { Explorer } from "@/components/public/explorer";
import { PageHero } from "@/components/public/page-hero";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { buildExplorerData, latestReport } from "@/lib/public/model";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Explore the numbers",
  description: "Kano State health budget and spending by MDA, programme and function, by type of spending and year.",
};

export default async function ExplorePage() {
  const ds = await loadPublicDataset();
  const data = buildExplorerData(ds, (r) => reportPdfUrl(r));
  const latest = latestReport(data);

  return (
    <>
      <PageHero eyebrow="Explore" title="All the numbers, your way">
        Look at health spending by MDA, programme or function; pick a type of spending and a period; or compare the same point
        across years.
      </PageHero>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {latest ? <Explorer data={data} initialYear={latest.year} initialQuarter={latest.quarter} /> : <p>No published figures yet.</p>}
        <p className="mt-12 text-sm text-[var(--pub-ink-2)]">
          Looking for money coming in — fees, grants and transfers?{" "}
          <Link href="/revenue" className="font-semibold text-[var(--pub-brand-deep)] underline underline-offset-2">
            See revenue by MDA
          </Link>
          .
        </p>
      </div>
    </>
  );
}
