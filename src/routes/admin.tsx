import { UploadIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportAction } from "@/components/ui/export-action";
import { FilterBar } from "@/components/ui/filter-bar";
import { MiniBarChart } from "@/components/ui/chart";

export function AdminRoute() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <>
            <Button type="button" variant="outline">
              <UploadIcon aria-hidden="true" data-icon="inline-start" />
              Import
            </Button>
            <ExportAction />
          </>
        }
        description="Statewide operations foundation for submitted entries, planning data, import validation, and exports."
        title="Admin Insights"
      />
      <FilterBar />
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget vs actual foundation</CardTitle>
            <CardDescription>
              Charts stay restrained and paired with drill-down tables in later phases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MiniBarChart
              data={[
                { label: "Personnel", value: 72, tone: "green" },
                { label: "Recurrent", value: 48, tone: "teal" },
                { label: "Capital", value: 31, tone: "brown" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Import and export conventions</CardTitle>
            <CardDescription>
              Privileged workflows use Next.js route handlers and never expose service-role secrets in the browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>Imports validate row-level errors before writes.</p>
              <p>Exports preserve filters and create downloadable job metadata.</p>
              <p>Email delivery and privileged writes run from server-only route handlers.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
