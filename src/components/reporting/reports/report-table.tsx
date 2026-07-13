import * as React from "react";
import { cn } from "@/lib/utils";

export type ReportTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Column width hint, e.g. "w-40". */
  className?: string;
};

/**
 * Compact, table-forward layout for the official report documents — clean row
 * dividers, a strong header rule, tabular figures. Scrolls horizontally inside
 * its own container so wide tables never push the page sideways.
 */
export function ReportTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  emphasizeLastRow = false,
}: {
  columns: ReportTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  caption?: string;
  /** Bold the final row (totals). */
  emphasizeLastRow?: boolean;
}) {
  return (
    <div className="report-table-shell overflow-x-auto rounded-lg border border-border/80 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.03),0_10px_28px_hsl(var(--foreground)/0.035)]">
      <table className="w-full border-separate border-spacing-0 text-sm">
        {caption ? (
          <caption className="border-b border-border/70 bg-muted/25 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="bg-muted/55">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "sticky top-0 border-b border-border/90 px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground backdrop-blur-sm first:pl-4 last:pr-4",
                  column.align === "right" ? "text-right" : "text-left",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isLast = index === rows.length - 1;
            return (
              <tr
                key={getRowKey(row, index)}
                className={cn(
                  "group border-b border-border/65 transition-colors last:border-b-0 odd:bg-background/20 hover:bg-accent/45",
                  emphasizeLastRow && isLast && "bg-muted/65 font-semibold hover:bg-muted/80",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "border-b border-border/65 px-3.5 py-2 align-middle leading-5 group-last:border-b-0 first:pl-4 last:pr-4",
                      column.align === "right" && "text-right tabular-nums",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
