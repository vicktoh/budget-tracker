import { Link, useLocation } from "react-router-dom";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AppProfile } from "@/lib/auth-types";
import { navigationItems } from "@/components/layout/navigation";

export function AppSidebar({
  collapsed,
  profile,
  onCollapsedChange,
}: {
  collapsed: boolean;
  profile: AppProfile;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const location = useLocation();
  const items = navigationItems.filter((item) => item.roles.includes(profile.role));

  return (
    <aside
      className={cn(
        "hidden min-h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        {!collapsed ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold">Kano Health</span>
            <span className="truncate text-xs text-muted-foreground">Finance Tracker</span>
          </div>
        ) : null}
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
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const active = location.pathname === item.path;
          const content = (
            <Link
              className={cn(
                "focus-ring flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
                collapsed && "justify-center",
              )}
              to={item.path}
            >
              <item.icon aria-hidden="true" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );

          return collapsed ? (
            <Tooltip key={item.path} label={item.label}>
              {content}
            </Tooltip>
          ) : (
            <span key={item.path}>{content}</span>
          );
        })}
      </nav>
    </aside>
  );
}
