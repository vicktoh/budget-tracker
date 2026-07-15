"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ReferenceRequestForm } from "@/components/reference/reference-request-form";
import { ReferenceRequestsList } from "@/components/reference/reference-requests-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function ReferenceRequestsRoute() {
  const { profile, loading } = useAuth();

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Request a reference value"
          description="Ask an admin to add a missing dropdown value."
        />
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to submit requests.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Request a reference value"
          description="Loading…"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Request a reference value"
        description="Submit a request when a dropdown is missing the value you need. Admins approve by adding it, or reply with a reason if the existing value should be used instead."
      />
      <ReferenceRequestForm client={supabase} requesterId={profile.id} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your requests</h2>
        <ReferenceRequestsList
          client={supabase}
          mode="mine"
          currentUserId={profile.id}
        />
      </section>
    </div>
  );
}
