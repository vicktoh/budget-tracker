/**
 * CSS-drawn cover thumbnails for the four report templates. These are document
 * identities (the actual downloadable artifacts), so they carry their own
 * colour — the surrounding hub chrome stays on the platform design system.
 */
import type { ReportTemplateId } from "@/lib/reporting/report-templates";

type CoverProps = { periodLabel: string };

const FRAME =
  "relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-md text-white shadow-sm";

export function CsoCover({ periodLabel }: CoverProps) {
  return (
    <div className={FRAME} style={{ background: "#12303f" }}>
      <div className="flex flex-col gap-3 p-3">
        <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-[#9fb4c2]">
          IBP Nigeria · Health Financing
        </span>
        <span className="mt-2 text-[13px] font-bold leading-tight">
          What the Numbers <span style={{ color: "#7fc5dc" }}>Actually Tell Us</span>
        </span>
      </div>
      <span
        className="absolute right-2 top-11 grid size-5 place-items-center rounded-md text-[11px] font-extrabold"
        style={{ background: "#7fc5dc", color: "#12303f" }}
        aria-hidden
      >
        +
      </span>
      <div className="mt-auto flex items-center justify-between border-t border-white/15 p-3 text-[7px] text-[#9fb4c2]">
        <span>{periodLabel}</span>
        <span>Accountability Brief</span>
      </div>
    </div>
  );
}

export function BirCover({ periodLabel }: CoverProps) {
  return (
    <div
      className={`${FRAME} items-center text-center`}
      style={{ background: "#fbfcfa", color: "#1f2933" }}
    >
      <span className="h-1.5 w-full" style={{ background: "#167a4a", borderBottom: "1px solid #9a7b2e" }} />
      <span
        className="mt-4 grid size-6 place-items-center rounded-full text-[12px]"
        style={{ border: "1.5px solid #9a7b2e", color: "#167a4a" }}
        aria-hidden
      >
        ✦
      </span>
      <span className="mt-1.5 text-[6.5px] uppercase tracking-[0.12em] text-[#6c7a66]">
        Kano State Government
      </span>
      <span
        className="mt-1.5 px-3 text-[10px] font-bold uppercase leading-tight tracking-wide"
        style={{ color: "#0f5132" }}
      >
        Budget Implementation Report
      </span>
      <span className="mt-1.5 text-[7px] tracking-wide text-[#6c7a66]">
        HEALTH SECTOR · {periodLabel}
      </span>
      <span
        className="mx-auto mb-3 mt-auto w-3/5 border-t pt-1 text-[6px] tracking-wide text-[#8a967f]"
        style={{ borderColor: "#9a7b2e" }}
      >
        MINISTRY OF HEALTH
      </span>
    </div>
  );
}

export function AuditCover({ periodLabel }: CoverProps) {
  return (
    <div
      className={`${FRAME} p-3 font-mono`}
      style={{ background: "#fbfcfa", color: "#1f2933" }}
    >
      <span className="text-[9px] font-bold tracking-wide">AUDIT ANNEX</span>
      <span className="text-[9px] font-bold tracking-wide">{periodLabel}</span>
      <div className="mt-2 flex flex-col gap-1">
        {["EL-2026-0093", "EL-2026-0094", "FL-2026-0031", "EL-2026-0110"].map((ref) => (
          <span
            key={ref}
            className="border-b border-dotted pb-0.5 text-[5.5px] text-[#6d766f]"
            style={{ borderColor: "#d3ddd5" }}
          >
            {ref}
          </span>
        ))}
      </div>
      <span
        className="absolute inset-x-3 bottom-7 -rotate-6 rounded-sm border-2 py-0.5 text-center text-[8px] font-bold tracking-wide"
        style={{ borderColor: "#b42318", color: "#b42318", background: "rgba(251,252,250,0.82)" }}
      >
        EXCEPTIONS
      </span>
      <span className="absolute bottom-2 left-3 text-[5.5px] text-[#9aa79e]">
        OFFICE OF THE AUDITOR GENERAL
      </span>
    </div>
  );
}

export function MbpCover({ periodLabel }: CoverProps) {
  const bars = [100, 38, 100, 86, 100, 12];
  return (
    <div className={`${FRAME} p-3`} style={{ background: "#8a5a2b" }}>
      <span className="text-[6.5px] uppercase tracking-[0.1em] text-[#e3cdb2]">
        Ministry of Budget &amp; Planning
      </span>
      <span className="mt-3 text-[12px] font-bold leading-tight">EXECUTION REVIEW</span>
      <div className="mt-3 flex h-11 items-end gap-1.5">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-3 rounded-t-sm"
            style={{
              height: `${height}%`,
              background: index % 2 === 0 ? "rgba(243,233,220,0.34)" : "#f3e9dc",
            }}
            aria-hidden
          />
        ))}
      </div>
      <span className="mt-auto border-t border-[#a07845] pt-1.5 text-[6.5px] text-[#e3cdb2]">
        {periodLabel} · vs pro-rata
      </span>
    </div>
  );
}

export function ReportCover({
  templateId,
  periodLabel,
}: {
  templateId: ReportTemplateId;
  periodLabel: string;
}) {
  switch (templateId) {
    case "cso":
      return <CsoCover periodLabel={periodLabel} />;
    case "bir":
      return <BirCover periodLabel={periodLabel} />;
    case "audit":
      return <AuditCover periodLabel={periodLabel} />;
    case "mbp":
      return <MbpCover periodLabel={periodLabel} />;
    default:
      return null;
  }
}
