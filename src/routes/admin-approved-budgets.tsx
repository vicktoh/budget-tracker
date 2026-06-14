"use client";

import { ApprovedBudgetsManager } from "@/components/admin/approved-budgets-manager";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function AdminApprovedBudgetsRoute() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Approved budgets"
        description="Manage multi-year MDA-level approved budgets. Personnel + other recurrent must equal total recurrent, and total recurrent + capital must equal total budget."
      />

      {!hasSupabaseConfig || !supabase ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to manage approved budgets.
          </AlertDescription>
        </Alert>
      ) : (
        <ApprovedBudgetsManager client={supabase} />
      )}
    </div>
  );
}
