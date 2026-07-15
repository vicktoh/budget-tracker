import { grantsFromMemberships } from "@/lib/admin/user-access";
import type { AppRole } from "@/lib/auth-types";
import type { MembershipRoleSlug } from "@/lib/db/types";

export type AdminUserMembership = {
  mda_id: string;
  membership_role: MembershipRoleSlug;
  mda_name: string;
  mda_abbreviation: string | null;
};

export type AdminUserFacilityAssignment = {
  facility_id: string;
  facility_name: string;
  mda_id: string;
  mda_name: string;
  mda_abbreviation: string | null;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  memberships: AdminUserMembership[];
  facility_assignments: AdminUserFacilityAssignment[];
};

export type AdminUserListResponse = {
  users: AdminUserRecord[];
};

/** Delivery outcome for invite / password-reset emails sent from the admin APIs. */
export type InviteDelivery = {
  email_sent: boolean;
  /** Present when the email could not be delivered so the admin can share the link manually. */
  action_link?: string;
  email_error?: string;
};

export function formatMdaLabel(
  name: string,
  abbreviation: string | null,
): string {
  return abbreviation ? `${abbreviation} — ${name}` : name;
}

export function summarizeUserAccess(user: AdminUserRecord): string {
  if (user.role === "admin") return "Global access";
  if (user.role === "facility_user") {
    const mda =
      user.facility_assignments[0]?.mda_abbreviation ??
      user.facility_assignments[0]?.mda_name ??
      "Unassigned";
    const count = user.facility_assignments.length;
    return count === 0
      ? "No facilities assigned"
      : `${count} ${count === 1 ? "facility" : "facilities"} · ${mda}`;
  }
  if (user.role === "reviewer") return "Reviews all MDAs";

  const grants = grantsFromMemberships(user.memberships);
  const parts: string[] = [];
  if (grants.funding_mda_ids.length > 0) {
    parts.push(`Funding ×${grants.funding_mda_ids.length}`);
  }
  if (grants.expenditure_mda_ids.length > 0) {
    parts.push(`Expenditure ×${grants.expenditure_mda_ids.length}`);
  }
  if (parts.length > 0) return parts.join(" · ");

  return "No MDA grants";
}
