import { cn } from "@/lib/utils";

type ChartBar = {
  label: string;
  value: number;
  tone?: "green" | "teal" | "brown" | "amber";
};

const toneClass = {
  green: "bg-chart-1",
  teal: "bg-chart-2",
  brown: "bg-chart-3",
  amber: "bg-chart-4",
};

export function MiniBarChart({
  data,
  className,
}: {
  data: ChartBar[];
  className?: string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {data.map((item) => (
        <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3" key={item.label}>
          <span className="truncate text-sm text-muted-foreground">{item.label}</span>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                toneClass[item.tone ?? "green"],
              )}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-right text-sm font-medium">{item.value}%</span>
        </div>
      ))}
    </div>
  );
}
