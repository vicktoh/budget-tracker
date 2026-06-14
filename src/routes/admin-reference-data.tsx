"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReferenceDataManager } from "@/components/admin/reference-data-manager";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function AdminReferenceDataRoute() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reference data"
        description="Manage the controlled dropdown values used across funding, expenditure, planning, and PHC workflows. Deactivate values instead of deleting them so historical entries stay intact."
      />

      {!hasSupabaseConfig || !supabase ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to manage reference data.
          </AlertDescription>
        </Alert>
      ) : (
        <ReferenceDataManager client={supabase} />
      )}
    </div>
  );
}
