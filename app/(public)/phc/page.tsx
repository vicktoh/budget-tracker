import type { Metadata } from "next";
import { PhcView } from "@/components/public/phc-view";
import { PageHero } from "@/components/public/page-hero";
import { loadPublicDataset } from "@/lib/public/dataset";
import { buildHealthProgrammes } from "@/lib/public/health-programmes";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Health programmes",
  description:
    "What Kano State budgets for immunisation, malaria, nutrition, mothers and children and other health programmes, across all health MDAs.",
};

export default async function PhcPage() {
  // Same figures Ask AI reads (getHealthProgrammes), so the two always agree.
  const reports = buildHealthProgrammes(await loadPublicDataset());

  return (
    <>
      <PageHero eyebrow="Health programmes" title="Health programmes, across every MDA">
        What Kano State budgets for immunisation, malaria, nutrition, mothers and children and other health programmes, and
        which ministries and agencies fund them.
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        {reports.length ? (
          <div className="mt-10">
            <PhcView reports={reports} />
          </div>
        ) : (
          <p className="mt-10 text-[var(--pub-muted)]">No report with a primary health care section has been published yet.</p>
        )}
      </div>
    </>
  );
}
