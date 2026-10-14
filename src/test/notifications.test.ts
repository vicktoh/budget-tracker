import { describe, expect, it } from "vitest";
import * as fx from "@/test/reporting-fixtures";
import { renderEntryCommentEmail, type EntryCommentEmailModel } from "@/lib/notifications/entry-comment-email";
import { htmlToText } from "@/lib/notifications/email-layout";
import { buildExecutiveSummary, renderExecutiveSummaryEmail } from "@/lib/notifications/executive-summary";
import { renderExecutiveSummaryPdf } from "@/lib/notifications/executive-summary-pdf";
import { formatMonthRuns, previousKanoMonth, shortMdaName } from "@/lib/notifications/format";
import {
  planMonthlyReminders,
  reminderPeriod,
  renderMonthlyReminderEmail,
  type ReminderMember,
} from "@/lib/notifications/monthly-reminder";
import type { ReportingDataset } from "@/lib/reporting/types";

const MDA_A = "aaaaaaaa-0000-0000-0000-000000000001";
const MDA_B = "bbbbbbbb-0000-0000-0000-000000000002";
const MDA_C = "cccccccc-0000-0000-0000-000000000003";

function member(overrides: Partial<ReminderMember>): ReminderMember {
  return {
    user_id: "u1",
    mda_id: MDA_A,
    name: "Amina",
    email: "amina@example.gov.ng",
    role: "mda_user",
    banned: false,
    monthlyReminderEmails: true,
    ...overrides,
  };
}

describe("notification formatting", () => {
  it("formats month runs", () => {
    expect(formatMonthRuns([4, 5, 6])).toBe("Apr–Jun");
    expect(formatMonthRuns([6, 4])).toBe("Apr, Jun");
    expect(formatMonthRuns([1, 2, 6])).toBe("Jan–Feb, Jun");
  });

  it("shortens MDA names", () => {
    expect(shortMdaName("Hospital Management Board (HMB)")).toBe("HMB");
    expect(shortMdaName("Ministry of Health (HQ)")).toBe("Ministry of Health HQ");
    expect(shortMdaName("School of Hygiene")).toBe("School of Hygiene");
    expect(shortMdaName("School of Hygiene", "SoH")).toBe("SoH");
  });

  it("finds the previous month in Kano time", () => {
    expect(previousKanoMonth(new Date("2026-10-05T08:00:00Z"))).toEqual({ year: 2026, month: 9 });
    expect(previousKanoMonth(new Date("2027-01-05T08:00:00Z"))).toEqual({ year: 2026, month: 12 });
    // 23:30 UTC on 31 Oct is already 1 Nov in Kano.
    expect(previousKanoMonth(new Date("2026-10-31T23:30:00Z"))).toEqual({ year: 2026, month: 10 });
  });
});

