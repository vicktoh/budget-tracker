import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { LedgerType } from "@/lib/imports/fields";
import type { BatchStatus } from "@/lib/imports/server";
import type { Disposition } from "@/lib/imports/validate";

const statusLabels: Record<BatchStatus, { label: string; variant: BadgeProps["variant"] }> = {
  needs_sheet: { label: "Choose a sheet", variant: "pending" },
  needs_mapping: { label: "Needs mapping", variant: "pending" },
  ready_for_review: { label: "Ready for review", variant: "processed" },
  completed: { label: "Completed", variant: "approved" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

export function ImportStatusBadge({ status }: { status: BatchStatus }) {
  const { label, variant } = statusLabels[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

const dispositionLabels: Record<Disposition, { label: string; variant: BadgeProps["variant"] }> = {
  eligible: { label: "Ready", variant: "approved" },
  blocked: { label: "Blocked", variant: "rejected" },
  duplicate: { label: "Skipped", variant: "secondary" },
  excluded: { label: "Excluded", variant: "outline" },
};

export function DispositionBadge({ disposition }: { disposition: Disposition }) {
  const { label, variant } = dispositionLabels[disposition];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ledgerLabel(ledger: LedgerType, plural = true): string {
  if (ledger === "funding") return plural ? "Funding entries (receipts)" : "funding entry";
  return plural ? "Expenditure entries (payments)" : "expenditure entry";
}
