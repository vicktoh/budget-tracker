import { Pagination } from "@/components/ui/pagination";

export function LedgerEntryTableFooter({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "No entries"
          : `Showing ${rangeStart}–${rangeEnd} of ${total} ${
              total === 1 ? "entry" : "entries"
            }`}
      </p>
      <Pagination
        className="sm:justify-end"
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
      />
    </div>
  );
}
