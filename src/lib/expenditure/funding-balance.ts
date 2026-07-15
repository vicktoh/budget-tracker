import type {
  FundingOverAllocationWarning,
  ValidatedFundingAllocation,
} from "@/lib/expenditure/funding-allocations";

type FundingEntryLike = {
  mda_id: string;
  fiscal_year: number;
  programme_area_id: string;
  funding_source_id: string;
  amount: number;
  status: string;
};

type ExpenditureAllocationLike = {
  expenditure_entry_id: string;
  funding_source_id: string;
  amount: number;
  mda_id: string;
  fiscal_year: number;
  programme_area_id: string;
  status: string;
};

const RECEIVED_STATUSES = new Set(["approved", "processed"]);
const ALLOCATED_STATUSES = new Set(["pending", "approved", "processed"]);

export function computeFundingPoolBalance(args: {
  mdaId: string;
  fiscalYear: number;
  programmeAreaId: string;
  fundingSourceId: string;
  fundingEntries: FundingEntryLike[];
  expenditureAllocations: ExpenditureAllocationLike[];
  excludeExpenditureEntryId?: string | null;
}): {
  received_amount: number;
  allocated_amount: number;
  available_amount: number;
} {
  const received_amount = args.fundingEntries
    .filter(
      (row) =>
        row.mda_id === args.mdaId &&
        row.fiscal_year === args.fiscalYear &&
        row.programme_area_id === args.programmeAreaId &&
        row.funding_source_id === args.fundingSourceId &&
        RECEIVED_STATUSES.has(row.status),
    )
    .reduce((sum, row) => sum + row.amount, 0);

  const allocated_amount = args.expenditureAllocations
    .filter(
      (row) =>
        row.mda_id === args.mdaId &&
        row.fiscal_year === args.fiscalYear &&
        row.programme_area_id === args.programmeAreaId &&
        row.funding_source_id === args.fundingSourceId &&
        ALLOCATED_STATUSES.has(row.status) &&
        row.expenditure_entry_id !== args.excludeExpenditureEntryId,
    )
    .reduce((sum, row) => sum + row.amount, 0);

  return {
    received_amount,
    allocated_amount,
    available_amount: received_amount - allocated_amount,
  };
}

export function evaluateFundingAllocationWarnings(args: {
  mdaId: string;
  fiscalYear: number;
  programmeAreaId: string;
  allocations: ValidatedFundingAllocation[];
  fundingEntries: FundingEntryLike[];
  expenditureAllocations: ExpenditureAllocationLike[];
  fundingSourceNames: Map<string, string>;
  excludeExpenditureEntryId?: string | null;
}): FundingOverAllocationWarning[] {
  const warnings: FundingOverAllocationWarning[] = [];

  for (const allocation of args.allocations) {
    const pool = computeFundingPoolBalance({
      mdaId: args.mdaId,
      fiscalYear: args.fiscalYear,
      programmeAreaId: args.programmeAreaId,
      fundingSourceId: allocation.funding_source_id,
      fundingEntries: args.fundingEntries,
      expenditureAllocations: args.expenditureAllocations,
      excludeExpenditureEntryId: args.excludeExpenditureEntryId,
    });

    const overflow = allocation.amount - pool.available_amount;
    if (overflow <= 0) continue;

    const sourceName =
      args.fundingSourceNames.get(allocation.funding_source_id) ??
      "Funding source";

    warnings.push({
      funding_source_id: allocation.funding_source_id,
      funding_source_name: sourceName,
      overflow_amount: overflow,
      received_amount: pool.received_amount,
      allocated_amount: pool.allocated_amount,
      available_amount: pool.available_amount,
      message: `${sourceName} exceeds available funding by ${overflow.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} for this MDA, programme area, and fiscal year.`,
    });
  }

  return warnings;
}
