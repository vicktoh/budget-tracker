import type { LedgerType } from "@/lib/imports/fields";

/**
 * What a sheet represents. The importer identifies this before choosing a
 * destination: a transaction, monthly return, annual budget, AOP plan and a
 * quarterly aggregate cannot be interchanged.
 */
export const SHEET_KINDS = [
  "funding_ledger",
  "expenditure_ledger",
  "monthly_return",
  "annual_budget",
  "aop_plan",
  "quarterly_aggregate",
  "summary_dashboard",
  "reference_lookup",
  "other",
] as const;

export type SheetKind = (typeof SHEET_KINDS)[number];

export const SHEET_KIND_LABELS: Record<SheetKind, string> = {
  funding_ledger: "Funding receipts (transactions)",
  expenditure_ledger: "Expenditure payments (transactions)",
  monthly_return: "Monthly budget-line returns",
  annual_budget: "Annual approved budget",
  aop_plan: "AOP activity plan",
  quarterly_aggregate: "Quarterly published totals",
  summary_dashboard: "Summary or dashboard",
  reference_lookup: "Lookup / reference list",
  other: "Other / unclear",
};

/** Where each kind belongs. Only transaction ledgers import through this page. */
export const SHEET_KIND_DESTINATIONS: Record<SheetKind, string> = {
  funding_ledger: "Funding entries",
  expenditure_ledger: "Expenditure entries and allocations",
  monthly_return: "Monthly expenditure tracking (Admin; not importable here yet)",
  annual_budget: "Approved budgets and budget lines (Admin; not importable here yet)",
  aop_plan: "AOP activities (Admin; not importable here yet)",
  quarterly_aggregate: "Report reconciliation (Admin; not importable here yet)",
  summary_dashboard: "Not imported — summaries and totals are reconciliation evidence",
  reference_lookup: "Reference data (Admin; not importable here yet)",
  other: "Unclear — inspect before importing",
};

export function kindMatchesLedger(kind: SheetKind, ledger: LedgerType): boolean {
  return (ledger === "funding" && kind === "funding_ledger") || (ledger === "expenditure" && kind === "expenditure_ledger");
}
