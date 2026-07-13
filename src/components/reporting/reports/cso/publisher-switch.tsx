import { Button } from "@/components/ui/button";
import type { ReportPublisher } from "@/lib/db/report-publishers";
import { cn } from "@/lib/utils";

/**
 * Segmented control to pick the CSO report's publisher. Re-skins the cover,
 * branding, and voice preset live. Falls back to a single static label until
 * publishers finish loading.
 */
export function PublisherSwitch({
  publishers,
  value,
  onChange,
  disabled,
}: {
  publishers: ReportPublisher[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
}) {
  if (publishers.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Publisher"
      className="flex items-center overflow-hidden rounded-md border"
    >
      {publishers.map((publisher) => {
        const active = publisher.slug === value;
        return (
          <Button
            key={publisher.slug}
            type="button"
            size="sm"
            variant={active ? "default" : "ghost"}
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(publisher.slug)}
            className={cn(
              "h-8 rounded-none border-0 text-xs",
              !active && "text-muted-foreground",
            )}
          >
            {publisher.name}
          </Button>
        );
      })}
    </div>
  );
}
