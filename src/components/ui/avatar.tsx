import { cn } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const initials =
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "KF";

  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground",
        className,
      )}
    >
      {initials}
    </div>
  );
}
