import type { LedgerOrigin } from "@/lib/db/types";

/** Short label for the register badge; manual entries carry no badge. */
export const LEDGER_ORIGIN_BADGES: Record<Exclude<LedgerOrigin, "manual">, string> = {
  import: "Imported",
  bpr: "From BPR",
};

export const LEDGER_ORIGIN_LABELS: Record<LedgerOrigin, string> = {
  manual: "Entered through the entry form",
  import: "Imported from a spreadsheet (Import entries)",
  bpr: "Loaded from the official Budget Performance Report (BPR)",
};

/** The BPR reports no funding sources, so the one on a BPR row is assumed. */
export const BPR_FUNDING_SOURCE_NOTE =
  "The BPR doesn't report funding sources. The funding source on this entry is assumed to be the state appropriation, not taken from the report.";

/** Rows read before the origin column existed have no value; treat them as manual. */
export function ledgerOrigin(row: { origin?: LedgerOrigin | null }): LedgerOrigin {
  return row.origin ?? "manual";
}
