"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  loadReportNarratives,
  upsertReportNarrative,
  type ReportNarrative,
} from "@/lib/db/report-narratives";
import type { TypedSupabaseClient } from "@/lib/supabase/client";

export type NarrativeState = {
  /** Effective text for a section: in-progress edit → saved override → auto-draft. */
  bodyFor: (sectionKey: string) => string;
  /** True when a saved override exists (vs an auto-draft). */
  isEdited: (sectionKey: string) => boolean;
  /** True when the in-progress edit differs from what's persisted/drafted. */
  isDirty: (sectionKey: string) => boolean;
  savingKey: string | null;
  loading: boolean;
  setEdit: (sectionKey: string, value: string) => void;
  save: (sectionKey: string) => Promise<void>;
  revert: (sectionKey: string) => void;
};

/**
 * Loads and persists per-section CSO narrative overrides for a period. The
 * `autoDrafts` map supplies the fallback prose; a saved override always wins.
 */
export function useCsoNarratives({
  client,
  fiscalYear,
  quarter,
  autoDrafts,
}: {
  client: TypedSupabaseClient | null;
  fiscalYear: number | null;
  quarter: number | null;
  autoDrafts: Record<string, string>;
}): NarrativeState {
  const [saved, setSaved] = React.useState<Record<string, ReportNarrative>>({});
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Reload saved overrides whenever the period changes; clear in-progress edits.
  React.useEffect(() => {
    if (!client || fiscalYear === null) {
      setSaved({});
      setEdits({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadReportNarratives(client, "cso", fiscalYear, quarter)
      .then((rows) => {
        if (!cancelled) {
          setSaved(rows);
          setEdits({});
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error("Failed to load narratives", cause);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, fiscalYear, quarter]);

  const persistedBody = React.useCallback(
    (sectionKey: string) => saved[sectionKey]?.body ?? autoDrafts[sectionKey] ?? "",
    [saved, autoDrafts],
  );

  const bodyFor = React.useCallback(
    (sectionKey: string) =>
      edits[sectionKey] !== undefined ? edits[sectionKey] : persistedBody(sectionKey),
    [edits, persistedBody],
  );

  const isEdited = React.useCallback(
    (sectionKey: string) => saved[sectionKey] != null,
    [saved],
  );

  const isDirty = React.useCallback(
    (sectionKey: string) =>
      edits[sectionKey] !== undefined && edits[sectionKey] !== persistedBody(sectionKey),
    [edits, persistedBody],
  );

  const setEdit = React.useCallback((sectionKey: string, value: string) => {
    setEdits((prev) => ({ ...prev, [sectionKey]: value }));
  }, []);

  const revert = React.useCallback((sectionKey: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
  }, []);

  const save = React.useCallback(
    async (sectionKey: string) => {
      if (!client || fiscalYear === null) return;
      const body = edits[sectionKey];
      if (body === undefined) return;
      setSavingKey(sectionKey);
      try {
        await upsertReportNarrative(client, {
          template: "cso",
          fiscalYear,
          quarter,
          sectionKey,
          body,
        });
        setSaved((prev) => ({
          ...prev,
          [sectionKey]: {
            sectionKey,
            body,
            editedBy: null,
            updatedAt: new Date(0).toISOString(),
          },
        }));
        setEdits((prev) => {
          const next = { ...prev };
          delete next[sectionKey];
          return next;
        });
        toast.success("Narrative saved");
      } catch (cause) {
        // eslint-disable-next-line no-console
        console.error("Failed to save narrative", cause);
        toast.error("Could not save the narrative. Please try again.");
      } finally {
        setSavingKey(null);
      }
    },
    [client, fiscalYear, quarter, edits],
  );

  return { bodyFor, isEdited, isDirty, savingKey, loading, setEdit, save, revert };
}
