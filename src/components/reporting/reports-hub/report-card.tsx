import Link from "next/link";
import {
  BarChart3Icon,
  CheckIcon,
  DownloadIcon,
  FileCheck2Icon,
  FileTextIcon,
  MegaphoneIcon,
  PencilLineIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ReportCover } from "@/components/reporting/reports-hub/report-covers";
import { SignalChips } from "@/components/reporting/reports-hub/signal-chip";
import type { ReportSignal } from "@/lib/reporting/signals";
import type { ReportTemplate } from "@/lib/reporting/report-templates";
import { cn } from "@/lib/utils";

const REPORT_ICON = {
  cso: MegaphoneIcon,
  bir: FileCheck2Icon,
  audit: ShieldCheckIcon,
  mbp: BarChart3Icon,
} satisfies Record<ReportTemplate["id"], typeof FileTextIcon>;

const ICON_TONE: Record<ReportTemplate["id"], string> = {
  cso: "bg-[#e5eff3] text-[#12303f]",
  bir: "bg-status-approved-bg text-status-approved",
  audit: "bg-status-rejected-bg text-status-rejected",
  mbp: "bg-secondary text-secondary-foreground",
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
  const TemplateIcon = REPORT_ICON[template.id];

  return (
    <article className="group flex h-full gap-4 rounded-lg border bg-card p-4 transition-colors duration-200 hover:border-primary/30 sm:gap-5 sm:p-5">
      <div className="w-24 shrink-0 sm:w-28">
        <ReportCover templateId={template.id} periodLabel={periodLabel} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", ICON_TONE[template.id])}>
            <TemplateIcon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {template.audience}
            </p>
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{template.title}</h3>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{template.description}</p>

        <ul className="mt-3 grid gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground sm:grid-cols-2">
          {template.contents.map((item) => (
            <li key={item} className="flex min-w-0 items-center gap-1.5">
              <CheckIcon aria-hidden className="size-3 shrink-0 text-primary" />
              <span className="truncate">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 min-h-6 border-t pt-3">
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
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <PencilLineIcon aria-hidden className="size-3.5" /> Editable narrative
            </span>
          ) : null}
          {template.hasCsv ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <DownloadIcon aria-hidden className="size-3.5" /> CSV downloads
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
