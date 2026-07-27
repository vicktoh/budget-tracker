"use client";

import { ShieldAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

export function ReasonedEditBanner({ published, reason, onReasonChange }: { published: boolean; reason: string; onReasonChange: (next: string) => void }) {
  return <div className="border-b px-6 py-6 md:px-10"><Alert variant={published ? "warning" : "default"}><AlertTitle className="flex items-center gap-2"><ShieldAlertIcon className="size-4" />{published ? "Published BIR amendment" : "Admin correction"}</AlertTitle><AlertDescription>{published ? "This correction creates the next quarterly BIR metadata version and is permanently audited." : "Admin corrections to another user's unpublished entry require an audit reason."}</AlertDescription></Alert><label className="mt-4 flex flex-col gap-1 text-sm"><span className="font-medium">{published ? "Amendment reason" : "Audit reason"}<span className="ml-1 text-status-rejected">*</span></span><Textarea placeholder="Explain why this correction is necessary…" value={reason} onChange={(event) => onReasonChange(event.target.value)} /></label></div>;
}
