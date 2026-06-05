import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

type AccordionItemProps = React.HTMLAttributes<HTMLDetailsElement> & {
  title: React.ReactNode;
  defaultOpen?: boolean;
};

export function AccordionItem({
  title,
  defaultOpen,
  className,
  children,
  ...props
}: AccordionItemProps) {
  return (
    <details
      className={cn(
        "group rounded-md border bg-card text-card-foreground [&[open]>summary>svg]:rotate-180",
        className,
      )}
      open={defaultOpen}
      {...props}
    >
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform"
        />
      </summary>
      <div className="border-t px-4 py-3 text-sm text-muted-foreground">
        {children}
      </div>
    </details>
  );
}
