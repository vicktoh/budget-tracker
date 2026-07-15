import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border bg-card p-4 text-sm", {
  variants: {
    variant: {
      default: "text-foreground",
      warning: "border-status-pending/30 bg-status-pending-bg text-foreground",
      success:
        "border-status-approved/30 bg-status-approved-bg text-foreground",
      destructive:
        "border-status-rejected/30 bg-status-rejected-bg text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      role="status"
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h4 className={cn("mb-1 font-semibold", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted-foreground", className)} {...props} />;
}
