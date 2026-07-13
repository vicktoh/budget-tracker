import { Suspense } from "react";
import { AcceptInviteRoute } from "@/routes/accept-invite";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteRoute />
    </Suspense>
  );
}
