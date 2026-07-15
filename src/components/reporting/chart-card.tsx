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
    <Card className="group/chart relative overflow-hidden border-border/80 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.03),0_12px_32px_hsl(var(--foreground)/0.04)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.04),0_18px_44px_hsl(var(--foreground)/0.07)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-secondary-foreground/50"
      />
      <CardHeader className="border-b border-border/60 bg-gradient-to-b from-muted/35 to-transparent pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle className="text-[0.95rem] leading-snug tracking-[-0.01em]">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription className="max-w-2xl text-xs leading-relaxed">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-48 w-full rounded-md" />
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
