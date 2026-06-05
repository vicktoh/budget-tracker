import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "reviewer" | "mda_user";

export type MdaMembership = {
  id: string;
  mda_id: string;
  membership_role: "submitter" | "reviewer";
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
};

export type AuthState = {
  user: User | null;
  profile: AppProfile | null;
  loading: boolean;
};
