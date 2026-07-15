"use client";

import * as React from "react";
import {
  CopyIcon,
  KeyRoundIcon,
  MailCheckIcon,
  MailWarningIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { UserDirectory } from "@/components/admin/user-directory";
import {
  FacilityGrantPicker,
  MdaScopedAccessGrants,
  ReportingMdaField,
  toggleGrantId,
  type FacilityLite,
  type ReferenceLite,
} from "@/components/admin/user-grant-pickers";
import { isMdaScopedRole } from "@/lib/admin/user-access";
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
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTemporaryPassword } from "@/lib/admin/passwords";
import { formatMdaLabel } from "@/lib/admin/users";
import type { InviteDelivery } from "@/lib/admin/users";
import { getRoleLabel } from "@/lib/access";
import type { AppRole } from "@/lib/auth-types";
import { listFacilities, listLgas, listMdas } from "@/lib/db/reference-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

const CREATABLE_ROLES: AppRole[] = [
  "facility_user",
  "mda_user",
  "reviewer",
  "admin",
];

type ProvisioningMethod = "invite" | "password";

const PROVISIONING_OPTIONS: ComboboxOption[] = [
  { value: "invite", label: "Email an invite link" },
  { value: "password", label: "Set a temporary password" },
];

export function AdminUsersRoute() {
  const [tab, setTab] = React.useState("directory");
  const [directoryRefresh, setDirectoryRefresh] = React.useState(0);

  const [mdas, setMdas] = React.useState<ReferenceLite[]>([]);
  const [lgas, setLgas] = React.useState<ReferenceLite[]>([]);
  const [facilities, setFacilities] = React.useState<FacilityLite[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        description="Provision accounts and assign access. MDA Users get funding-entry and expenditure-entry grants per MDA; Viewers automatically review every MDA."
        title="User management"
      />

      {!hasSupabaseConfig ? (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add Supabase environment variables and a `SUPABASE_SERVICE_ROLE_KEY`
            to manage users.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="directory" onValueChange={setTab} value={tab}>
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="create">Create user</TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <UserDirectory
            facilities={facilities}
            lgas={lgas}
            loadingReference={loading}
            mdas={mdas}
            onCreateClick={() => setTab("create")}
            refreshToken={directoryRefresh}
          />
        </TabsContent>

        <TabsContent value="create">
          <CreateUserCard
            facilities={facilities}
            lgas={lgas}
            loading={loading}
            mdas={mdas}
            onCreated={() => setDirectoryRefresh((tick) => tick + 1)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateUserCard({
  facilities,
  lgas,
  loading,
  mdas,
  onCreated,
}: {
  facilities: FacilityLite[];
  lgas: ReferenceLite[];
  loading: boolean;
  mdas: ReferenceLite[];
  onCreated: () => void;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("facility_user");
  const [method, setMethod] = React.useState<ProvisioningMethod>("invite");
  const [password, setPassword] = React.useState(generateTemporaryPassword);
  const [mdaId, setMdaId] = React.useState("");
  const [selectedFundingMdas, setSelectedFundingMdas] = React.useState<string[]>(
    [],
  );
  const [selectedExpenditureMdas, setSelectedExpenditureMdas] = React.useState<
    string[]
  >([]);
  const [lgaFilter, setLgaFilter] = React.useState("");
  const [selectedFacilities, setSelectedFacilities] = React.useState<string[]>(
    [],
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{
    email: string;
    role: AppRole;
    invite: InviteDelivery | null;
    password: string | null;
  } | null>(null);

  const isFacility = role === "facility_user";
  const isMdaScoped = isMdaScopedRole(role);

  function handleRoleChange(value: string) {
    setRole(value as AppRole);
    setMdaId("");
    setSelectedFundingMdas([]);
    setSelectedExpenditureMdas([]);
    setSelectedFacilities([]);
    setLgaFilter("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreated(null);

    if (isFacility && (!mdaId || selectedFacilities.length === 0)) {
      setError("Facility users need a reporting MDA and at least one facility.");
      return;
    }
    if (
      isMdaScoped &&
      selectedFundingMdas.length === 0 &&
      selectedExpenditureMdas.length === 0
    ) {
      setError(
        "MDA-scoped users need funding-entry access, expenditure-entry access, or both.",
      );
      return;
    }

    const manualPassword = method === "password" ? password.trim() : "";
    if (method === "password" && manualPassword.length < 8) {
      setError("Temporary password must be at least 8 characters.");
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
          password: manualPassword || undefined,
          role,
          mda_id: mdaId || null,
          facility_ids: isFacility ? selectedFacilities : [],
          funding_mda_ids: isMdaScoped ? selectedFundingMdas : [],
          expenditure_mda_ids: isMdaScoped ? selectedExpenditureMdas : [],
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        invite?: InviteDelivery;
      };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create user.");
        return;
      }

      setCreated({
        email,
        role,
        invite: payload.invite ?? null,
        password: manualPassword || null,
      });
      toast.success(`Created ${getRoleLabel(role)} account for ${email}.`);
      setFullName("");
      setEmail("");
      setPassword(generateTemporaryPassword());
      setMdaId("");
      setSelectedFundingMdas([]);
      setSelectedExpenditureMdas([]);
      setSelectedFacilities([]);
      setLgaFilter("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  const mdaOptions: ComboboxOption[] = mdas.map((m) => ({
    value: m.id,
    label: formatMdaLabel(m.name, m.abbreviation ?? null),
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
    <Card>
      <CardHeader>
        <CardTitle>Create a user</CardTitle>
        <CardDescription>
          Provision accounts with an email invitation or a temporary password
          you share directly. Grant MDA access by ledger so funding and
          expenditure permissions stay separate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {created ? (
          created.password ? (
            <Alert className="mb-6" variant="success">
              <AlertTitle className="flex items-center gap-2">
                <ShieldCheckIcon aria-hidden="true" className="size-4" />
                Account created
              </AlertTitle>
              <AlertDescription>
                <span className="block">
                  Share these credentials securely. The temporary password is
                  shown only once.
                </span>
                <span className="mt-2 block font-mono text-xs">
                  {created.email} · {created.password} ·{" "}
                  {getRoleLabel(created.role)}
                </span>
              </AlertDescription>
            </Alert>
          ) : created.invite?.email_sent ? (
            <Alert className="mb-6" variant="success">
              <AlertTitle className="flex items-center gap-2">
                <MailCheckIcon aria-hidden="true" className="size-4" />
                Invite sent
              </AlertTitle>
              <AlertDescription>
                {created.email} was created as {getRoleLabel(created.role)} and
                emailed an invitation to set their password.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-6" variant="warning">
              <AlertTitle className="flex items-center gap-2">
                <MailWarningIcon aria-hidden="true" className="size-4" />
                Account created, but the invite email failed
              </AlertTitle>
              <AlertDescription>
                <span className="block">
                  {created.email} was created as {getRoleLabel(created.role)},
                  but the invitation could not be emailed
                  {created.invite?.email_error
                    ? `: ${created.invite.email_error}`
                    : "."}
                </span>
                {created.invite?.action_link ? (
                  <span className="mt-2 flex items-center gap-2">
                    <span className="block truncate font-mono text-xs">
                      {created.invite.action_link}
                    </span>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          created.invite!.action_link!,
                        );
                        toast.success("Invite link copied.");
                      }}
                    >
                      <CopyIcon aria-hidden="true" data-icon="inline-start" />
                      Copy link
                    </Button>
                  </span>
                ) : (
                  <span className="mt-2 block">
                    Use “Manage” in the directory to resend the invite.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )
        ) : null}

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
                onValueChange={handleRoleChange}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="provisioning">Account setup</FieldLabel>
              <Combobox
                id="provisioning"
                options={PROVISIONING_OPTIONS}
                value={method}
                onValueChange={(value) =>
                  setMethod(value as ProvisioningMethod)
                }
              />
              <FieldDescription>
                {method === "invite"
                  ? "The new user receives an email invitation and chooses their own password."
                  : "You share the temporary password with the user directly. No email is sent."}
              </FieldDescription>
            </Field>
          </div>

          {method === "password" ? (
            <div className="grid gap-6 md:grid-cols-2">
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
                    onClick={() => setPassword(generateTemporaryPassword())}
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
          ) : null}

          {isFacility ? (
            <>
              <ReportingMdaField
                loading={loading}
                mdaId={mdaId}
                mdaOptions={mdaOptions}
                onMdaChange={setMdaId}
              />
              <FacilityGrantPicker
                facilities={facilities}
                lgaFilter={lgaFilter}
                lgaOptions={lgaOptions}
                loading={loading}
                onLgaFilterChange={setLgaFilter}
                onToggleFacility={(id) =>
                  setSelectedFacilities((current) => toggleGrantId(current, id))
                }
                selectedFacilityIds={selectedFacilities}
              />
            </>
          ) : null}

          {isMdaScoped ? (
            <MdaScopedAccessGrants
              expenditureMdaIds={selectedExpenditureMdas}
              fundingMdaIds={selectedFundingMdas}
              loading={loading}
              mdas={mdas}
              onExpenditureIdsChange={setSelectedExpenditureMdas}
              onFundingIdsChange={setSelectedFundingMdas}
            />
          ) : null}

          {role === "reviewer" ? (
            <p className="text-sm text-muted-foreground">
              Viewers can review funding and expenditure entries for every MDA
              — no per-MDA selection needed.
            </p>
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
  );
}
