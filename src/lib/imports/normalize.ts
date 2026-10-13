/**
 * Deterministic cell normalisers for ledger imports.
 *
 * Money is handled as exact decimal strings and integer kobo (bigint), never
 * as JavaScript floats, so totals shown in the preview are the totals the
 * database will store. Dates are checked against the real calendar; the
 * manual-form validators only check the month and would accept 2026-02-31.
 */

export type DateConvention = "dmy" | "mdy";

export type AmountResult =
  | { ok: true; value: string; kobo: bigint }
  | { ok: false; code: AmountErrorCode; message: string };

export type AmountErrorCode =
  | "amount_missing"
  | "amount_not_numeric"
  | "amount_negative"
  | "amount_zero"
  | "amount_precision"
  | "amount_currency";

const FOREIGN_CURRENCY = /(\$|usd|€|eur|£|gbp)/i;

/**
 * Parse a naira amount. Accepts thousands separators, an optional ₦/NGN/N
 * prefix and up to two decimal places. Negative and parenthesised values are
 * rejected rather than made positive — they usually mark a correction, which
 * needs the correction workflow, not a new ledger row.
 */
export function parseNairaAmount(input: string): AmountResult {
  const text = input.trim();
  if (!text) {
    return { ok: false, code: "amount_missing", message: "Amount is empty." };
  }
  if (FOREIGN_CURRENCY.test(text)) {
    return {
      ok: false,
      code: "amount_currency",
      message: `"${text}" is not in naira. Only NGN amounts can be imported.`,
    };
  }

  let body = text.replace(/^(₦|ngn|n)\s*/i, "").replace(/[\s,]/g, "");
  const parenthesised = /^\(.*\)$/.test(body);
  if (parenthesised) body = body.slice(1, -1);
  if (parenthesised || body.startsWith("-")) {
    return {
      ok: false,
      code: "amount_negative",
      message: `"${text}" is negative. Corrections must use the entry correction workflow, not an import.`,
    };
  }
  body = body.replace(/^\+/, "");

  const match = /^(\d+)(?:\.(\d+))?$/.exec(body);
  if (!match) {
    return {
      ok: false,
      code: "amount_not_numeric",
      message: `"${text}" is not a number.`,
    };
  }
  const [, whole, fraction = ""] = match;
  if (fraction.length > 2) {
    return {
      ok: false,
      code: "amount_precision",
      message: `"${text}" has more than two decimal places. Round it in the source file so the stored amount is exact.`,
    };
  }
  const kobo = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0") || "0");
  if (kobo === BigInt(0)) {
    return {
      ok: false,
      code: "amount_zero",
      message: "Ledger amounts must be greater than zero.",
    };
  }
  return { ok: true, value: koboToDecimal(kobo), kobo };
}

export function koboToDecimal(kobo: bigint): string {
  const negative = kobo < BigInt(0);
  const abs = negative ? -kobo : kobo;
  const whole = abs / BigInt(100);
  const fraction = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

/** Exact decimal text ("1500.5", "-20.00") to integer kobo. */
export function decimalToKobo(decimal: string): bigint {
  const negative = decimal.trim().startsWith("-");
  const [whole, fraction = ""] = decimal.trim().replace(/^-/, "").split(".");
  const kobo = BigInt(whole || "0") * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2) || "0");
  return negative ? -kobo : kobo;
}

/** Formats integer kobo as "NGN 8,500,000.00" without passing through a float. */
export function formatKobo(kobo: bigint): string {
  const [whole, fraction] = koboToDecimal(kobo).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `NGN ${grouped}.${fraction}`;
}

export type DateResult =
  | { ok: true; value: string }
  | { ok: false; code: DateErrorCode; message: string };

export type DateErrorCode =
  | "date_missing"
  | "date_invalid"
  | "date_convention_required"
  | "date_unrecognised";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function toIso(year: number, month: number, day: number, original: string): DateResult {
  if (!isRealCalendarDate(year, month, day)) {
    return {
      ok: false,
      code: "date_invalid",
      message: `"${original}" is not a real calendar date.`,
    };
  }
  return {
    ok: true,
    value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/**
 * Parse a transaction date. ISO dates and dates with a written month are
 * unambiguous. Numeric day/month dates (04/05/2026) need the user's chosen
 * convention; without one the row stays blocked rather than guessing.
 */
export function parseTransactionDate(
  input: string,
  convention: DateConvention | null,
): DateResult {
  const text = input.trim();
  if (!text) {
    return { ok: false, code: "date_missing", message: "Date is empty." };
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]), text);

  const numeric = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  if (numeric) {
    if (!convention) {
      return {
        ok: false,
        code: "date_convention_required",
        message: `"${text}" could be day/month or month/day. Choose the date convention for this file.`,
      };
    }
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    return convention === "dmy"
      ? toIso(year, second, first, text)
      : toIso(year, first, second, text);
  }

  // 4 May 2026, 04-May-2026, 4th May, 2026
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/]+([a-z]+)\.?,?[\s\-/]+(\d{4})$/i.exec(text);
  if (dayFirst && MONTHS[dayFirst[2].toLowerCase()]) {
    return toIso(Number(dayFirst[3]), MONTHS[dayFirst[2].toLowerCase()], Number(dayFirst[1]), text);
  }
  // May 4, 2026
  const monthFirst = /^([a-z]+)\.?[\s\-/]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-/]+(\d{4})$/i.exec(text);
  if (monthFirst && MONTHS[monthFirst[1].toLowerCase()]) {
    return toIso(Number(monthFirst[3]), MONTHS[monthFirst[1].toLowerCase()], Number(monthFirst[2]), text);
  }

  return {
    ok: false,
    code: "date_unrecognised",
    message: `"${text}" is not a recognised date. Use YYYY-MM-DD or DD/MM/YYYY.`,
  };
}

/** Case-, spacing- and punctuation-insensitive key for matching labels. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Header text that implies the amount column is not plain naira.
 * "Amount (₦'000)", "Amount in millions", "N'm".
 */
export function headerImpliesScaledUnit(header: string): boolean {
  const text = header.toLowerCase();
  return /'000|’000|\b000s?\b|thousand|million|\bmn\b|\bm\)|'m\b|’m\b|billion|\bbn\b/.test(text);
}
