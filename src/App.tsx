import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminRoute } from "@/routes/admin";
import { MdaDashboardRoute } from "@/routes/dashboard";
import { EntryFoundationRoute } from "@/routes/entry-foundation";
import { ReviewRoute } from "@/routes/review";
import { SignInRoute } from "@/routes/sign-in";
import { SimplePageRoute } from "@/routes/simple-page";

export function App() {
  return (
    <>
      <Routes>
        <Route element={<SignInRoute />} path="/sign-in" />
        <Route index element={<Navigate replace to="/mda" />} />
        <Route
          element={
            <ProtectedRoute route="/mda">
              <AppShell>
                <MdaDashboardRoute />
              </AppShell>
            </ProtectedRoute>
          }
          path="/mda"
        />
        <Route
          element={
            <ProtectedRoute route="/funding">
              <AppShell>
                <EntryFoundationRoute type="funding" />
              </AppShell>
            </ProtectedRoute>
          }
          path="/funding"
        />
        <Route
          element={
            <ProtectedRoute route="/expenditure">
              <AppShell>
                <EntryFoundationRoute type="expenditure" />
              </AppShell>
            </ProtectedRoute>
          }
          path="/expenditure"
        />
        <Route
          element={
            <ProtectedRoute route="/review">
              <AppShell>
                <ReviewRoute />
              </AppShell>
            </ProtectedRoute>
          }
          path="/review"
        />
        <Route
          element={
            <ProtectedRoute route="/admin">
              <AppShell>
                <AdminRoute />
              </AppShell>
            </ProtectedRoute>
          }
          path="/admin"
        />
        <Route
          element={
            <ProtectedRoute route="/imports">
              <AppShell>
                <SimplePageRoute
                  description="Admin import validation and write workflow foundation."
                  title="Imports"
                />
              </AppShell>
            </ProtectedRoute>
          }
          path="/imports"
        />
        <Route
          element={
            <ProtectedRoute route="/exports">
              <AppShell>
                <SimplePageRoute
                  description="CSV, XLSX, and PDF export job foundation."
                  title="Exports"
                />
              </AppShell>
            </ProtectedRoute>
          }
          path="/exports"
        />
        <Route
          element={
            <ProtectedRoute route="/settings">
              <AppShell>
                <SimplePageRoute
                  description="User, fiscal year, notification, and account settings foundation."
                  title="Settings"
                />
              </AppShell>
            </ProtectedRoute>
          }
          path="/settings"
        />
        <Route element={<Navigate replace to="/mda" />} path="*" />
      </Routes>
      <Toaster richColors />
    </>
  );
}
