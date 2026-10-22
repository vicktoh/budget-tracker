"use client";

import * as React from "react";
import { ExternalLinkIcon, GlobeIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin } from "@/lib/access";
import { supabase } from "@/lib/supabase";
import type { ReportQuarter } from "@/lib/reporting/types";

type PublishedBrief = { id: string; storage_path: string; published_at: string; quarter: number | null };

const BUCKET = "public-briefs";

/** Whether a period is officially published (a quarter, or all four for a full year). */
export function briefPeriodPublished(publications: { fiscal_year: number; quarter: number }[], fiscalYear: number, quarter: number | null) {
  const quarters = new Set(publications.filter((p) => p.fiscal_year === fiscalYear).map((p) => p.quarter));
  return quarter ? quarters.has(quarter) : [1, 2, 3, 4].every((q) => quarters.has(q));
}

/**
 * Admin-only: freeze the Accountability Brief for the selected period as a PDF
 * and list it on the public Reports page. Only officially published periods
 * can be published (the database enforces this too).
 */
export function PublishBriefButton({
  fiscalYear,
  quarter,
  periodSlug,
  periodLabel,
  publisher,
  capture,
  disabled,
}: {
  fiscalYear: number | null;
  quarter: ReportQuarter | null;
  periodSlug: string;
  periodLabel: string;
  publisher: string;
  capture: () => HTMLElement | null;
  disabled: boolean;
}) {
  const { profile } = useAuth();
  const [periodOpen, setPeriodOpen] = React.useState<boolean | null>(null);
  const [existing, setExisting] = React.useState<PublishedBrief | null>(null);
  const [busy, setBusy] = React.useState(false);
  const admin = isAdmin(profile);

  const refresh = React.useCallback(async () => {
    if (!supabase || fiscalYear === null) return;
    const [{ data: pubs }, { data: briefs }] = await Promise.all([
      supabase.from("budget_implementation_report_publications").select("fiscal_year, quarter").eq("fiscal_year", fiscalYear),
      supabase
        .from("public_briefs" as never)
        .select("id, storage_path, published_at, quarter")
        .eq("kind", "accountability_brief")
        .eq("fiscal_year", fiscalYear),
    ]);
    setPeriodOpen(briefPeriodPublished((pubs ?? []) as { fiscal_year: number; quarter: number }[], fiscalYear, quarter));
    const rows = (briefs ?? []) as unknown as PublishedBrief[];
    setExisting(rows.find((b) => (b.quarter ?? null) === (quarter ?? null)) ?? null);
  }, [fiscalYear, quarter]);

  React.useEffect(() => {
    if (admin) void refresh();
  }, [admin, refresh]);

  if (!admin || fiscalYear === null) return null;

  async function publish() {
    const element = capture();
    if (!supabase || !element || fiscalYear === null) return;
    if (!window.confirm(`Publish the Accountability Brief for ${periodLabel} to kanohealthbudget.org? Anyone will be able to read and download it.`)) return;
    setBusy(true);
    try {
      const { exportElementToPdfBlob } = await import("@/lib/reporting/export-pdf");
      const blob = await exportElementToPdfBlob(element);
      const path = `accountability-brief-${periodSlug}.pdf`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "300",
      });
      if (uploadError) throw uploadError;
      const row = {
        kind: "accountability_brief",
        fiscal_year: fiscalYear,
        quarter,
        title: "Accountability Brief",
        publisher,
        storage_path: path,
        file_bytes: blob.size,
        published_by: profile?.id ?? null,
        published_at: new Date().toISOString(),
      };
      const { error } = existing
        ? await supabase.from("public_briefs" as never).update(row as never).eq("id", existing.id)
        : await supabase.from("public_briefs" as never).insert(row as never);
      if (error) throw error;
      await revalidatePublicSite();
      toast.success("Published to the public Reports page.");
      await refresh();
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.error("Publishing the brief failed", cause);
      toast.error(cause instanceof Error ? cause.message : "Could not publish the brief.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!supabase || !existing) return;
    if (!window.confirm(`Remove the ${periodLabel} Accountability Brief from the public site?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("public_briefs" as never).delete().eq("id", existing.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([existing.storage_path]);
      await revalidatePublicSite();
      toast.success("Removed from the public site.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not remove the brief.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = periodOpen === false;
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy || periodOpen !== true}
        onClick={publish}
        title={blocked ? "Only officially published quarters can go to the public site." : undefined}
      >
        {busy ? <Loader2Icon aria-hidden className="size-4 animate-spin" /> : <GlobeIcon aria-hidden className="size-4" />}
        {existing ? "Republish to public site" : "Publish to public site"}
      </Button>
      {existing ? (
        <>
          <a
            href="/reports#briefs"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
          >
            Live since {new Date(existing.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
            <ExternalLinkIcon aria-hidden className="size-3" />
          </a>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={unpublish} title="Remove from public site">
            <Trash2Icon aria-hidden className="size-4" />
            <span className="sr-only">Remove from public site</span>
          </Button>
        </>
      ) : blocked ? (
        <span className="text-xs text-muted-foreground">Not a published quarter</span>
      ) : null}
    </div>
  );
}

async function revalidatePublicSite() {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await fetch("/api/public/revalidate", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => undefined);
}
