import type { ExpenditureEntryRow } from "@/lib/db/expenditure-entries";
import type { FundingEntryRow } from "@/lib/db/funding-entries";
import type { EntryStatusSlug } from "@/lib/db/types";

export type LedgerEntryListFilters = {
  search: string;
  status: "all" | EntryStatusSlug;
  mdaId: string;
  fiscalYear: string;
  quarter: "all" | "1" | "2" | "3" | "4";
};

export const DEFAULT_LEDGER_ENTRY_FILTERS: LedgerEntryListFilters = {
  search: "",
  status: "all",
  mdaId: "all",
  fiscalYear: "",
  quarter: "all",
};

export function filterFundingBySearch(
  rows: FundingEntryRow[],
  search: string,
): FundingEntryRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const haystack = [
      row.public_id ?? "",
      row.reference_no,
      row.remarks ?? "",
      row.mdas?.name ?? "",
      row.mdas?.abbreviation ?? "",
      row.programme_areas?.name ?? "",
      row.funding_sources?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export const LEDGER_ENTRIES_PAGE_SIZE = 20;

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize = LEDGER_ENTRIES_PAGE_SIZE,
) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    pageCount,
    items: items.slice(start, start + pageSize),
    total,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
  };
}

export function toLedgerListQueryOptions(
  filters: LedgerEntryListFilters,
  scopedMdaIds: string[] | undefined,
) {
  const mdaIds =
    filters.mdaId !== "all" ? [filters.mdaId] : scopedMdaIds;

  return {
    mdaIds,
    status: filters.status === "all" ? undefined : filters.status,
    fiscalYear: filters.fiscalYear ? Number(filters.fiscalYear) : undefined,
    quarter: filters.quarter === "all" ? undefined : Number(filters.quarter),
    limit: 100,
  };
}

export function filterExpenditureBySearch(
  rows: ExpenditureEntryRow[],
  search: string,
): ExpenditureEntryRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const haystack = [
      row.public_id ?? "",
      row.voucher_ref_no,
      row.remarks ?? "",
      row.mdas?.name ?? "",
      row.mdas?.abbreviation ?? "",
      row.programme_areas?.name ?? "",
      row.expenditure_categories?.name ?? "",
      row.expenditure_items?.name ?? "",
      row.facilities?.name ?? "",
      ...(row.expenditure_funding_allocations ?? []).map(
        (allocation) => allocation.funding_sources?.name ?? "",
      ),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
