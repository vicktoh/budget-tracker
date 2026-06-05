import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  siblingCount?: number;
};

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildPages(page: number, pageCount: number, siblingCount: number) {
  const totalNumbers = siblingCount * 2 + 5;
  if (pageCount <= totalNumbers) {
    return range(1, pageCount);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, pageCount);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < pageCount - 1;

  const first = 1;
  const last = pageCount;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(first, 3 + siblingCount * 2), "ellipsis", last] as const;
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [
      first,
      "ellipsis",
      ...range(pageCount - (2 + siblingCount * 2), pageCount),
    ] as const;
  }
  return [
    first,
    "ellipsis",
    ...range(leftSibling, rightSibling),
    "ellipsis",
    last,
  ] as const;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
  siblingCount = 1,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = buildPages(page, pageCount, siblingCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-2", className)}
    >
      <Button
        aria-label="Previous page"
        disabled={page <= 1}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon aria-hidden="true" />
        Previous
      </Button>
      <ol className="flex items-center gap-1 text-sm">
        {pages.map((value, index) => {
          if (value === "ellipsis") {
            return (
              <li key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                …
              </li>
            );
          }
          const isActive = value === page;
          return (
            <li key={value}>
              <Button
                aria-current={isActive ? "page" : undefined}
                size="sm"
                type="button"
                variant={isActive ? "default" : "outline"}
                onClick={() => onPageChange(value)}
              >
                {value}
              </Button>
            </li>
          );
        })}
      </ol>
      <Button
        aria-label="Next page"
        disabled={page >= pageCount}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </nav>
  );
}
