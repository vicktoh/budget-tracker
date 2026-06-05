import type { LucideIcon } from "lucide-react";
import { FileSearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function Empty({
  icon: Icon = FileSearchIcon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card p-8 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Icon aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actionLabel ? (
        <Button type="button" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
