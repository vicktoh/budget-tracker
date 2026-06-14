"use client";

import { ShieldAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

/**
 * Banner shown above the entry form when a reviewer or admin is editing a
 * non-pending entry. The audit reason is mandatory and is captured here so
 * the eventual submit can call the `update_reviewed_*` RPC with it.
 */
export function ReviewedEditBanner({
  status,
  reason,
  onReasonChange,
}: {
  status: "approved" | "rejected";
  reason: string;
  onReasonChange: (next: string) => void;
}) {
  return (
    <div className="border-b px-6 py-6 md:px-10">
      <Alert>
        <AlertTitle className="flex items-center gap-2">
          <ShieldAlertIcon aria-hidden="true" className="size-4" />
          Reviewed entry edit
        </AlertTitle>
        <AlertDescription>
          This entry is {status}. Reviewer or admin edits are recorded in the
          audit trail. Capture a short reason for the change before saving.
        </AlertDescription>
      </Alert>
      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="font-medium">
          Audit reason
          <span className="ml-1 text-status-rejected">*</span>
        </span>
        <Textarea
          placeholder="Why are you changing this reviewed entry? This is recorded permanently."
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </label>
    </div>
  );
}
