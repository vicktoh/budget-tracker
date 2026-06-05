import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthenticatedLayout } from "@/components/auth/authenticated-layout";
import { AdminRoute } from "@/routes/admin";
import { SignInRoute } from "@/routes/sign-in";
import type { AppProfile, AuthState } from "@/lib/auth-types";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

function renderWithAuth(ui: ReactNode, profile: AppProfile | null) {
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

  return render(<AuthProvider initialState={initialState}>{ui}</AuthProvider>);
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
    renderWithAuth(<SignInRoute />, null);

    expect(screen.getByText("Kano Health Finance Tracker")).toBeInTheDocument();
    expect(screen.getByText(/Sign in to manage MDA entries/i)).toBeInTheDocument();
  });

  it("allows admins to access the admin insight surface", () => {
    renderWithAuth(
      <AuthenticatedLayout>
        <AdminRoute />
      </AuthenticatedLayout>,
      adminProfile,
    );

    expect(screen.getByRole("heading", { name: "Admin Insights" })).toBeInTheDocument();
  });

  it("redirects MDA users away from admin-only routes", () => {
    renderWithAuth(
      <AuthenticatedLayout>
        <AdminRoute />
      </AuthenticatedLayout>,
      mdaProfile,
    );

    expect(replace).toHaveBeenCalledWith("/mda");
  });
});
