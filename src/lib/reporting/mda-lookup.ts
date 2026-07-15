/**
 * Resolve well-known MDAs from a loaded reporting dataset by name, since the
 * reporting rows carry names (not the 12-digit budget codes). Used by report
 * sections that are scoped to a specific board (e.g. the BIR's PHC section).
 */
import type { ReportingDataset } from "@/lib/reporting/types";

function findMdaIdByName(dataset: ReportingDataset, needle: string): string | null {
  const lower = needle.toLowerCase();
  const fromBudget = dataset.budgets.find((row) =>
    row.mda_name.toLowerCase().includes(lower),
  );
  if (fromBudget) return fromBudget.mda_id;
  const fromExpenditure = dataset.expenditure.find((row) =>
    row.mda_name.toLowerCase().includes(lower),
  );
  return fromExpenditure?.mda_id ?? null;
}

/** The Primary Health Care Management Board, or null when absent. */
export function resolvePhcmbMdaId(dataset: ReportingDataset): string | null {
  return findMdaIdByName(dataset, "primary health care");
}
