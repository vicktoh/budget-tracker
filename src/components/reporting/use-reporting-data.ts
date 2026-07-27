"use client";

import * as React from "react";
import {
  listExpenditureCategories,
  listFundingSources,
  listLgas,
  listFacilities,
  listMdas,
  listProgrammeAreas,
} from "@/lib/db/reference-data";
import { loadReportingDataset } from "@/lib/reporting/queries";
import type {
  ReportingDataset,
  ReportScope,
} from "@/lib/reporting/types";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { ReportFilterOptions } from "@/components/reporting/report-filters-bar";
import { readThroughCache } from "@/lib/offline/data-cache";
import { useReconnectTrigger } from "@/lib/offline/use-reconnect-trigger";

type ReportingState = {
  dataset: ReportingDataset | null;
  options: ReportFilterOptions | null;
  loading: boolean;
  error: string | null;
  /** ISO timestamp when the data is served from the offline cache. */
  cachedAt: string | null;
};

const INITIAL_OPTIONS: ReportFilterOptions = {
  mdas: [],
  programmeAreas: [],
  fundingSources: [],
  expenditureCategories: [],
  lgas: [],
  facilities: [],
  fiscalYears: [],
};

/**
 * Loads the reporting dataset and filter dropdown options for the active
 * scope. The dataset is loaded once per scope; filters are applied locally
 * in `aggregate.ts` so chart/table updates are instant.
 */
export function useReportingData(
  client: TypedSupabaseClient | null,
  scope: ReportScope,
): ReportingState {
  const reconnectTrigger = useReconnectTrigger();
  const [state, setState] = React.useState<ReportingState>({
    dataset: null,
    options: client ? null : INITIAL_OPTIONS,
    loading: Boolean(client),
    error: null,
    cachedAt: null,
  });

  // Stabilize the scope dependency so the effect only re-runs when the
  // membership set actually changes.
  const scopeKey = React.useMemo(() => {
    if (!scope.mdaIds) return "all";
    if (scope.mdaIds.length === 0) return "none";
    return scope.mdaIds.slice().sort().join(",");
  }, [scope.mdaIds]);

  React.useEffect(() => {
    if (!client) return;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    if (scopeKey === "none") {
      setState({
        dataset: {
          funding: [],
          expenditure: [],
          budgets: [],
          revenues: [],
          aopActivities: [],
          publications: [],
        },
        options: INITIAL_OPTIONS,
        loading: false,
        error: null,
        cachedAt: null,
      });
      return;
    }

    const effectiveScope: ReportScope = scopeKey === "all"
      ? {}
      : { mdaIds: scopeKey.split(",") };

    readThroughCache(`reporting:${scopeKey}`, async () => {
      const [
        dataset,
        mdas,
        programmeAreas,
        fundingSources,
        expenditureCategories,
        lgas,
        facilities,
      ] = await Promise.all([
        loadReportingDataset(client, effectiveScope),
        listMdas(client),
        listProgrammeAreas(client),
        listFundingSources(client),
        listExpenditureCategories(client),
        listLgas(client),
        listFacilities(client),
      ]);

      const fiscalYears = collectFiscalYears(dataset);

      const visibleMdas = effectiveScope.mdaIds
        ? mdas.filter((mda) => effectiveScope.mdaIds!.includes(mda.id))
        : mdas;

      const options: ReportFilterOptions = {
        mdas: visibleMdas.map((mda) => ({
          value: mda.id,
          label: mda.abbreviation ? `${mda.abbreviation} — ${mda.name}` : mda.name,
        })),
        programmeAreas: programmeAreas.map((row) => ({ value: row.id, label: row.name })),
        fundingSources: fundingSources.map((row) => ({ value: row.id, label: row.name })),
        expenditureCategories: expenditureCategories.map((row) => ({
          value: row.id,
          label: row.name,
        })),
        lgas: lgas.map((row) => ({ value: row.id, label: row.name })),
        facilities: facilities.map((row) => ({
          value: row.id,
          label: row.name,
          description: row.lga_id,
        })),
        fiscalYears,
      };

      return { dataset, options };
    })
      .then(({ data, fromCache, cachedAt }) => {
        if (!active) return;
        setState({
          dataset: {
            ...data.dataset,
            publications: Array.isArray(data.dataset.publications)
              ? data.dataset.publications
              : [],
            // An offline snapshot cached before revenues existed has no
            // `revenues` key; the cache is unversioned, so normalise here
            // rather than letting the report crash on `undefined.filter`.
            revenues: Array.isArray(data.dataset.revenues)
              ? data.dataset.revenues
              : [],
          },
          options: data.options,
          loading: false,
          error: null,
          cachedAt: fromCache ? cachedAt : null,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        // eslint-disable-next-line no-console
        console.error("Failed to load reporting data", error);
        setState({
          dataset: null,
          options: INITIAL_OPTIONS,
          loading: false,
          error: describeReportingLoadError(error),
          cachedAt: null,
        });
      });

    return () => {
      active = false;
    };
  }, [client, reconnectTrigger, scopeKey]);

  return state;
}

function describeReportingLoadError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Could not load reporting data";
}

function collectFiscalYears(dataset: ReportingDataset): number[] {
  const years = new Set<number>();
  for (const row of dataset.funding) years.add(row.fiscal_year);
  for (const row of dataset.expenditure) years.add(row.fiscal_year);
  for (const row of dataset.budgets) years.add(row.fiscal_year);
  for (const row of dataset.aopActivities) years.add(row.fiscal_year);
  if (years.size === 0) {
    const currentYear = new Date().getUTCFullYear();
    years.add(currentYear);
  }
  return Array.from(years).sort((a, b) => b - a);
}
