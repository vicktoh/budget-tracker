"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ReferenceRequestsList } from "@/components/reference/reference-requests-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function AdminReferenceRequestsRoute() {
  const { profile, loading } = useAuth();

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Reference value requests"
          description="Review MDA requests for missing dropdown values. Approve by linking to an existing value or creating a new one. Rejections require a short comment."
        />
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to review requests.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Reference value requests"
          description="Loading your review queue…"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reference value requests"
        description="Review MDA requests for missing dropdown values. Approve by linking to an existing value or creating a new one. Rejections require a short comment."
      />
      <ReferenceRequestsList
        client={supabase}
        mode="admin"
        currentUserId={profile.id}
      />
    </div>
  );
}
