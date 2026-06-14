"use client";

import * as React from "react";
import { KeyRoundIcon, ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getRoleLabel } from "@/lib/access";
import type { AppRole } from "@/lib/auth-types";
import { listFacilities, listLgas, listMdas } from "@/lib/db/reference-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type ReferenceLite = { id: string; name: string; abbreviation?: string | null };
type FacilityLite = { id: string; name: string; lga_id: string };

const CREATABLE_ROLES: AppRole[] = [
  "facility_user",
  "mda_user",
  "reviewer",
  "admin",
];

function generatePassword() {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `Kano-${part()}${part().toUpperCase()}!`;
}

export function AdminUsersRoute() {
  const [mdas, setMdas] = React.useState<ReferenceLite[]>([]);
  const [lgas, setLgas] = React.useState<ReferenceLite[]>([]);
  const [facilities, setFacilities] = React.useState<FacilityLite[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState(generatePassword);
  const [role, setRole] = React.useState<AppRole>("facility_user");
  const [mdaId, setMdaId] = React.useState("");
  const [lgaFilter, setLgaFilter] = React.useState("");
  const [selectedFacilities, setSelectedFacilities] = React.useState<string[]>(
    [],
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{
    email: string;
    password: string;
    role: AppRole;
  } | null>(null);

  React.useEffect(() => {
    if (!supabase || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [mdaRows, lgaRows, facilityRows] = await Promise.all([
          listMdas(supabase!),
          listLgas(supabase!),
          listFacilities(supabase!),
        ]);
        if (!active) return;
        setMdas(
          mdaRows.map((m) => ({
            id: m.id,
            name: m.name,
            abbreviation: m.abbreviation,
          })),
        );
        setLgas(lgaRows.map((l) => ({ id: l.id, name: l.name })));
        setFacilities(
          facilityRows.map((f) => ({ id: f.id, name: f.name, lga_id: f.lga_id })),
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isFacility = role === "facility_user";
  const wantsMembership = role === "mda_user" || role === "reviewer";

  const visibleFacilities = React.useMemo(() => {
    if (!lgaFilter) return facilities;
    return facilities.filter((f) => f.lga_id === lgaFilter);
  }, [facilities, lgaFilter]);

  function toggleFacility(id: string) {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreated(null);

    if (isFacility && (!mdaId || selectedFacilities.length === 0)) {
      setError("Facility users need a reporting MDA and at least one facility.");
      return;
    }

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired. Sign in again.");
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role,
          mda_id: mdaId || null,
          facility_ids: isFacility ? selectedFacilities : [],
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create user.");
        return;
      }

      setCreated({ email, password, role });
      toast.success(`Created ${getRoleLabel(role)} account for ${email}.`);
      // Reset for the next account but keep the role selection.
      setFullName("");
      setEmail("");
      setPassword(generatePassword());
      setMdaId("");
      setSelectedFacilities([]);
      setLgaFilter("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  const mdaOptions: ComboboxOption[] = mdas.map((m) => ({
    value: m.id,
    label: m.abbreviation ? `${m.abbreviation} — ${m.name}` : m.name,
  }));
  const lgaOptions: ComboboxOption[] = lgas.map((l) => ({
    value: l.id,
    label: l.name,
  }));
  const roleOptions: ComboboxOption[] = CREATABLE_ROLES.map((r) => ({
    value: r,
    label: getRoleLabel(r),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        description="Provision accounts for admins, reviewers, MDA users, and facility users. Facility users submit PHC expenditure for their assigned facilities only."
        title="User management"
      />

      {!hasSupabaseConfig ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables and a `SUPABASE_SERVICE_ROLE_KEY`
            to create users.
          </AlertDescription>
        </Alert>
      ) : null}

      {created ? (
        <Alert variant="success">
          <AlertTitle className="flex items-center gap-2">
            <ShieldCheckIcon aria-hidden="true" className="size-4" />
            Account created
          </AlertTitle>
          <AlertDescription>
            <span className="block">
              Share these credentials securely. The temporary password is shown
              only once.
            </span>
            <span className="mt-2 block font-mono text-xs">
              {created.email} · {created.password} ·{" "}
              {getRoleLabel(created.role)}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create a user</CardTitle>
          <CardDescription>
            New accounts sign in with the temporary password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>We couldn&rsquo;t create this user</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="role">Role</FieldLabel>
                <Combobox
                  id="role"
                  options={roleOptions}
                  value={role}
                  onValueChange={(value) => setRole(value as AppRole)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Temporary password</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPassword(generatePassword())}
                  >
                    <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
                    Regenerate
                  </Button>
                </div>
                <FieldDescription>
                  At least 8 characters. Shared once, reset on first login.
                </FieldDescription>
              </Field>
            </div>

            {(isFacility || wantsMembership) && (
              <Field>
                <FieldLabel htmlFor="mda">
                  {isFacility ? "Reporting MDA" : "MDA membership"}
                </FieldLabel>
                <Combobox
                  id="mda"
                  options={mdaOptions}
                  placeholder={loading ? "Loading MDAs…" : "Select MDA"}
                  value={mdaId || undefined}
                  onValueChange={setMdaId}
                  disabled={loading || mdaOptions.length === 0}
                />
                <FieldDescription>
                  {isFacility
                    ? "Facility users report under a single MDA (e.g. PHCMB)."
                    : "Optional. Adds a submitter/reviewer membership for this MDA."}
                </FieldDescription>
              </Field>
            )}

            {isFacility ? (
              <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Assigned facilities</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedFacilities.length} selected. Filter by LGA to find
                    facilities faster.
                  </span>
                </div>
                <div className="max-w-xs">
                  <Combobox
                    options={lgaOptions}
                    placeholder="Filter by LGA"
                    value={lgaFilter || undefined}
                    onValueChange={setLgaFilter}
                  />
                </div>
                <div className="max-h-64 overflow-auto rounded-md border bg-card">
                  {visibleFacilities.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      {loading ? "Loading facilities…" : "No facilities found."}
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {visibleFacilities.map((facility) => {
                        const checked = selectedFacilities.includes(facility.id);
                        return (
                          <li key={facility.id}>
                            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                              <Checkbox
                                checked={checked}
                                onChange={() => toggleFacility(facility.id)}
                              />
                              <span>{facility.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button disabled={submitting || loading} type="submit">
                <UserPlusIcon aria-hidden="true" data-icon="inline-start" />
                {submitting ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
