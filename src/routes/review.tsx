import { CheckIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ReviewRoute() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        description="Reviewer and Admin queue foundation for Funding Entries, Expenditure Entries, comments, audit history, and status workflow."
        title="Review Queue"
      />
      <Tabs defaultValue="funding">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="funding">Funding</TabsTrigger>
            <TabsTrigger value="expenditure">Expenditure</TabsTrigger>
          </TabsList>
          <FilterBar>
            <Badge variant="pending">Pending</Badge>
          </FilterBar>
        </div>
        <TabsContent value="funding">
          <ReviewTable publicId="FL-2026-0004" />
        </TabsContent>
        <TabsContent value="expenditure">
          <ReviewTable publicId="EL-2026-0012" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewTable({ publicId }: { publicId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Public Entry ID</TableHead>
          <TableHead>MDA</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Warnings</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">{publicId}</TableCell>
          <TableCell>Kano State Primary Health Care Management Board</TableCell>
          <TableCell>
            <StatusBadge status="pending" />
          </TableCell>
          <TableCell>
            <Badge variant="pending">AOP linkage missing</Badge>
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <Button size="sm" type="button" variant="outline">
                <CheckIcon aria-hidden="true" data-icon="inline-start" />
                Approve
              </Button>
              <Button size="sm" type="button" variant="outline">
                <XIcon aria-hidden="true" data-icon="inline-start" />
                Reject
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
