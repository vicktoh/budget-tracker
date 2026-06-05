"use client";

import { usePathname } from "next/navigation";
import { BellIcon, ChevronsUpDownIcon, LogOutIcon, UserCogIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { getRoleLabel } from "@/lib/access";
import { supabase } from "@/lib/supabase";
import { navigationItems } from "@/components/layout/navigation";
import type { AppProfile } from "@/lib/auth-types";

function getBreadcrumb(pathname: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: "Home", href: "/mda" }];
  const match = navigationItems.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  if (!match) return crumbs;

  const isNested = pathname !== match.path;
  crumbs.push({
    label: match.label,
    href: isNested ? match.path : undefined,
  });

  if (isNested) {
    const tail = pathname.slice(match.path.length + 1).split("/");
    if (tail[tail.length - 1] === "edit") {
      crumbs.push({ label: "Edit entry" });
    } else if (tail[0] === "new") {
      crumbs.push({ label: "New entry" });
    } else {
      crumbs.push({ label: "Detail" });
    }
  }

  return crumbs;
}

export function TopHeader({ profile }: { profile: AppProfile }) {
  const pathname = usePathname();
  const mdaContext =
    profile.role === "admin"
      ? "Statewide"
      : profile.memberships[0]?.mdas?.abbreviation ||
        profile.memberships[0]?.mdas?.name ||
        "MDA context";

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Breadcrumb className="hidden md:block" items={getBreadcrumb(pathname)} />
        <Separator className="hidden h-4 md:block" orientation="vertical" />
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Badge variant="outline" className="border-primary/30 text-primary">
            FY 2026
          </Badge>
          <Separator className="h-3" orientation="vertical" />
          <span className="truncate text-muted-foreground">{mdaContext}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Tooltip label="Notifications" side="bottom">
          <Button
            aria-label="Notifications"
            size="icon"
            type="button"
            variant="ghost"
          >
            <BellIcon aria-hidden="true" />
          </Button>
        </Tooltip>
        <DropdownMenu
          align="end"
          trigger={
            <span className="focus-ring flex items-center gap-2 rounded-md border bg-card px-2 py-1">
              <Avatar name={profile.full_name} />
              <span className="hidden min-w-0 flex-col text-left md:flex">
                <span className="truncate text-sm font-medium">
                  {profile.full_name || "Finance user"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {getRoleLabel(profile.role)}
                </span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" className="text-muted-foreground" />
            </span>
          }
        >
          <DropdownMenuLabel>
            {profile.full_name ?? "Account"} · {getRoleLabel(profile.role)}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => (window.location.href = "/settings")}>
            <UserCogIcon aria-hidden="true" className="size-4" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem destructive onClick={handleSignOut}>
            <LogOutIcon aria-hidden="true" className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </header>
  );
}
