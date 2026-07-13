import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ReportCover } from "@/components/reporting/reports-hub/report-covers";
import { SignalChips } from "@/components/reporting/reports-hub/signal-chip";
import type { ReportSignal } from "@/lib/reporting/signals";
import type { ReportTemplate } from "@/lib/reporting/report-templates";
import { cn } from "@/lib/utils";

const SPINE_COLOR: Record<ReportTemplate["id"], string> = {
  cso: "#12303f",
  bir: "#167a4a",
  audit: "#b42318",
  mbp: "#8a5a2b",
};

export function ReportCard({
  template,
  href,
  periodLabel,
  signals,
  loading,
}: {
  template: ReportTemplate;
  href: string;
  periodLabel: string;
  signals: ReportSignal[];
  loading: boolean;
}) {
  return (
    <article className="relative flex gap-4 rounded-lg border bg-card p-4">
      <span
        aria-hidden
        className="absolute inset-y-4 left-0 w-[3px] rounded-full"
        style={{ background: SPINE_COLOR[template.id] }}
      />
      <div className="w-28 shrink-0">
        <ReportCover templateId={template.id} periodLabel={periodLabel} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {template.audience}
        </p>
        <h3 className="text-[15px] font-semibold tracking-tight">{template.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {template.contents.map((item) => (
            <span
              key={item}
              className="rounded-md border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-3 min-h-6">
          {loading ? (
            <span className="text-xs text-muted-foreground">Computing signals…</span>
          ) : (
            <SignalChips signals={signals} />
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <Link href={href} className={cn(buttonVariants({ size: "sm" }))}>
            <FileTextIcon aria-hidden className="size-4" />
            Open report
          </Link>
          {template.hasNarrative ? (
            <span className="text-xs text-muted-foreground">Editable narrative</span>
          ) : null}
          {template.hasCsv ? (
            <span className="text-xs text-muted-foreground">CSV downloads</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
