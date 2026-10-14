/**
 * Monthly executive summary for Admins and Viewers (sent on the 7th).
 *
 * Every number comes from the same executive metrics module that feeds the
 * Commissioner overview (`computeExecutiveOverview`), so the email, the
 * /admin page and the assistant always agree. The narrative is generated from
 * fixed rules over those numbers — no free-form text, nothing invented — and
 * data gaps are stated rather than papered over.
 */
import {
  computeExecutiveOverview,
  computeProgrammePerformance,
  LOW_UTILISATION,
  UNMAPPED_PROGRAMME,
  type MdaFlag,
  type MdaPerformance,
} from "@/lib/reporting/executive";
import type { EconomicClass } from "@/lib/reporting/economic-class";
import type { ReportingDataset } from "@/lib/reporting/types";
import {
  AMBER,
  bulletList,
  button,
  callout,
  coloured,
  dataTable,
  emailShell,
  escapeHtml,
  eyebrow,
  footer,
  GREEN,
  heading,
  htmlToText,
  link,
  muted,
  OK,
  paragraph,
  progressBar,
  RED,
  sectionTitle,
  statTiles,
  type RenderedEmail,
} from "@/lib/notifications/email-layout";
import {
  formatDay,
  formatDayMonth,
  formatMonthRuns,
  formatNairaShort,
  formatPct,
  joinList,
  kanoDateParts,
  MONTH_NAMES,
  monthKey,
  previousKanoMonth,
  quarterOfMonth,
  shortMdaName,
} from "@/lib/notifications/format";

const e = escapeHtml;

/** Flags that put an MDA on the "falling behind" list. */
const LAGGING_FLAGS: MdaFlag[] = ["not_reporting", "no_spend", "low_utilisation", "no_release", "low_release"];
const LAGGING_TABLE_LIMIT = 9;
const NO_USER_NAME_LIMIT = 8;

export type DirectoryUser = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  lastSignInAt: string | null;
  banned: boolean;
};

export type TrackingTone = "red" | "amber" | "ok";

export type ExecutiveSummaryMda = {
  id: string;
  name: string;
  short: string;
  budget: number;
  released: number;
  spent: number;
  utilisation: number | null;
  releaseRate: number | null;
  unspentRelease: number;
  tracking: { label: string; tone: TrackingTone };
  reportingStatus: MdaPerformance["reporting_status"];
  userCount: number;
  lagging: boolean;
  classes: Array<{ budget_class: EconomicClass; label: string; budget: number; spent: number; utilisation: number | null }>;
};

export type ExecutiveSummaryModel = {
  appUrl: string;
  /** Month the summary is sent in, e.g. October 2026. */
  issue: { year: number; month: number; key: string };
  fiscalYear: number;
  subject: string;
  headline: string;
  subtitleHtml: string;
  glanceHtml: string[];
  totals: { budget: number; released: number; spent: number; balance: number; utilisation: number | null; releaseRate: number | null };
  mdaCount: number;
  upToDateCount: number;
  trackingMonthLabel: string | null;
  components: Array<{ label: string; budget: number; spent: number; utilisation: number | null; weak: boolean }>;
  classInsightsHtml: string[];
  mdas: ExecutiveSummaryMda[];
  laggingTable: ExecutiveSummaryMda[];
  alsoNeverReported: string[];
  alsoMissedLatest: string[];
  alsoLowUtilisation: string[];
  upToDate: Array<{ short: string; utilisation: number | null }>;
  directory: Array<{ mdaName: string; users: Array<{ name: string; email: string; lastSignInAt: string | null }> }>;
  mdasWithoutUsers: { count: number; names: string[] };
  programmes: { noSpend: string[]; best: { name: string; utilisation: number } | null };
  dataNotes: string[];
  pdfFilename: string;
  quartersWithActuals: number[];
  dataThrough: string | null;
  publications: Array<{ quarter: number; version: number }>;
};

function trackingFor(mda: MdaPerformance): { label: string; tone: TrackingTone } {
  if (mda.reporting_status === "never") return { label: "Never submitted", tone: "red" };
  if (mda.reporting_status === "missed_latest") {
    return {
      label: `Missing ${formatMonthRuns(mda.missing_months)}`,
      tone: mda.missing_months.length >= 3 ? "red" : "amber",
    };
  }
  return { label: "Up to date", tone: "ok" };
}

