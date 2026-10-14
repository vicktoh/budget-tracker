/**
 * Monthly outstanding-entries reminder (sent on the 5th).
 *
 * The reminder covers the *current quarter only*: the quarter containing the
 * previous month, from its first month through the previous month. A month is
 * outstanding for an MDA when no funding or expenditure entry is dated in it.
 * Earlier quarters are out of scope on purpose — Q2 2026 actuals were booked as
 * quarter totals dated 30 Jun, so April and May would look empty forever.
 *
 * Quarters with a Budget Implementation Report publication are skipped: they
 * are locked, so a reminder would ask for something users cannot do.
 *
 * MDAs that genuinely had no activity in a month cannot clear the reminder
 * yet (amounts must be positive); see "Nil returns" in docs/notifications.md.
 */
import {
  button,
  callout,
  dataTable,
  coloured,
  emailShell,
  escapeHtml,
  footer,
  heading,
  htmlToText,
  keyValueTable,
  link,
  paragraph,
  AMBER,
  OK,
  RED,
  type RenderedEmail,
} from "@/lib/notifications/email-layout";
import {
  formatDay,
  formatNairaShort,
  formatPct,
  joinList,
  MONTH_NAMES,
  monthKey,
  previousKanoMonth,
  quarterOfMonth,
} from "@/lib/notifications/format";

export type ReminderPeriod = {
  year: number;
  /** The month being chased (the month before the run date). */
  month: number;
  quarter: 1 | 2 | 3 | 4;
  /** Quarter-to-date months, first month of the quarter through `month`. */
  months: number[];
  /** yyyy-mm-dd bounds of `months`, inclusive. */
  from: string;
  to: string;
};

export function reminderPeriod(runDate: Date): ReminderPeriod {
  const { year, month } = previousKanoMonth(runDate);
  const quarter = quarterOfMonth(month);
  const first = (quarter - 1) * 3 + 1;
  const months: number[] = [];
  for (let m = first; m <= month; m += 1) months.push(m);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    quarter,
    months,
    from: `${monthKey(year, first)}-01`,
    to: `${monthKey(year, month)}-${String(lastDay).padStart(2, "0")}`,
  };
}

export type ReminderMember = {
  user_id: string;
  mda_id: string;
  name: string;
  email: string | null;
  role: string;
  banned: boolean;
  monthlyReminderEmails: boolean;
};

export type ReminderMonth = { month: number; funding: number; expenditure: number; outstanding: boolean };

export type MdaPosition = {
  budget: number;
  released: number;
  spent: number;
  utilisation: number | null;
  release_rate: number | null;
};

export type PlannedReminder = {
  mda: { id: string; name: string };
  months: ReminderMonth[];
  outstandingMonths: number[];
  lastEntryDate: string | null;
  position: MdaPosition | null;
  recipients: Array<{ user_id: string; name: string; email: string }>;
};

export type ReminderPlan = {
  period: ReminderPeriod;
  quarterPublished: boolean;
  reminders: PlannedReminder[];
};

