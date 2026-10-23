"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, DownloadIcon } from "lucide-react";
import { SharePill } from "@/components/public/budget-bar";
import {
  cellNumber,
  csvFileName,
  formatCell,
  isLowSpending,
  isNumericColumn,
  nextSort,
  sortRows,
  tableToCsv,
  type AssistantTableInput,
  type SortState,
  type TableColumn,
  type TableRow,
} from "@/lib/public/assistant-table";
import { formatNairaFull } from "@/lib/public/model";
import { cn } from "@/lib/utils";

const COLLAPSED_ROWS = 10;

/** Ask AI's renderTable tool call, drawn as a sortable table card. */
export function AskTableCard({ spec }: { spec: AssistantTableInput }) {
  const columns = spec.columns;
  const [sort, setSort] = useState<SortState>(null);
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => sortRows(spec.rows, columns, sort), [spec.rows, columns, sort]);
  const collapsible = rows.length > COLLAPSED_ROWS + 2;
  const shown = collapsible && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;
  const anyFlag = rows.some((r) => columns.some((c) => isLowSpending(spec, c, r[c.key])));
  // Years and other short labels don't need a wide name column.
  const wide = rows.some((r) => String(r[columns[0].key] ?? "").length > 12);

  function download() {
    const blob = new Blob([`﻿${tableToCsv(spec, rows)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFileName(spec.title);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.figure
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="not-prose my-1 w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-[var(--pub-line)] bg-white"
    >
      <figcaption className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-[var(--pub-ink)]">{spec.title}</span>
          {spec.description ? <span className="text-xs text-[var(--pub-muted)]">{spec.description}</span> : null}
        </span>
        <button
          type="button"
          onClick={download}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--pub-brand-deep)] transition hover:bg-[var(--pub-brand-soft)]"
        >
          <DownloadIcon aria-hidden className="size-3.5" /> CSV
        </button>
      </figcaption>

      <div className="overflow-x-auto border-t border-[var(--pub-line)]">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="bg-[var(--pub-canvas)]">
              {columns.map((c, i) => (
                <HeaderCell key={c.key} column={c} first={i === 0} sort={sort} onSort={() => setSort(nextSort(sort, c))} />
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r} className="group/row border-t border-[var(--pub-line)] transition-colors hover:bg-[var(--pub-canvas)]">
                {columns.map((c, i) => (
                  <BodyCell key={c.key} column={c} first={i === 0} wide={wide} value={row[c.key]} flag={isLowSpending(spec, c, row[c.key])} />
                ))}
              </tr>
            ))}
          </tbody>
          {spec.total ? (
            <tfoot>
              <tr className="border-t-2 border-[var(--pub-sand-2)] bg-[var(--pub-canvas)] font-semibold">
                {columns.map((c, i) => (
                  <BodyCell key={c.key} column={c} first={i === 0} wide={wide} value={(spec.total as TableRow)[c.key]} flag={false} total />
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {collapsible || anyFlag ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--pub-line)] px-4 py-2 text-xs text-[var(--pub-muted)]">
          {anyFlag ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[var(--pub-flag)]" /> Below 25% of the budget spent
            </span>
          ) : (
            <span />
          )}
          {collapsible ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="font-medium text-[var(--pub-brand-deep)] hover:underline">
              {expanded ? "Show fewer" : `Show all ${rows.length} rows`}
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.figure>
  );
}

function HeaderCell({ column, first, sort, onSort }: { column: TableColumn; first: boolean; sort: SortState; onSort: () => void }) {
  const active = sort?.key === column.key ? sort.dir : null;
  const Icon = active === "asc" ? ArrowUpIcon : active === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  const numeric = isNumericColumn(column);
  return (
    <th
      scope="col"
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={cn(
        "whitespace-nowrap px-3 py-2 text-xs font-medium text-[var(--pub-ink-2)]",
        numeric ? "text-right" : "text-left",
        first && "sticky left-0 z-10 bg-[var(--pub-canvas)] pl-4",
      )}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn("inline-flex items-center gap-1 hover:text-[var(--pub-ink)]", numeric && "flex-row-reverse")}
      >
        {column.label}
        <Icon aria-hidden className={cn("size-3", active ? "text-[var(--pub-brand)]" : "opacity-40")} />
      </button>
    </th>
  );
}

function BodyCell({
  column,
  first,
  wide,
  value,
  flag,
  total,
}: {
  column: TableColumn;
  first: boolean;
  wide: boolean;
  value: TableRow[string] | undefined;
  flag: boolean;
  total?: boolean;
}) {
  const numeric = isNumericColumn(column);
  const n = cellNumber(value);
  const content =
    column.format === "spent" && n !== null ? <SharePill share={n / 100} flag={flag} /> : formatCell(column, value);
  return (
    <td
      title={column.format === "naira" && n !== null ? formatNairaFull(n) : undefined}
      className={cn(
        "px-3 py-2 align-middle text-[var(--pub-ink)]",
        numeric ? "whitespace-nowrap text-right" : "text-left",
        !numeric && wide && "min-w-[7rem] max-w-[11rem] sm:min-w-[9rem] sm:max-w-[16rem]",
        first &&
          cn(
            "sticky left-0 z-10 pl-4 font-medium",
            total ? "bg-[var(--pub-canvas)]" : "bg-white group-hover/row:bg-[var(--pub-canvas)]",
          ),
      )}
    >
      {content}
    </td>
  );
}
