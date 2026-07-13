export type FundingAllocationDraft = {
  funding_source_id: string;
  amount: string;
};

export type ValidatedFundingAllocation = {
  funding_source_id: string;
  amount: number;
};

export type ExpenditureFundingAllocationRow = {
  id: string;
  funding_source_id: string;
  amount: number;
  funding_sources: { id: string; name: string } | null;
};

export type FundingOverAllocationWarning = {
  funding_source_id: string;
  funding_source_name: string;
  overflow_amount: number;
  received_amount: number;
  allocated_amount: number;
  available_amount: number;
  message: string;
};

export const UNSPECIFIED_FUNDING_SOURCE_SLUG = "unspecified";

/**
 * Funding source representing the state appropriation. Expenditure funded from
 * it can be classified against a specific approved budget line.
 */
export const STATE_BUDGET_FUNDING_SOURCE_SLUG = "kano-state-govt-budget-release";

export function emptyFundingAllocationDraft(): FundingAllocationDraft {
  return { funding_source_id: "", amount: "" };
}

export function emptyFundingAllocationsDraft(): FundingAllocationDraft[] {
  return [emptyFundingAllocationDraft()];
}

export function parseAllocationAmount(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function sumAllocationAmounts(
  allocations: Array<{ amount: string }>,
): number {
  return allocations.reduce((total, row) => {
    const value = parseAllocationAmount(row.amount);
    return total + (value ?? 0);
  }, 0);
}

export function allocationRemainingAmount(
  totalAmount: string,
  allocations: Array<{ amount: string }>,
): number | null {
  const total = parseAllocationAmount(totalAmount);
  if (total === null) return null;
  return total - sumAllocationAmounts(allocations);
}

export function formatFundingSourceSummary(
  allocations: Array<{ funding_sources?: { name: string } | null }>,
): string {
  if (allocations.length === 0) return "—";
  const names = allocations
    .map((row) => row.funding_sources?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0]!;
  return `${names[0]} +${names.length - 1} more`;
}

export function allocationsToRpcPayload(
  allocations: ValidatedFundingAllocation[],
): Array<{ funding_source_id: string; amount: number }> {
  return allocations.map((row) => ({
    funding_source_id: row.funding_source_id,
    amount: row.amount,
  }));
}
