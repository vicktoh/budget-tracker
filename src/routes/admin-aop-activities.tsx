"use client";

import { AopActivitiesManager } from "@/components/admin/aop-activities-manager";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function AdminAopActivitiesRoute() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AOP activities"
        description="Manage Annual Operational Plan activities by MDA and fiscal year. Filters narrow the list, and source row numbers preserve workbook duplicates."
      />

      {!hasSupabaseConfig || !supabase ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables to manage AOP activities.
          </AlertDescription>
        </Alert>
      ) : (
        <AopActivitiesManager client={supabase} />
      )}
    </div>
  );
}
