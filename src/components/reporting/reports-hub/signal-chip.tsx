import { Badge } from "@/components/ui/badge";
import type { ReportSignal, SignalLevel } from "@/lib/reporting/signals";

/** Signal levels reuse the platform's semantic status colours. */
const LEVEL_VARIANT: Record<SignalLevel, "approved" | "processed" | "pending" | "rejected"> = {
  strong: "approved",
  on_track: "processed",
  investigate: "pending",
  critical: "rejected",
};

export function SignalChip({ signal }: { signal: ReportSignal }) {
  return <Badge variant={LEVEL_VARIANT[signal.level]}>{signal.label}</Badge>;
}

export function SignalChips({ signals }: { signals: ReportSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal, index) => (
        <SignalChip key={`${signal.level}-${index}`} signal={signal} />
      ))}
    </div>
  );
}
