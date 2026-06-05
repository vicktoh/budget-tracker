import type { AppProfile, AppRole } from "@/lib/auth-types";

export type AppRoute =
  | "/mda"
  | "/funding"
  | "/expenditure"
  | "/review"
  | "/admin"
  | "/imports"
  | "/exports"
  | "/settings";

const routeRoles: Record<AppRoute, AppRole[]> = {
  "/mda": ["mda_user", "reviewer", "admin"],
  "/funding": ["mda_user", "admin"],
  "/expenditure": ["mda_user", "admin"],
  "/review": ["reviewer", "admin"],
  "/admin": ["admin"],
  "/imports": ["admin"],
  "/exports": ["reviewer", "admin"],
  "/settings": ["mda_user", "reviewer", "admin"],
};

export function getDefaultPathForProfile(profile: Pick<AppProfile, "role">) {
  if (profile.role === "admin") return "/admin";
  if (profile.role === "reviewer") return "/review";
  return "/mda";
}

export function canAccessRoute(
  profile: Pick<AppProfile, "role"> | null,
  route: AppRoute,
) {
  if (!profile) return false;
  return routeRoles[route].includes(profile.role);
}

export function getRoleLabel(role: AppRole) {
  const labels: Record<AppRole, string> = {
    admin: "Admin",
    reviewer: "Reviewer",
    mda_user: "MDA User",
  };

  return labels[role];
}
