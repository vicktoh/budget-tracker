import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

type ChartCardProps = {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function ChartCard({
  title,
  description,
  loading,
  error,
  isEmpty,
  emptyTitle = "Nothing to chart yet",
  emptyDescription = "Submitted entries that match the current filters will appear here.",
  actions,
  children,
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-status-rejected">{error}</p>
        ) : isEmpty ? (
          <Empty title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
