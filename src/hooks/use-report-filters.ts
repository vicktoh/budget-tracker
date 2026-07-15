"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseReportFilters,
  serializeReportFilters,
} from "@/lib/reporting/url-state";
import {
  emptyReportFilters,
  type ReportFilters,
} from "@/lib/reporting/types";

type SetFilter = <K extends keyof ReportFilters>(
  key: K,
  value: ReportFilters[K],
) => void;

export type UseReportFiltersResult = {
  filters: ReportFilters;
  setFilter: SetFilter;
  setFilters: (next: ReportFilters) => void;
  clearFilters: () => void;
  toggleFilter: <K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K],
  ) => void;
};

/**
 * URL-synced report filters. The Next.js search params are the single source
 * of truth so dashboards are shareable, refresh-stable, and back/forward
 * navigation works as users expect. Updates use `router.replace` so they
 * don't pollute browser history with every chart click.
 */
export function useReportFilters(): UseReportFiltersResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = React.useMemo(
    () => parseReportFilters(searchParams),
    [searchParams],
  );

  const writeParams = React.useCallback(
    (next: ReportFilters) => {
      const params = serializeReportFilters(next);
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const setFilters = React.useCallback(
    (next: ReportFilters) => {
      writeParams(next);
    },
    [writeParams],
  );

  const setFilter = React.useCallback<SetFilter>(
    (key, value) => {
      writeParams({ ...filters, [key]: value });
    },
    [filters, writeParams],
  );

  const toggleFilter = React.useCallback<SetFilter>(
    (key, value) => {
      const empty = emptyReportFilters();
      const isCurrentlySet = filters[key] === value;
      writeParams({
        ...filters,
        [key]: isCurrentlySet ? empty[key] : value,
      });
    },
    [filters, writeParams],
  );

  const clearFilters = React.useCallback(() => {
    writeParams(emptyReportFilters());
  }, [writeParams]);

  return { filters, setFilter, setFilters, toggleFilter, clearFilters };
}