function quartersLabel(quarters: number[]): string {
  if (!quarters.length) return "no quarters";
  const last = Math.max(...quarters);
  return last === 1 ? "Q1" : `Q1–Q${last}`;
}

export function executiveSummaryDedupeKey(issueKey: string, userId: string): string {
  return `executive_summary:${issueKey}:${userId}`;
}

export function buildExecutiveSummary(input: {
  runDate: Date;
  appUrl: string;
  dataset: ReportingDataset;
  mdaMeta: Array<{ id: string; name: string; abbreviation: string | null }>;
  users: DirectoryUser[];
  memberships: Array<{ user_id: string; mda_id: string }>;
}): ExecutiveSummaryModel {
  const { dataset, appUrl } = input;
  const issueParts = kanoDateParts(input.runDate);
  const issue = { year: issueParts.year, month: issueParts.month, key: monthKey(issueParts.year, issueParts.month) };
  // The summary reports on the fiscal year of the month just ended.
  const covered = previousKanoMonth(input.runDate);
  const fiscalYear = covered.year;
  const currentQuarter = quarterOfMonth(covered.month);

  const overview = computeExecutiveOverview(dataset, fiscalYear);
  const programmes = computeProgrammePerformance(dataset, fiscalYear);
  const { totals, coverage } = overview;
  const abbreviation = new Map(input.mdaMeta.map((m) => [m.id, m.abbreviation]));
  const short = (mda: { mda_id: string; mda_name: string }) => shortMdaName(mda.mda_name, abbreviation.get(mda.mda_id));

  // Active MDA users per MDA (the people a monthly reminder can reach).
  const usersById = new Map(input.users.map((u) => [u.id, u]));
  const mdaUsers = new Map<string, Map<string, DirectoryUser>>();
  for (const membership of input.memberships) {
    const user = usersById.get(membership.user_id);
    if (!user || user.role !== "mda_user" || user.banned || !user.email) continue;
    const byUser = mdaUsers.get(membership.mda_id) ?? new Map<string, DirectoryUser>();
    byUser.set(user.id, user);
    mdaUsers.set(membership.mda_id, byUser);
  }

  const mdas: ExecutiveSummaryMda[] = overview.mdas.map((mda) => ({
    id: mda.mda_id,
    name: mda.mda_name,
    short: short(mda),
    budget: mda.budget,
    released: mda.released,
    spent: mda.spent,
    utilisation: mda.utilisation,
    releaseRate: mda.release_rate,
    unspentRelease: Math.max(0, mda.released - mda.spent),
    tracking: trackingFor(mda),
    reportingStatus: mda.reporting_status,
    userCount: mdaUsers.get(mda.mda_id)?.size ?? 0,
    lagging: mda.budget > 0 && mda.flags.some((flag) => LAGGING_FLAGS.includes(flag)),
    classes: mda.components
      .filter((c) => c.budget_class !== "other" || c.budget > 0)
      .map((c) => ({ budget_class: c.budget_class, label: c.label, budget: c.budget, spent: c.spent, utilisation: c.utilisation })),
  }));

  const notReporting = mdas.filter((m) => m.reportingStatus !== "up_to_date");
  const upToDate = mdas.filter((m) => m.reportingStatus === "up_to_date");
  const lagging = mdas.filter((m) => m.lagging).sort((a, b2) => b2.budget - a.budget);
  const laggingTable = lagging.slice(0, LAGGING_TABLE_LIMIT);
  const rest = lagging.slice(LAGGING_TABLE_LIMIT);
  const withoutUsers = mdas.filter((m) => m.userCount === 0).sort((a, b2) => b2.budget - a.budget);

  const lastQuarter = coverage.quarters_with_actuals.length ? Math.max(...coverage.quarters_with_actuals) : 0;
  const trackingMonthLabel = coverage.tracking_horizon ? MONTH_NAMES[coverage.tracking_horizon - 1] : null;
  const currentQuarterEntries =
    dataset.funding.filter((f) => f.fiscal_year === fiscalYear && f.quarter === currentQuarter).length +
    dataset.expenditure.filter((x) => x.fiscal_year === fiscalYear && x.quarter === currentQuarter).length;

  // ----- At a glance --------------------------------------------------------
  const glanceHtml: string[] = [];
  {
    const util = totals.utilisation ?? 0;
    const sentences: string[] = [];
    let opener = `With ${quartersLabel(coverage.quarters_with_actuals)} actuals in, the health sector has spent ` +
      `<strong>${e(formatNairaShort(totals.spent))} of its ${e(formatNairaShort(totals.budget))}</strong> approved budget (${formatPct(totals.utilisation)})`;
    if (lastQuarter > 0) {
      const pace = lastQuarter * 0.25;
      const gapPts = Math.round((pace - util) * 100);
      if (Math.abs(gapPts) <= 2) opener += `, in line with a straight-line pace of ${Math.round(pace * 100)}%.`;
      else opener += `, about ${Math.abs(gapPts)} points ${gapPts > 0 ? "behind" : "ahead of"} a straight-line pace of ${Math.round(pace * 100)}%.`;
    } else {
      opener += ".";
    }
    sentences.push(opener);

    const releaseGap = (totals.release_rate ?? 0) - util;
    const idle = [...mdas].sort((a, b2) => b2.unspentRelease - a.unspentRelease)[0];
    const totalIdle = mdas.reduce((sum, m) => sum + m.unspentRelease, 0);
    if (releaseGap < 0.05) {
      sentences.push(
        `Releases of ${e(formatNairaShort(totals.released))} (${formatPct(totals.release_rate)}) are only slightly ahead of spending, ` +
          "so <strong>slow cash release, not slow spending, is the main constraint</strong>.",
      );
      if (idle && idle.unspentRelease >= 1e9) {
        sentences.push(`${e(idle.short)} is the exception, holding ${e(formatNairaShort(idle.unspentRelease))} that has been released but not spent.`);
      }
    } else {
      sentences.push(
        `Releases of ${e(formatNairaShort(totals.released))} (${formatPct(totals.release_rate)}) run ${Math.round(releaseGap * 100)} points ahead of spending: ` +
          `MDAs hold <strong>${e(formatNairaShort(totalIdle))} released but unspent</strong>` +
          (idle && idle.unspentRelease > 0 ? `, the most at ${e(idle.short)} (${e(formatNairaShort(idle.unspentRelease))}).` : "."),
      );
    }
    glanceHtml.push(sentences.join(" "));

    const second: string[] = [];
    const bySpend = [...mdas].sort((a, b2) => b2.spent - a.spent);
    const topTwo = bySpend.slice(0, 2);
    const topShare = totals.spent > 0 ? topTwo.reduce((sum, m) => sum + m.spent, 0) / totals.spent : 0;
    if (topTwo.length === 2 && topShare >= 0.6) {
      second.push(`Spending is concentrated: <strong>${e(topTwo[0].short)} and ${e(topTwo[1].short)} account for ${Math.round(topShare * 100)}%</strong> of all expenditure.`);
    }
    const reportingClauses: string[] = [];
    if (trackingMonthLabel) {
      reportingClauses.push(
        `${upToDate.length < mdas.length / 2 ? "only " : ""}${upToDate.length} of ${mdas.length} MDAs submitted ${trackingMonthLabel} monthly tracking`,
      );
    }
    if (currentQuarterEntries === 0) reportingClauses.push(`no MDA has recorded a Q${currentQuarter} entry`);
    if (withoutUsers.length) {
      reportingClauses.push(`<strong>${withoutUsers.length} of ${mdas.length} MDAs have nobody on the platform</strong> to receive reminders`);
    }
    if (reportingClauses.length) {
      const lead = upToDate.length < mdas.length / 2 ? "Reporting is the weakest area: " : "On reporting, ";
      const joined = joinList(reportingClauses);
      second.push(`${lead}${joined}.`);
    }
    if (second.length) glanceHtml.push(second.join(" "));
  }

  // ----- Economic classification -------------------------------------------
  const rated = overview.components.filter((c) => c.budget_class !== "other" && c.budget > 0);
  const weakest = [...rated].sort((a, b2) => (a.utilisation ?? 0) - (b2.utilisation ?? 0))[0];
  const components = overview.components
    .filter((c) => c.budget > 0 || c.spent > 0)
    .map((c) => ({
      label: c.label,
      budget: c.budget,
      spent: c.spent,
      utilisation: c.utilisation,
      weak: c.budget_class === weakest?.budget_class && (c.utilisation ?? 0) < LOW_UTILISATION,
    }));

  const classInsightsHtml: string[] = [];
  const classRows = (cls: EconomicClass) =>
    mdas
      .map((m) => ({ mda: m, c: m.classes.find((c) => c.budget_class === cls) }))
      .filter((row): row is { mda: ExecutiveSummaryMda; c: ExecutiveSummaryMda["classes"][number] } => Boolean(row.c && row.c.budget > 0));

  if (weakest) {
    let text = `<strong>${e(weakest.label)} is the weakest class at ${formatPct(weakest.utilisation)}</strong>`;
    text += (weakest.utilisation ?? 0) < LOW_UTILISATION ? ", below the 25% low-utilisation threshold." : ".";
    const major = classRows(weakest.budget_class).filter((row) => row.c.budget >= weakest.budget * 0.1);
    const worst = major.sort((a, b2) => (a.c.utilisation ?? 0) - (b2.c.utilisation ?? 0))[0];
    if (worst && (worst.c.utilisation ?? 0) < LOW_UTILISATION) {
      text += ` ${e(worst.mda.short)} has used only ${formatPct(worst.c.utilisation)} of its ${e(weakest.label.toLowerCase())} allocation.`;
    }
    classInsightsHtml.push(text);
  }

  const largest = [...rated].sort((a, b2) => b2.budget - a.budget)[0];
  if (largest && largest.budget_class !== weakest?.budget_class) {
    const share = totals.budget > 0 ? largest.budget / totals.budget : 0;
    const major = classRows(largest.budget_class).filter((row) => row.c.budget >= largest.budget * 0.02);
    const leader = [...major].sort((a, b2) => (b2.c.utilisation ?? 0) - (a.c.utilisation ?? 0))[0];
    const slow = major.filter((row) => row.c.spent > 0 && (row.c.utilisation ?? 0) < 0.1);
    const zero = major.filter((row) => row.c.spent === 0);
    let text = `<strong>${e(largest.label)} is ${Math.round(share * 100)}% of the budget, at ${formatPct(largest.utilisation)}`;
    if (slow.length || zero.length) {
      text += ", and progress varies widely between MDAs.</strong>";
      if (leader && (leader.c.utilisation ?? 0) >= 0.1) text += ` ${e(leader.mda.short)} is at ${formatPct(leader.c.utilisation)}.`;
      if (slow.length) {
        const lo = Math.min(...slow.map((r) => r.c.utilisation ?? 0));
        const hi = Math.max(...slow.map((r) => r.c.utilisation ?? 0));
        const range = Math.round(lo * 100) === Math.round(hi * 100) ? `${Math.round(hi * 100)}%` : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
        text += ` ${e(joinList(slow.map((r) => r.mda.short)))} ${slow.length > 1 ? "are" : "is"} at ${range}`;
        text += zero.length ? `, and ${e(joinList(zero.map((r) => r.mda.short)))} ${zero.length > 1 ? "have" : "has"} spent nothing.` : ".";
      } else if (zero.length) {
        text += ` ${e(joinList(zero.map((r) => r.mda.short)))} ${zero.length > 1 ? "have" : "has"} spent nothing.`;
      }
    } else {
      text += ".</strong>";
    }
    classInsightsHtml.push(text);
  }

  for (const cls of rated) {
    if (cls.budget_class === weakest?.budget_class || cls.budget_class === largest?.budget_class) continue;
    const gap = Math.abs((cls.utilisation ?? 0) - (totals.release_rate ?? 0));
    classInsightsHtml.push(
      `<strong>${e(cls.label)} is at ${formatPct(cls.utilisation)}</strong>${gap < 0.05 ? ", broadly in line with releases." : "."}`,
    );
  }

  const yearPublications = dataset.publications
    .filter((pub) => pub.fiscal_year === fiscalYear)
    .map((pub) => ({ quarter: pub.quarter, version: pub.version }));
  const publishedQuarters = [...new Set(yearPublications.map((pub) => pub.quarter))].sort();
  const openActualQuarters = coverage.quarters_with_actuals.filter((q) => !publishedQuarters.includes(q as 1 | 2 | 3 | 4));
  if (!publishedQuarters.length) {
    classInsightsHtml.push(
      `<strong>No ${fiscalYear} quarter has been published.</strong>` +
        (openActualQuarters.length
          ? ` ${e(joinList(openActualQuarters.map((q) => `Q${q}`)))} entries are still editable, so the figures above can change until those reports are published.`
          : ""),
    );
  } else {
    classInsightsHtml.push(
      `<strong>Published:</strong> ${e(joinList(publishedQuarters.map((q) => `Q${q}`)))} ${fiscalYear}.` +
        (openActualQuarters.length
          ? ` ${e(joinList(openActualQuarters.map((q) => `Q${q}`)))} ${openActualQuarters.length > 1 ? "are" : "is"} still open, so ${openActualQuarters.length > 1 ? "their" : "its"} figures can change.`
          : ""),
    );
  }

  // ----- Users --------------------------------------------------------------
  const directory = mdas
    .filter((m) => m.userCount > 0)
    .map((m) => ({
      mdaName: m.name,
      users: [...(mdaUsers.get(m.id)?.values() ?? [])]
        .map((u) => ({ name: u.name, email: u.email as string, lastSignInAt: u.lastSignInAt }))
        .sort((a, b2) => (b2.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "") || a.name.localeCompare(b2.name)),
    }));

  // ----- Programmes ---------------------------------------------------------
  const noSpend = programmes
    .filter((p) => p.flags.includes("no_funding") && p.name !== UNMAPPED_PROGRAMME)
    .map((p) => p.name);
  const bestProgramme = programmes
    .filter((p) => p.planned > 0 && p.utilisation !== null && p.name !== UNMAPPED_PROGRAMME)
    .sort((a, b2) => (b2.utilisation ?? 0) - (a.utilisation ?? 0))[0];

  const subtitleParts = [
    coverage.data_through
      ? `Official actuals through <strong>${e(formatDay(coverage.data_through))}</strong> (${quartersLabel(coverage.quarters_with_actuals)})`
      : "No official actuals recorded yet",
  ];
  if (trackingMonthLabel) subtitleParts.push(`monthly tracking through ${trackingMonthLabel}`);
  if (currentQuarterEntries === 0) subtitleParts.push(`no Q${currentQuarter} entries received yet`);

  const issueMonthName = MONTH_NAMES[issue.month - 1];
  return {
    appUrl,
    issue,
    fiscalYear,
    subject: `${issueMonthName} summary: ${formatPct(totals.utilisation)} of FY${fiscalYear} health budget spent; ${notReporting.length} MDAs behind on reporting`,
    headline: `FY${fiscalYear} health budget: ${formatPct(totals.utilisation)} spent, ${notReporting.length} of ${mdas.length} MDAs behind on reporting`,
    subtitleHtml: subtitleParts.join(" · ") + ".",
    glanceHtml,
    totals: { ...totals, releaseRate: totals.release_rate },
    mdaCount: mdas.length,
    upToDateCount: upToDate.length,
    trackingMonthLabel,
    components,
    classInsightsHtml,
    mdas,
    laggingTable,
    alsoNeverReported: rest.filter((m) => m.reportingStatus === "never").map((m) => m.short),
    alsoMissedLatest: rest.filter((m) => m.reportingStatus === "missed_latest").map((m) => m.short),
    alsoLowUtilisation: rest.filter((m) => m.reportingStatus === "up_to_date").map((m) => m.short),
    upToDate: upToDate.sort((a, b2) => b2.budget - a.budget).map((m) => ({ short: m.short, utilisation: m.utilisation })),
    directory,
    mdasWithoutUsers: { count: withoutUsers.length, names: withoutUsers.slice(0, NO_USER_NAME_LIMIT).map((m) => m.short) },
    programmes: {
      noSpend,
      best: bestProgramme ? { name: bestProgramme.name, utilisation: bestProgramme.utilisation ?? 0 } : null,
    },
    dataNotes: coverage.gaps,
    pdfFilename: `Kano-Health-BIR-FY${fiscalYear}-${quartersLabel(coverage.quarters_with_actuals).replace("–", "-")}.pdf`,
    quartersWithActuals: coverage.quarters_with_actuals,
    dataThrough: coverage.data_through,
    publications: yearPublications,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const TONE_COLOUR: Record<TrackingTone, string> = { red: RED, amber: AMBER, ok: OK };

export function renderExecutiveSummaryEmail(
  model: ExecutiveSummaryModel,
  { hasAttachment = true }: { hasAttachment?: boolean } = {},
): RenderedEmail {
  const { appUrl } = model;
  const issueLabel = `${MONTH_NAMES[model.issue.month - 1]} ${model.issue.year}`;

  const classTable = dataTable({
    head: ["Class", "Approved", `Spent ${quartersLabel(model.quartersWithActuals)}`, "Utilisation"],
    align: ["left", "right", "right", "left"],
    rows: [
      ...model.components.map((c) => [
        e(c.label),
        `<span style="color:#5b5b5b;">${e(formatNairaShort(c.budget))}</span>`,
        `<span style="color:#5b5b5b;">${e(formatNairaShort(c.spent))}</span>`,
        `<div style="font-weight:600;margin-bottom:4px;">${formatPct(c.utilisation)}</div>${progressBar(c.utilisation ?? 0, c.weak ? RED : GREEN)}`,
      ]),
      [
        "<strong>Total</strong>",
        `<span style="color:#5b5b5b;">${e(formatNairaShort(model.totals.budget))}</span>`,
        `<span style="color:#5b5b5b;">${e(formatNairaShort(model.totals.spent))}</span>`,
        `<div style="font-weight:600;margin-bottom:4px;">${formatPct(model.totals.utilisation)}</div>${progressBar(model.totals.utilisation ?? 0)}`,
      ],
    ],
  });

  const laggingTable = model.laggingTable.length
    ? dataTable({
        head: ["MDA", "Spent", "Released", "Monthly tracking", "Users"],
        rows: model.laggingTable.map((m) => [
          `<a href="${e(`${appUrl}/admin/mdas/${m.id}`)}" style="color:#1a1a1a;font-weight:600;text-decoration:none;">${e(m.short)}</a>`,
          `${formatPct(m.utilisation)} ${muted(`of ${formatNairaShort(m.budget)}`)}`,
          formatPct(m.releaseRate) +
            (m.unspentRelease >= 1e9
              ? `<br><span style="font-size:11px;color:${AMBER};">${e(formatNairaShort(m.unspentRelease))} unspent</span>`
              : ""),
          coloured(m.tracking.label, TONE_COLOUR[m.tracking.tone]),
          m.userCount ? `${m.userCount} ${m.userCount === 1 ? "user" : "users"}` : coloured("None", RED, { bold: false }),
        ]),
      })
    : paragraph("No MDA is falling behind on utilisation, releases or reporting.", { size: 13 });

  const alsoLines: string[] = [];
  if (model.alsoNeverReported.length || model.alsoMissedLatest.length) {
    const parts: string[] = [];
    if (model.alsoNeverReported.length) parts.push(`${joinList(model.alsoNeverReported)} (never submitted)`);
    if (model.alsoMissedLatest.length && model.trackingMonthLabel) {
      parts.push(`${joinList(model.alsoMissedLatest)} did not submit ${model.trackingMonthLabel}`);
    }
    alsoLines.push(paragraph(`<strong>Also not reporting:</strong> ${e(parts.join(". "))}.`, { size: 13 }));
  }
  if (model.alsoLowUtilisation.length) {
    alsoLines.push(paragraph(`<strong>Also below 25% utilisation:</strong> ${e(joinList(model.alsoLowUtilisation))}.`, { size: 13 }));
  }
  if (model.upToDate.length && model.trackingMonthLabel) {
    alsoLines.push(
      paragraph(
        `<strong>Up to date for ${e(model.trackingMonthLabel)}:</strong> ` +
          e(joinList(model.upToDate.map((m) => `${m.short} (${formatPct(m.utilisation)} spent)`))) + ".",
        { size: 13 },
      ),
    );
  }

  const directoryHtml = model.directory
    .map(
      (group) =>
        `<div style="font-size:13px;font-weight:700;margin:0 0 4px;">${e(group.mdaName)} <span style="font-weight:400;color:#5b5b5b;">· ${group.users.length} ${group.users.length === 1 ? "user" : "users"}</span></div>` +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">' +
        group.users
          .map(
            (u) =>
              `<tr><td style="padding:6px 8px 6px 0;font-size:13px;color:#1a1a1a;">${e(u.name)}</td>` +
              `<td style="padding:6px 8px 6px 0;font-size:13px;">${link(u.email, `mailto:${u.email}`)}</td>` +
              `<td align="right" style="padding:6px 0;font-size:12px;color:#5b5b5b;white-space:nowrap;">${
                u.lastSignInAt ? `Last signed in ${e(formatDayMonth(u.lastSignInAt))}` : coloured("Never signed in", AMBER, { bold: false })
              }</td></tr>`,
          )
          .join("") +
        "</table>",
    )
    .join("");

  const noUsers = model.mdasWithoutUsers.count
    ? callout(
        `<strong>${model.mdasWithoutUsers.count} ${model.mdasWithoutUsers.count === 1 ? "MDA has" : "MDAs have"} no users</strong>` +
          (model.mdasWithoutUsers.names.length ? `, including ${e(joinList(model.mdasWithoutUsers.names))}` : "") +
          ". Monthly reminders can't reach them until someone from each is invited.",
        "red",
      ) + button("Invite MDA users", `${appUrl}/admin/users`, { primary: false })
    : "";

  const programmesHtml =
    (model.programmes.noSpend.length
      ? paragraph(
          `${model.programmes.noSpend.length === 1 ? "One AOP programme area shows" : `${numberWord(model.programmes.noSpend.length)} AOP programme areas show`} <strong>no spending</strong> against planned activities: ` +
            `${e(model.programmes.noSpend.join("; "))}.` +
            (model.programmes.best ? ` ${e(model.programmes.best.name)} is the strongest at ${formatPct(model.programmes.best.utilisation)}.` : ""),
          { size: 13, color: "#1a1a1a", marginBottom: 6 },
        )
      : model.programmes.best
        ? paragraph(`Every AOP programme area has some spending. ${e(model.programmes.best.name)} is the strongest at ${formatPct(model.programmes.best.utilisation)}.`, {
            size: 13,
            color: "#1a1a1a",
            marginBottom: 6,
          })
        : "") +
    paragraph("Programme budgets are AOP planned costs matched to programme areas by keyword, so these figures are approximate.", { size: 12 });

  const body =
    eyebrow(`Monthly executive summary · ${issueLabel}`) +
    heading(model.headline) +
    paragraph(model.subtitleHtml, { size: 13, marginBottom: 20 }) +
    sectionTitle("At a glance") +
    model.glanceHtml.map((html, i) => paragraph(html, { color: "#1a1a1a", marginBottom: i === model.glanceHtml.length - 1 ? 8 : 16 })).join("") +
    statTiles([
      { label: "Approved", value: formatNairaShort(model.totals.budget), sub: `FY${model.fiscalYear}, ${model.mdaCount} MDAs` },
      { label: "Released", value: formatNairaShort(model.totals.released), sub: `${formatPct(model.totals.releaseRate)} of budget` },
      { label: "Spent", value: formatNairaShort(model.totals.spent), sub: `${formatPct(model.totals.utilisation)} utilised` },
      {
        label: "Reporting",
        value: `${model.upToDateCount} / ${model.mdaCount}`,
        sub: model.trackingMonthLabel ? `up to date for ${model.trackingMonthLabel}` : "no monthly tracking yet",
      },
    ]) +
    sectionTitle("Budget Implementation Report: economic classification") +
    classTable +
    bulletList(model.classInsightsHtml) +
    sectionTitle("MDAs falling behind") +
    laggingTable +
    alsoLines.join("") +
    sectionTitle("MDA users on the platform") +
    (directoryHtml || paragraph("No MDA users have been invited yet.", { size: 13 })) +
    noUsers +
    sectionTitle("Programmes") +
    programmesHtml +
    '<div style="height:12px;"></div>' +
    button("Open the executive overview", `${appUrl}/admin`) +
    button("View all exceptions", `${appUrl}/admin/exceptions`, { primary: false }) +
    (hasAttachment
      ? paragraph(`📎 Attached: <strong>${e(model.pdfFilename)}</strong>, the full Budget Implementation Report by MDA and economic class.`, {
          size: 13,
          marginBottom: 0,
        })
      : "") +
    footer(
      `<strong>Data notes.</strong> ${model.dataNotes.map(e).join(" ")}<br><br>` +
        `Sent on the 7th of each month to Admins and Viewers. ${link("Notification settings", `${appUrl}/settings/notifications`)}`,
    );

  const weakest = model.components.find((c) => c.weak);
  const preheader = [
    `${formatNairaShort(model.totals.spent)} of ${formatNairaShort(model.totals.budget)} spent`,
    weakest ? `${weakest.label.toLowerCase()} at ${formatPct(weakest.utilisation)}` : null,
    model.mdasWithoutUsers.count ? `${model.mdasWithoutUsers.count} MDAs have no users on the platform` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const html = emailShell({ body, preheader, width: 680 });
  return { subject: model.subject, html, text: htmlToText(html) };
}

function numberWord(n: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return words[n] ?? String(n);
}

