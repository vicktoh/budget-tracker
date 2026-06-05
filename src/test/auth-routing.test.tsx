import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { App } from "@/App";
import type { AppProfile, AuthState } from "@/lib/auth-types";

function renderApp(path: string, profile: AppProfile | null) {
  const initialState: AuthState = {
    user: profile
      ? ({
          id: profile.id,
          email: "finance@example.gov.ng",
        } as AuthState["user"])
      : null,
    profile,
    loading: false,
  };

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider initialState={initialState}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const mdaProfile: AppProfile = {
  id: "00000000-0000-0000-0000-000000000001",
  full_name: "MDA Submitter",
  role: "mda_user",
  memberships: [],
};

const adminProfile: AppProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  full_name: "Admin User",
  role: "admin",
  memberships: [],
};

describe("authenticated routing", () => {
  it("sends unauthenticated users to the sign-in gate", () => {
    renderApp("/admin", null);

    expect(screen.getByText("Kano Health Finance Tracker")).toBeInTheDocument();
    expect(screen.getByText(/Sign in to manage MDA entries/i)).toBeInTheDocument();
  });

  it("allows admins to access the admin insight surface", () => {
    renderApp("/admin", adminProfile);

    expect(screen.getByRole("heading", { name: "Admin Insights" })).toBeInTheDocument();
    expect(screen.getByText("Statewide")).toBeInTheDocument();
  });

  it("redirects MDA users away from admin-only routes", () => {
    renderApp("/admin", mdaProfile);

    expect(screen.getByRole("heading", { name: "MDA Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin Insights" })).not.toBeInTheDocument();
  });
});
