import { PlusIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { coreWorkflowItems } from "@/components/layout/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniBarChart } from "@/components/ui/chart";
import { Empty } from "@/components/ui/empty";
import { StatusBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MdaDashboardRoute() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <Link className={buttonVariants()} to="/funding">
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            New entry
          </Link>
        }
        description="Track assigned MDA submissions, pending reviews, data quality warnings, and budget movement."
        title="MDA Dashboard"
      />
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Pending entries", "18", "Awaiting reviewer action"],
          ["Approved this quarter", "42", "Ready for official reporting"],
          ["Data quality warnings", "5", "Non-blocking reviewer attention"],
        ].map(([title, value, description]) => (
          <Card key={title}>
            <CardHeader>
              <CardDescription>{title}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Operational status mix</CardTitle>
            <CardDescription>
              Placeholder insight foundation for entry status distribution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MiniBarChart
              data={[
                { label: "Pending", value: 36, tone: "amber" },
                { label: "Approved", value: 44, tone: "green" },
                { label: "Processed", value: 20, tone: "teal" },
              ]}
            />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          {coreWorkflowItems.slice(0, 2).map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <item.icon aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Public Entry ID</TableHead>
            <TableHead>MDA</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">FL-2026-0001</TableCell>
            <TableCell>Kano State Ministry of Health</TableCell>
            <TableCell>
              <StatusBadge status="pending" />
            </TableCell>
            <TableCell>NGN 12,450,000.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Empty
        description="Filtered results, completed import queues, and missing reference data states reuse this foundation."
        title="Empty state foundation"
      />
    </div>
  );
}
