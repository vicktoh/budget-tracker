import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppProfile, AuthState, MdaMembership } from "@/lib/auth-types";

const AuthContext = React.createContext<AuthState | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
  initialState?: AuthState;
};

export function AuthProvider({ children, initialState }: AuthProviderProps) {
  const [state, setState] = React.useState<AuthState>(
    initialState ?? {
      user: null,
      profile: null,
      loading: Boolean(supabase),
    },
  );

  React.useEffect(() => {
    if (initialState || !supabase) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    let active = true;

    const loadSession = async (session: Session | null) => {
      if (!active) return;
      if (!session?.user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }

      const profile = await loadProfile(session.user);
      if (active) {
        setState({ user: session.user, profile, loading: false });
      }
    };

    supabase.auth.getSession().then(({ data }) => loadSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [initialState]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

async function loadProfile(user: User): Promise<AppProfile> {
  const fallbackName = user.email?.split("@")[0] ?? "Kano finance user";
  const fallbackProfile: AppProfile = {
    id: user.id,
    full_name: fallbackName,
    role: "mda_user",
    memberships: [],
  };

  if (!supabase) return fallbackProfile;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("user_mda_memberships")
    .select("id, mda_id, membership_role, mdas(id, name, abbreviation)")
    .eq("user_id", user.id);

  const normalizedMemberships = (memberships ?? []).map((membership) => ({
    id: membership.id,
    mda_id: membership.mda_id,
    membership_role: membership.membership_role,
    mdas: Array.isArray(membership.mdas)
      ? (membership.mdas[0] ?? null)
      : (membership.mdas ?? null),
  })) as MdaMembership[];

  return {
    ...fallbackProfile,
    ...profile,
    role: profile?.role ?? fallbackProfile.role,
    memberships: normalizedMemberships,
  };
}
