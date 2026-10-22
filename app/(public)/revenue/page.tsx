import type { Metadata } from "next";
import { PageHero } from "@/components/public/page-hero";
import { RevenueView, type Contributor, type RevenueMda, type RevenuePart } from "@/components/public/revenue-view";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";
import { buildExplorerData, latestReport, lensRows, periodLabel, sectorValue, titleCase } from "@/lib/public/model";
import { REVENUE_ORDER, classifyRevenue, type RevenueSourceKey } from "@/lib/public/revenue-sources";
import revenue2026 from "@/lib/public/revenue-budgets-2026.json";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Revenue",
  description: "Where Kano State's health MDAs expect their revenue to come from — fees, local governments, federal grants and donors — and how much they have collected.",
};

/** Approved revenue budget lines by fiscal year (scripts/public/export-revenue-budgets.ts). */
const REVENUE_BUDGETS: Record<number, typeof revenue2026> = { 2026: revenue2026 };

function parts(lines: typeof revenue2026.lines): RevenuePart[] {
  const sums = new Map<RevenueSourceKey, number>();
  for (const l of lines) {
    const k = classifyRevenue(l.economicCode, l.description);
    sums.set(k, (sums.get(k) ?? 0) + l.amount);
  }
  return REVENUE_ORDER.filter((k) => sums.has(k)).map((k) => ({ key: k, amount: sums.get(k)! }));
}

/**
 * The lines behind each source. Grants and transfers are listed line by line;
 * fees and other income (dozens of small lines) are grouped per MDA.
 */
function contributorsBySource(lines: typeof revenue2026.lines, mdaName: (code: string) => string) {
  const out: Partial<Record<RevenueSourceKey, Contributor[]>> = {};
  for (const l of lines) {
    const key = classifyRevenue(l.economicCode, l.description);
    const list = (out[key] ??= []);
    if (key === "fees") {
      const existing = list.find((c) => c.mda === mdaName(l.mdaCode));
      if (existing) existing.amount += l.amount;
      else list.push({ label: "Fees and charges", mda: mdaName(l.mdaCode), amount: l.amount });
    } else {
      list.push({ label: titleCase(l.description), mda: mdaName(l.mdaCode), amount: l.amount });
    }
  }
  for (const list of Object.values(out)) list!.sort((a, b) => b.amount - a.amount);
  return out;
}

export default async function RevenuePage() {
  const ds = await loadPublicDataset();
  const data = buildExplorerData(ds, (r) => reportPdfUrl(r));
  const latest = latestReport(data);
  if (!latest) {
    return (
      <>
        <PageHero eyebrow="Revenue" title="Where health MDAs' money comes from" />
        <p className="mx-auto max-w-6xl px-4 py-10 text-[var(--pub-muted)] sm:px-6">No published figures yet.</p>
      </>
    );
  }
  const { year, quarter } = latest;
  const sector = sectorValue(data, year, quarter, "revenue", "total");
  const budgetLines = REVENUE_BUDGETS[year]?.lines ?? [];
  const mdaNames = new Map(data.entities.mda.map((e) => [e.code, e.short]));
  const mdas: RevenueMda[] = lensRows(data, year, quarter, "revenue", "total")
    .filter((r) => (r.value.budget ?? 0) > 0 || (r.value.ytd ?? 0) > 0)
    .map((r) => {
      const lines = budgetLines.filter((l) => l.mdaCode === r.entity.code);
      return {
        code: r.entity.code,
        name: r.entity.name,
        short: r.entity.short,
        expected: r.value.budget,
        collected: r.value.ytd,
        share: r.value.share,
        parts: parts(lines),
        top: [...lines]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 2)
          .map((l) => ({ description: l.description, amount: l.amount })),
      };
    });

  return (
    <>
      <PageHero eyebrow="Revenue" title="Where health MDAs' money comes from">
        Health MDAs also receive money directly: hospital fees, local-government contributions, federal grants such as the Basic
        Health Care Provision Fund, and support from donors. Here is what each expects in {year}, and how much has come in.
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <RevenueView
          year={year}
          periodShort={periodLabel(year, quarter, true).replace(` ${year}`, "")}
          expected={sector?.budget ?? null}
          collected={sector?.ytd ?? null}
          share={sector?.share ?? null}
          source={sector?.source ?? null}
          composition={parts(budgetLines)}
          mdas={mdas}
          compositionSource={REVENUE_BUDGETS[year]?.source.replace(" (budget lines)", "") ?? null}
          contributors={contributorsBySource(budgetLines, (code) => mdaNames.get(code) ?? code)}
        />
      </div>
    </>
  );
}
