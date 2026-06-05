import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessRoute, getDefaultPathForProfile, type AppRoute } from "@/lib/access";
import { useAuth } from "@/components/auth/auth-provider";

export function ProtectedRoute({
  route,
  children,
}: {
  route: AppRoute;
  children: ReactNode;
}) {
  const { profile, loading } = useAuth();
  const location = useLocation();

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

  if (!profile) {
    return <Navigate replace state={{ from: location }} to="/sign-in" />;
  }

  if (!canAccessRoute(profile, route)) {
    return <Navigate replace to={getDefaultPathForProfile(profile)} />;
  }

  return children;
}
