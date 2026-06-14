import type { EntryStatusSlug } from "@/lib/db/types";
import type { ReportFilters } from "@/lib/reporting/types";
import { emptyReportFilters } from "@/lib/reporting/types";

const STATUSES: ReadonlySet<string> = new Set([
  "all",
  "pending",
  "approved",
  "processed",
  "rejected",
] satisfies Array<ReportFilters["status"]>);

const PHC: ReadonlySet<string> = new Set(["any", "yes", "no"] satisfies Array<
  ReportFilters["phc"]
>);

/** Param keys used in the URL. Kept short for tidy share links. */
const KEYS = {
  status: "status",
  fiscalYear: "fy",
  quarter: "q",
  dateFrom: "from",
  dateTo: "to",
  mdaId: "mda",
  programmeAreaId: "pa",
  fundingSourceId: "fs",
  expenditureCategoryId: "ec",
  lgaId: "lga",
  facilityId: "fac",
  phc: "phc",
} as const;

export function parseReportFilters(
  params: URLSearchParams | ReadonlyMap<string, string> | null,
): ReportFilters {
  const filters = emptyReportFilters();
  if (!params) return filters;

  const get = (key: string) => {
    if (params instanceof URLSearchParams) return params.get(key);
    return params.get(key) ?? null;
  };

  const status = get(KEYS.status);
  if (status && STATUSES.has(status)) {
    filters.status = status as EntryStatusSlug | "all";
  }

  const fy = get(KEYS.fiscalYear);
  if (fy) {
    const year = Number.parseInt(fy, 10);
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
      filters.fiscalYear = year;
    }
  }

  const quarter = get(KEYS.quarter);
  if (quarter) {
    const parsed = Number.parseInt(quarter, 10);
    if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
      filters.quarter = parsed;
    }
  }

  filters.dateFrom = get(KEYS.dateFrom) || null;
  filters.dateTo = get(KEYS.dateTo) || null;
  filters.mdaId = get(KEYS.mdaId) || null;
  filters.programmeAreaId = get(KEYS.programmeAreaId) || null;
  filters.fundingSourceId = get(KEYS.fundingSourceId) || null;
  filters.expenditureCategoryId = get(KEYS.expenditureCategoryId) || null;
  filters.lgaId = get(KEYS.lgaId) || null;
  filters.facilityId = get(KEYS.facilityId) || null;

  const phc = get(KEYS.phc);
  if (phc && PHC.has(phc)) {
    filters.phc = phc as ReportFilters["phc"];
  }

  return filters;
}

/**
 * Serializes filters back to a URL-search string. Default values are omitted
 * so the URL stays short for the most common case.
 */
export function serializeReportFilters(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set(KEYS.status, filters.status);
  if (filters.fiscalYear !== null) params.set(KEYS.fiscalYear, String(filters.fiscalYear));
  if (filters.quarter !== null) params.set(KEYS.quarter, String(filters.quarter));
  if (filters.dateFrom) params.set(KEYS.dateFrom, filters.dateFrom);
  if (filters.dateTo) params.set(KEYS.dateTo, filters.dateTo);
  if (filters.mdaId) params.set(KEYS.mdaId, filters.mdaId);
  if (filters.programmeAreaId) params.set(KEYS.programmeAreaId, filters.programmeAreaId);
  if (filters.fundingSourceId) params.set(KEYS.fundingSourceId, filters.fundingSourceId);
  if (filters.expenditureCategoryId)
    params.set(KEYS.expenditureCategoryId, filters.expenditureCategoryId);
  if (filters.lgaId) params.set(KEYS.lgaId, filters.lgaId);
  if (filters.facilityId) params.set(KEYS.facilityId, filters.facilityId);
  if (filters.phc !== "any") params.set(KEYS.phc, filters.phc);
  return params;
}

export function hasActiveFilter(filters: ReportFilters): boolean {
  const empty = emptyReportFilters();
  return (
    filters.status !== empty.status ||
    filters.fiscalYear !== empty.fiscalYear ||
    filters.quarter !== empty.quarter ||
    filters.dateFrom !== empty.dateFrom ||
    filters.dateTo !== empty.dateTo ||
    filters.mdaId !== empty.mdaId ||
    filters.programmeAreaId !== empty.programmeAreaId ||
    filters.fundingSourceId !== empty.fundingSourceId ||
    filters.expenditureCategoryId !== empty.expenditureCategoryId ||
    filters.lgaId !== empty.lgaId ||
    filters.facilityId !== empty.facilityId ||
    filters.phc !== empty.phc
  );
}
