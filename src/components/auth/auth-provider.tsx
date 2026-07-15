"use client";

import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { loadProfileForUser } from "@/lib/db/memberships";
import type { AppProfile, AuthState } from "@/lib/auth-types";

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

      try {
        const profile = await loadProfile(session.user);
        if (!active) return;
        setState({ user: session.user, profile, loading: false });
      } catch (error) {
        if (!active) return;
        // If profile load fails (e.g. transient network error or RLS hiccup
        // right after a write), don't strand the layout on its skeleton —
        // surface a fallback profile derived from the auth user so the
        // shell renders. Errors are still visible in the console for ops.
        // eslint-disable-next-line no-console
        console.error("Failed to load profile:", error);
        setState({
          user: session.user,
          profile: {
            id: session.user.id,
            full_name:
              session.user.email?.split("@")[0] ?? "Kano finance user",
            role: "mda_user",
            memberships: [],
            facilityAssignments: [],
          },
          loading: false,
        });
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => loadSession(data.session))
      .catch((error) => {
        if (!active) return;
        // eslint-disable-next-line no-console
        console.error("Failed to read Supabase session:", error);
        setState({ user: null, profile: null, loading: false });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refresh fires when a backgrounded tab is focused again. The
      // Supabase client already holds the new session; reloading the profile
      // here would remount authenticated forms and wipe in-progress drafts.
      if (event === "TOKEN_REFRESHED") return;
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
  if (!supabase) {
    return {
      id: user.id,
      full_name: user.email?.split("@")[0] ?? "Kano finance user",
      role: "mda_user",
      memberships: [],
      facilityAssignments: [],
    };
  }

  return loadProfileForUser(supabase, user);
}
