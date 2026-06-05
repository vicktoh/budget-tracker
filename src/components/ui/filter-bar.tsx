import type { ReactNode } from "react";
import { FilterIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilterBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SearchIcon aria-hidden="true" className="text-muted-foreground" />
        <Input placeholder="Search by MDA, public ID, reference, or voucher" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button type="button" variant="outline">
          <FilterIcon aria-hidden="true" data-icon="inline-start" />
          Filters
        </Button>
      </div>
    </div>
  );
}
