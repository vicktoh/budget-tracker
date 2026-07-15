import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "reviewer" | "mda_user" | "facility_user";

export type MdaMembership = {
  id: string;
  mda_id: string;
  membership_role: "funding_submitter" | "expenditure_submitter" | "reviewer";
  mdas?: {
    id: string;
    name: string;
    abbreviation: string | null;
  } | null;
};

export type FacilityAssignment = {
  id: string;
  facility_id: string;
  mda_id: string;
  facilities?: {
    id: string;
    name: string;
    lga_id: string;
    facility_type: string;
  } | null;
  mdas?: {
    id: string;
    name: string;
    abbreviation: string | null;
  } | null;
};

export type AppProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  memberships: MdaMembership[];
  facilityAssignments: FacilityAssignment[];
};

export type AuthState = {
  user: User | null;
  profile: AppProfile | null;
  loading: boolean;
};
