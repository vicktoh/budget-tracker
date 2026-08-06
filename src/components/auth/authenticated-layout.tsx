"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canAccessRoute,
  getDefaultPathForProfile,
  type AppRoute,
} from "@/lib/access";

// Ordered most-specific first so nested routes resolve to their own guard
// (e.g. /admin/users) before the broader prefix (/admin).
const authenticatedRoutes: AppRoute[] = [
  "/mda",
  "/funding",
  "/expenditure",
  "/entries",
  "/admin/users",
  "/admin/reports",
  "/admin",
  "/imports",
  "/assistant",
  "/settings",
];

function normalizeRoute(pathname: string): AppRoute | null {
  // Match nested workflow routes (e.g. /funding/new, /admin/users) to their
  // top-level access entry so guards stay simple.
  for (const route of authenticatedRoutes) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return route;
    }
  }

  return null;
}

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const route = normalizeRoute(pathname);

  useEffect(() => {
    if (loading) return;

    if (!profile) {
      const redirectTarget = encodeURIComponent(pathname);
      router.replace(`/sign-in?redirect=${redirectTarget}`);
      return;
    }

    if (!route || !canAccessRoute(profile, route)) {
      router.replace(getDefaultPathForProfile(profile));
    }
  }, [loading, pathname, profile, route, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!profile || !route || !canAccessRoute(profile, route)) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
