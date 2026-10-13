"use client";

import * as React from "react";
import { MenuIcon } from "lucide-react";
import { NavigationList } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { AppProfile } from "@/lib/auth-types";

/**
 * Phone and small-tablet navigation. The desktop sidebar is hidden below the
 * md breakpoint, so this drawer is the only way to move between pages there.
 */
export function MobileNav({ profile }: { profile: AppProfile }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        aria-label="Open navigation menu"
        className="md:hidden"
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <MenuIcon aria-hidden="true" />
      </Button>
      <Sheet
        className="max-w-[18rem] [&>div:nth-child(2)]:p-0"
        description="FY 2026 reporting cycle"
        open={open}
        side="left"
        title="Kano Health Financing"
        onOpenChange={setOpen}
      >
        <NavigationList profile={profile} onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
