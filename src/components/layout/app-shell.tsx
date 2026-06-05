"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { useAuth } from "@/components/auth/auth-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <AppSidebar
          collapsed={collapsed}
          profile={profile}
          onCollapsedChange={setCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader profile={profile} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
