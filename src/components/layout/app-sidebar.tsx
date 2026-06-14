"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AppProfile } from "@/lib/auth-types";
import {
  navigationItems,
  sectionLabels,
  sectionOrder,
  type NavigationItem,
  type NavigationSection,
} from "@/components/layout/navigation";

export function AppSidebar({
  collapsed,
  profile,
  onCollapsedChange,
}: {
  collapsed: boolean;
  profile: AppProfile;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const visibleItems = navigationItems.filter((item) =>
    item.roles.includes(profile.role),
  );

  const grouped = sectionOrder
    .map<{ section: NavigationSection; items: NavigationItem[] }>((section) => ({
      section,
      items: visibleItems.filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        "hidden min-h-screen shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        <Link
          href="/mda"
          className={cn(
            "focus-ring flex min-w-0 items-center gap-2 rounded-md px-1 py-1",
            collapsed && "justify-center",
          )}
          aria-label="Kano Health Financing Flow Dashboard home"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ActivityIcon aria-hidden="true" className="size-4" />
          </span>
          {!collapsed ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-bold">Kano Health Financing</span>
              <span className="truncate text-[11px] text-muted-foreground">
                Flow Dashboard
              </span>
            </span>
          ) : null}
        </Link>
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpenIcon aria-hidden="true" />
          ) : (
            <PanelLeftCloseIcon aria-hidden="true" />
          )}
        </Button>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2">
        {grouped.map((group) => (
          <div key={group.section} className="flex flex-col gap-1">
            {!collapsed ? (
              <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {sectionLabels[group.section]}
              </p>
            ) : (
              <div aria-hidden="true" className="mx-2 my-1 h-px bg-sidebar-border" />
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.path;
                const link = (
                  <Link
                    href={item.path}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_hsl(var(--primary))]",
                      collapsed && "justify-center",
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : null}
                  </Link>
                );

                return (
                  <li key={item.path}>
                    {collapsed ? (
                      <Tooltip label={item.label} side="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        {!collapsed ? (
          <div className="rounded-md bg-accent px-3 py-2 text-[11px] text-accent-foreground">
            FY 2026 reporting cycle
            <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
              Quarterly entries close end of each quarter.
            </p>
          </div>
        ) : (
          <Tooltip label="FY 2026 reporting cycle" side="right">
            <div className="mx-auto flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <span className="text-[10px] font-semibold">26</span>
            </div>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