describe("monthly reminder", () => {
  it("covers the current quarter to date only", () => {
    const sep = reminderPeriod(new Date("2026-10-05T08:00:00Z"));
    expect(sep).toMatchObject({ year: 2026, month: 9, quarter: 3, months: [7, 8, 9], from: "2026-07-01", to: "2026-09-30" });
    const oct = reminderPeriod(new Date("2026-11-05T08:00:00Z"));
    expect(oct).toMatchObject({ month: 10, quarter: 4, months: [10], from: "2026-10-01", to: "2026-10-31" });
  });

  const baseInput = {
    runDate: new Date("2026-10-05T08:00:00Z"),
    mdas: [
      { id: MDA_A, name: "MDA A", active: true },
      { id: MDA_B, name: "MDA B", active: true },
      { id: MDA_C, name: "MDA C", active: true },
    ],
    entries: [
      // MDA A recorded July only; MDA B recorded every month; Q2 rows are ignored.
      { mda_id: MDA_A, transaction_date: "2026-07-14", kind: "expenditure" as const },
      { mda_id: MDA_A, transaction_date: "2026-06-30", kind: "funding" as const },
      { mda_id: MDA_B, transaction_date: "2026-07-01", kind: "funding" as const },
      { mda_id: MDA_B, transaction_date: "2026-08-20", kind: "expenditure" as const },
      { mda_id: MDA_B, transaction_date: "2026-09-30", kind: "expenditure" as const },
    ],
    lastEntryDates: new Map([[MDA_A, "2026-07-14"]]),
    members: [
      member({}),
      member({ user_id: "u1" }), // duplicate membership row
      member({ user_id: "u2", name: "Bello", email: "bello@example.gov.ng", monthlyReminderEmails: false }),
      member({ user_id: "u3", name: "Chidi", email: "chidi@example.gov.ng", role: "facility_user" }),
      member({ user_id: "u4", name: "Dayo", email: "dayo@example.gov.ng", banned: true }),
      member({ user_id: "u5", name: "Efe", email: "efe@example.gov.ng", mda_id: MDA_B }),
    ],
    publications: [],
    positions: new Map(),
  };

  it("reminds members of MDAs with empty months, once each, respecting opt-outs", () => {
    const plan = planMonthlyReminders(baseInput);
    expect(plan.quarterPublished).toBe(false);
    // MDA B is complete; MDA C has no users to remind.
    expect(plan.reminders.map((r) => r.mda.id)).toEqual([MDA_A]);
    const [reminder] = plan.reminders;
    expect(reminder.outstandingMonths).toEqual([8, 9]);
    expect(reminder.months.find((m) => m.month === 7)).toMatchObject({ expenditure: 1, funding: 0, outstanding: false });
    expect(reminder.recipients.map((r) => r.user_id)).toEqual(["u1"]);
  });

  it("skips quarters whose Budget Implementation Report is published", () => {
    const plan = planMonthlyReminders({ ...baseInput, publications: [{ fiscal_year: 2026, quarter: 3 }] });
    expect(plan.quarterPublished).toBe(true);
    expect(plan.reminders).toEqual([]);
  });

  it("renders the reminder without the deferred nil-return link", () => {
    const plan = planMonthlyReminders(baseInput);
    const reminder = plan.reminders[0];
    const email = renderMonthlyReminderEmail({
      appUrl: "https://kano-budget-tracker.app",
      recipientName: "Amina <script>",
      mdaName: reminder.mda.name,
      period: plan.period,
      months: reminder.months,
      outstandingMonths: reminder.outstandingMonths,
      lastEntryDate: reminder.lastEntryDate,
      position: { budget: 1e9, released: 4e8, spent: 3e8, utilisation: 0.3, release_rate: 0.4 },
      actualsThrough: "2026-06-30",
      adminContact: { name: "Admin User", email: "admin@example.gov.ng" },
    });
    expect(email.subject).toBe("Action needed: September 2026 entries for MDA A");
    expect(email.html).toContain("Amina &lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toMatch(/nil return/i);
    expect(email.text).toContain("August is also empty");
    expect(email.text).toContain("₦300.0m of ₦1.00bn approved (30.0%)");
  });
});

describe("entry comment email", () => {
  const model: EntryCommentEmailModel = {
    appUrl: "https://kano-budget-tracker.app",
    recipient: { name: "MDA Submitter", side: "mda", previouslyCommented: false },
    comment: { authorName: "Finance Reviewer", authorRole: "reviewer", body: "why is this amount <b>", createdAt: "2026-07-16T14:48:18Z" },
    previousComment: null,
    entry: {
      type: "funding_entry",
      publicId: "FL-2026-0001",
      url: "https://kano-budget-tracker.app/entries/funding/668ce877",
      mdaName: "Ministry of Health (HQ)",
      mdaAbbreviation: null,
      amount: 134108863.46,
      transactionDate: "2026-01-26",
      quarter: 1,
      fiscalYear: 2026,
      detailLabel: "Funding source",
      detailValue: "Kano State Govt Budget Release",
      referenceLabel: "Reference no.",
      referenceValue: "BPR26Q1-FND-HQ-001",
      recordedBy: "MDA Submitter",
      quarterPublished: false,
    },
  };

  it("tells the MDA side about a Viewer remark", () => {
    const email = renderEntryCommentEmail(model);
    expect(email.subject).toBe("New remark on FL-2026-0001 from Finance Reviewer");
    expect(email.html).toContain("why is this amount &lt;b&gt;");
    expect(email.text).toContain("Q1 2026 is still open");
    expect(email.text).toContain("16 Jul 2026, 3:48 PM");
  });

  it("tells a Viewer when the MDA replies", () => {
    const email = renderEntryCommentEmail({
      ...model,
      recipient: { name: "Finance Reviewer", side: "oversight", previouslyCommented: true },
      comment: { authorName: "MDA Submitter", authorRole: "mda_user", body: "January release.", createdAt: "2026-07-17T09:12:00Z" },
      previousComment: model.comment,
    });
    expect(email.subject).toBe("Re: FL-2026-0001 — Ministry of Health HQ replied");
    expect(email.text).toContain("why is this amount");
    expect(email.text).toContain("You're receiving this because you commented on this entry.");
  });

  it("points published quarters to an amendment", () => {
    const email = renderEntryCommentEmail({ ...model, entry: { ...model.entry, quarterPublished: true } });
    expect(email.text).toContain("Q1 2026 has been published");
  });
});

describe("executive summary", () => {
  const dataset = {
    funding: fx.fundingFixtures(),
    expenditure: fx.expenditureFixtures(),
    budgets: fx.budgetFixtures(),
    approvedBudgetLines: [],
    revenues: fx.revenueFixtures(),
    monthly: fx.monthlyFixtures(),
    aopActivities: fx.aopFixtures(),
    publications: [],
  } as unknown as ReportingDataset;

  const summary = buildExecutiveSummary({
    runDate: new Date("2026-10-07T08:00:00Z"),
    appUrl: "https://kano-budget-tracker.app",
    dataset,
    mdaMeta: [],
    users: [
      { id: "u1", name: "Amina", email: "amina@example.gov.ng", role: "mda_user", lastSignInAt: "2026-10-01T10:00:00Z", banned: false },
      { id: "u2", name: "Banned", email: "banned@example.gov.ng", role: "mda_user", lastSignInAt: null, banned: true },
      { id: "u3", name: "Viewer", email: "viewer@example.gov.ng", role: "reviewer", lastSignInAt: null, banned: false },
    ],
    memberships: [
      { user_id: "u1", mda_id: fx.MDA_HEALTH },
      { user_id: "u2", mda_id: fx.MDA_PHCMB },
    ],
  });

  it("reports on the fiscal year of the month just ended", () => {
    expect(summary.fiscalYear).toBe(2026);
    expect(summary.issue.key).toBe("2026-10");
    expect(summary.subject).toMatch(/^October summary: \d+\.\d% of FY2026 health budget spent; \d+ MDAs behind on reporting$/);
  });

  it("counts only active MDA users", () => {
    const health = summary.mdas.find((m) => m.id === fx.MDA_HEALTH);
    const phcmb = summary.mdas.find((m) => m.id === fx.MDA_PHCMB);
    expect(health?.userCount).toBe(1);
    expect(phcmb?.userCount).toBe(0);
    expect(summary.mdasWithoutUsers.count).toBe(1);
    expect(summary.directory).toEqual([
      { mdaName: "Ministry of Health", users: [{ name: "Amina", email: "amina@example.gov.ng", lastSignInAt: "2026-10-01T10:00:00Z" }] },
    ]);
  });

  it("states that no quarter is published and Q3 has no entries", () => {
    expect(summary.subtitleHtml).toContain("no Q3 entries received yet");
    expect(summary.classInsightsHtml.at(-1)).toContain("No 2026 quarter has been published.");
  });

  it("renders the email and a PDF", () => {
    const email = renderExecutiveSummaryEmail(summary);
    expect(email.html).toContain("MDAs falling behind");
    expect(email.html).toContain(summary.pdfFilename);
    expect(htmlToText(email.html)).toContain("Data notes.");
    const pdf = renderExecutiveSummaryPdf(summary);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