export function planMonthlyReminders(input: {
  runDate: Date;
  mdas: Array<{ id: string; name: string; active: boolean }>;
  /** Entries dated inside the period (other rows are ignored). */
  entries: Array<{ mda_id: string; transaction_date: string; kind: "funding" | "expenditure" }>;
  lastEntryDates: Map<string, string>;
  members: ReminderMember[];
  publications: Array<{ fiscal_year: number; quarter: number }>;
  positions: Map<string, MdaPosition>;
}): ReminderPlan {
  const period = reminderPeriod(input.runDate);
  const quarterPublished = input.publications.some(
    (pub) => pub.fiscal_year === period.year && pub.quarter === period.quarter,
  );
  if (quarterPublished) return { period, quarterPublished, reminders: [] };

  const counts = new Map<string, { funding: number; expenditure: number }>();
  for (const entry of input.entries) {
    if (entry.transaction_date < period.from || entry.transaction_date > period.to) continue;
    const key = `${entry.mda_id}:${Number(entry.transaction_date.slice(5, 7))}`;
    const count = counts.get(key) ?? { funding: 0, expenditure: 0 };
    count[entry.kind] += 1;
    counts.set(key, count);
  }

  const recipientsByMda = new Map<string, Map<string, { user_id: string; name: string; email: string }>>();
  for (const member of input.members) {
    if (member.role !== "mda_user" || member.banned || !member.monthlyReminderEmails || !member.email) continue;
    const byUser = recipientsByMda.get(member.mda_id) ?? new Map();
    byUser.set(member.user_id, { user_id: member.user_id, name: member.name, email: member.email });
    recipientsByMda.set(member.mda_id, byUser);
  }

  const reminders: PlannedReminder[] = [];
  for (const mda of input.mdas) {
    if (!mda.active) continue;
    const recipients = recipientsByMda.get(mda.id);
    if (!recipients?.size) continue;

    const months = period.months.map((month): ReminderMonth => {
      const count = counts.get(`${mda.id}:${month}`) ?? { funding: 0, expenditure: 0 };
      return { month, ...count, outstanding: count.funding + count.expenditure === 0 };
    });
    const outstandingMonths = months.filter((m) => m.outstanding).map((m) => m.month);
    if (!outstandingMonths.length) continue;

    reminders.push({
      mda: { id: mda.id, name: mda.name },
      months,
      outstandingMonths,
      lastEntryDate: input.lastEntryDates.get(mda.id) ?? null,
      position: input.positions.get(mda.id) ?? null,
      recipients: [...recipients.values()].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  reminders.sort((a, b) => a.mda.name.localeCompare(b.mda.name));
  return { period, quarterPublished, reminders };
}

export function reminderDedupeKey(period: ReminderPeriod, mdaId: string, userId: string): string {
  return `monthly_reminder:${monthKey(period.year, period.month)}:${mdaId}:${userId}`;
}

/** Everything the template needs; stored as the outbox payload. */
export type MonthlyReminderEmailModel = {
  appUrl: string;
  recipientName: string;
  mdaName: string;
  period: ReminderPeriod;
  months: ReminderMonth[];
  outstandingMonths: number[];
  lastEntryDate: string | null;
  position: MdaPosition | null;
  actualsThrough: string | null;
  adminContact: { name: string; email: string } | null;
};

export function renderMonthlyReminderEmail(model: MonthlyReminderEmailModel): RenderedEmail {
  const { period, mdaName, appUrl } = model;
  const monthName = MONTH_NAMES[period.month - 1];
  const chasedOutstanding = model.outstandingMonths.includes(period.month);
  const earlier = model.outstandingMonths.filter((m) => m !== period.month).map((m) => MONTH_NAMES[m - 1]);
  const outstandingLabel = joinList(model.outstandingMonths.map((m) => MONTH_NAMES[m - 1]));

  const subject = chasedOutstanding
    ? `Action needed: ${monthName} ${period.year} entries for ${mdaName}`
    : `Action needed: ${outstandingLabel} ${period.year} entries for ${mdaName}`;
  const title = chasedOutstanding
    ? `${monthName} ${period.year} entries are outstanding`
    : `Q${period.quarter} ${period.year} has months with no entries`;

  let intro = chasedOutstanding
    ? `No funding or expenditure entries have been recorded for <strong>${escapeHtml(mdaName)}</strong> with a ${monthName} ${period.year} transaction date.`
    : `No funding or expenditure entries have been recorded for <strong>${escapeHtml(mdaName)}</strong> in ${outstandingLabel} ${period.year}, which ${model.outstandingMonths.length > 1 ? "are" : "is"} still open in Q${period.quarter}.`;
  if (model.lastEntryDate) {
    intro += ` The last entry on record is dated <strong>${escapeHtml(formatDay(model.lastEntryDate))}</strong>`;
    intro += chasedOutstanding && earlier.length ? `, so ${joinList(earlier)} ${earlier.length > 1 ? "are" : "is"} also empty.` : ".";
  } else {
    intro += " No entries have been recorded for this MDA yet.";
  }

  const rows = model.months.map((m) => {
    const status = !m.outstanding
      ? coloured("Recorded", OK)
      : m.month === period.month
        ? coloured("Outstanding · due now", RED)
        : coloured("Outstanding", AMBER);
    return [MONTH_NAMES[m.month - 1], String(m.funding), String(m.expenditure), status];
  });

  const positionRows: Array<[string, string]> = [];
  if (model.position && model.position.budget > 0) {
    positionRows.push([
      `FY${period.year} spent so far`,
      `${formatNairaShort(model.position.spent)} of ${formatNairaShort(model.position.budget)} approved (${formatPct(model.position.utilisation)})`,
    ]);
    positionRows.push([
      "Funds released",
      `${formatNairaShort(model.position.released)} (${formatPct(model.position.release_rate)})`,
    ]);
    if (model.actualsThrough) positionRows.push(["Actuals through", escapeHtml(formatDay(model.actualsThrough))]);
  }

  const contact = model.adminContact
    ? ` Questions? Contact ${link(model.adminContact.name, `mailto:${model.adminContact.email}`)}.`
    : " Questions? Contact your administrator.";

  const body =
    heading(title) +
    paragraph(`Hello ${escapeHtml(model.recipientName)},`, { color: "#1a1a1a" }) +
    paragraph(intro) +
    dataTable({
      head: [`Q${period.quarter} ${period.year}`, "Funding", "Expenditure", "Status"],
      rows,
      align: ["left", "center", "center", "left"],
    }) +
    '<div style="height:8px;"></div>' +
    callout(
      `<strong>Q${period.quarter} closes when its Budget Implementation Report is published.</strong> After publication, ` +
        `${MONTH_NAMES[period.months[0] - 1]}–${monthName} entries can only be added through an admin amendment.`,
      "amber",
    ) +
    button("Record an expenditure entry", `${appUrl}/expenditure/new`) +
    button("Record a funding entry", `${appUrl}/funding/new`, { primary: false }) +
    '<div style="height:12px;"></div>' +
    (positionRows.length ? keyValueTable(positionRows) : "") +
    footer(
      "Sent on the 5th of each month to members of MDAs with months in the current quarter that have no entries. " +
        `You're receiving this because you're a member of ${escapeHtml(mdaName)}.${contact} ` +
        link("Notification settings", `${appUrl}/settings/notifications`),
    );

  const preheader = chasedOutstanding
    ? `No funding or expenditure entries yet for ${monthName}${earlier.length ? ` — or ${joinList(earlier)}` : ""}.`
    : `No entries yet for ${outstandingLabel}.`;
  const html = emailShell({ body, preheader });
  return { subject, html, text: htmlToText(html) };
}
