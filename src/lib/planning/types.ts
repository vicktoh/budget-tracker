/**
 * Shared types and helpers for Approved Budget and AOP Activity admin
 * planning data.
 *
 * Source of truth: `supabase/migrations/202605290001_initial_schema.sql`
 *  - `approved_budgets` is keyed by `(fiscal_year, mda_id)` and enforces
 *    `total_recurrent_amount = personnel_amount + other_recurrent_amount`
 *    and `total_budget_amount = total_recurrent_amount + capital_amount`
 *    at the database level.
 *  - `aop_activities` is keyed by
 *    `(fiscal_year, activity_code, mda_id, source_row_number)` so workbook
 *    rows that share an activity code under the same MDA can be preserved
 *    by giving them distinct `source_row_number` values.
 */

export const FISCAL_YEAR_MIN = 2000;
export const FISCAL_YEAR_MAX = 2100;

/**
 * The fiscal-year window the admin planning forms surface in pickers.
 * Centred around the current calendar year so admins can plan ahead and
 * still edit the prior year while it is being reconciled.
 */
export function defaultFiscalYearOptions(today: Date = new Date()): number[] {
  const current = today.getFullYear();
  const years: number[] = [];
  for (let year = current - 2; year <= current + 2; year += 1) {
    years.push(year);
  }
  return years;
}

export function isValidFiscalYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= FISCAL_YEAR_MIN &&
    value <= FISCAL_YEAR_MAX
  );
}
