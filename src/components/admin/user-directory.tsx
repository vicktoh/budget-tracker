"use client";

import * as React from "react";
import {
  ClipboardCheckIcon,
  CopyIcon,
  MailIcon,
  PencilLineIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  FacilityGrantPicker,
  MdaScopedAccessGrants,
  ReportingMdaField,
  toggleGrantId,
  type FacilityLite,
  type ReferenceLite,
} from "@/components/admin/user-grant-pickers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Empty } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { grantsFromMemberships, isMdaScopedRole } from "@/lib/admin/user-access";
import { generateTemporaryPassword } from "@/lib/admin/passwords";
import {
  formatMdaLabel,
  summarizeUserAccess,
  type AdminUserRecord,
  type InviteDelivery,
} from "@/lib/admin/users";
import { getRoleLabel } from "@/lib/access";
import type { AppRole } from "@/lib/auth-types";
import { supabase } from "@/lib/supabase";

const ROLE_FILTER_OPTIONS: ComboboxOption[] = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "reviewer", label: "Viewer" },
  { value: "mda_user", label: "MDA User" },
  { value: "facility_user", label: "Facility User" },
];

const EDITABLE_ROLES: AppRole[] = [
  "facility_user",
  "mda_user",
  "reviewer",
  "admin",
];

type UserDirectoryProps = {
  facilities: FacilityLite[];
  lgas: ReferenceLite[];
  loadingReference: boolean;
  mdas: ReferenceLite[];
  onCreateClick: () => void;
  refreshToken?: number;
};

export function UserDirectory({
  facilities,
  lgas,
  loadingReference,
  mdas,
  onCreateClick,
  refreshToken = 0,
}: UserDirectoryProps) {
  const [users, setUsers] = React.useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<AdminUserRecord | null>(null);

  const loadUsers = React.useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoadError("Your session expired. Sign in again.");
        return;
      }

      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await response.json()) as {
        error?: string;
        users?: AdminUserRecord[];
      };
      if (!response.ok) {
        setLoadError(payload.error ?? "Failed to load users.");
        return;
      }
      setUsers(payload.users ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load users.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers, refreshToken]);

  const filteredUsers = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        user.full_name,
        user.email,
        summarizeUserAccess(user),
        getRoleLabel(user.role),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, roleFilter, users]);

  const mdaOptions: ComboboxOption[] = mdas.map((mda) => ({
    value: mda.id,
    label: formatMdaLabel(mda.name, mda.abbreviation ?? null),
  }));
  const lgaOptions: ComboboxOption[] = lgas.map((lga) => ({
    value: lga.id,
    label: lga.name,
  }));

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-end md:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <Field>
              <FieldLabel htmlFor="user-search">Search directory</FieldLabel>
              <div className="relative">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="user-search"
                  className="h-11 pl-9"
                  placeholder="Name, email, MDA, or grant summary"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="role-filter">Role</FieldLabel>
              <Combobox
                id="role-filter"
                options={ROLE_FILTER_OPTIONS}
                value={roleFilter}
                onValueChange={setRoleFilter}
              />
            </Field>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadUsers()}
              disabled={loading}
            >
              <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
              Refresh
            </Button>
            <Button type="button" onClick={onCreateClick}>
              <UserPlusIcon aria-hidden="true" data-icon="inline-start" />
              Add user
            </Button>
          </div>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>We couldn&rsquo;t load the directory</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access scope</TableHead>
                <TableHead className="w-[7rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-10" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Empty
                      description={
                        users.length === 0
                          ? "Provision the first account from the Create user tab."
                          : "Try a different search or role filter."
                      }
                      title="No users match"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {user.full_name ?? "Unnamed user"}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>
                      <AccessSummary user={user} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => setEditing(user)}
                      >
                        <PencilLineIcon
                          aria-hidden="true"
                          data-icon="inline-start"
                        />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {editing ? (
        <ManageUserAccessSheet
          facilities={facilities}
          lgaOptions={lgaOptions}
          loadingReference={loadingReference}
          mdaOptions={mdaOptions}
          mdas={mdas}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setUsers((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const variant =
    role === "admin"
      ? "approved"
      : role === "reviewer"
        ? "pending"
        : role === "facility_user"
          ? "processed"
          : "secondary";

  return <Badge variant={variant}>{getRoleLabel(role)}</Badge>;
}

function AccessSummary({ user }: { user: AdminUserRecord }) {
  if (user.role === "admin") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ShieldIcon aria-hidden="true" className="size-3.5 text-status-approved" />
        Global access
      </span>
    );
  }

  if (user.role === "facility_user") {
    return (
      <span className="text-sm text-muted-foreground">
        {summarizeUserAccess(user)}
      </span>
    );
  }

  if (user.role === "reviewer") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ClipboardCheckIcon aria-hidden="true" className="size-3.5 text-status-pending" />
        Reviews all MDAs
      </span>
    );
  }

  const grants = grantsFromMemberships(user.memberships);

  return (
    <div className="flex flex-wrap gap-1.5">
      {grants.funding_mda_ids.length > 0 ? (
        <Badge className="border-status-approved/25 bg-status-approved-bg text-status-approved">
          Funding · {grants.funding_mda_ids.length}
        </Badge>
      ) : null}
      {grants.expenditure_mda_ids.length > 0 ? (
        <Badge className="border-[#8A5A2B]/25 bg-[#F3E9DC] text-[#8A5A2B]">
          Expenditure · {grants.expenditure_mda_ids.length}
        </Badge>
      ) : null}
      {grants.funding_mda_ids.length === 0 &&
      grants.expenditure_mda_ids.length === 0 ? (
        <span className="text-sm text-muted-foreground">No grants</span>
      ) : null}
    </div>
  );
}

function ManageUserAccessSheet({
  facilities,
  lgaOptions,
  loadingReference,
  mdaOptions,
  mdas,
  onClose,
  onSaved,
  user,
}: {
  facilities: FacilityLite[];
  lgaOptions: ComboboxOption[];
  loadingReference: boolean;
  mdaOptions: ComboboxOption[];
  mdas: ReferenceLite[];
  onClose: () => void;
  onSaved: (user: AdminUserRecord) => void;
  user: AdminUserRecord;
}) {
  const initialGrants = React.useMemo(
    () => grantsFromMemberships(user.memberships),
    [user.memberships],
  );

  const [fullName, setFullName] = React.useState(user.full_name ?? "");
  const [role, setRole] = React.useState<AppRole>(user.role);
  const [mdaId, setMdaId] = React.useState(
    user.facility_assignments[0]?.mda_id ?? "",
  );
  const [fundingMdas, setFundingMdas] = React.useState(
    initialGrants.funding_mda_ids,
  );
  const [expenditureMdas, setExpenditureMdas] = React.useState(
    initialGrants.expenditure_mda_ids,
  );
  const [facilityIds, setFacilityIds] = React.useState(
    user.facility_assignments.map((row) => row.facility_id),
  );
  const [lgaFilter, setLgaFilter] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState(generateTemporaryPassword);
  const [resetting, setResetting] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = React.useState<{
    email: string;
    password: string;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = React.useState<
    "invite" | "reset" | null
  >(null);
  const [emailResult, setEmailResult] = React.useState<{
    kind: "invite" | "reset";
    invite: InviteDelivery;
  } | null>(null);

  const isFacility = role === "facility_user";
  const isMdaScoped = isMdaScopedRole(role);

  function handleRoleChange(value: string) {
    const nextRole = value as AppRole;
    setRole(nextRole);
    if (nextRole !== "facility_user") {
      setMdaId("");
      setFacilityIds([]);
      setLgaFilter("");
    }
    if (nextRole !== "mda_user") {
      setFundingMdas([]);
      setExpenditureMdas([]);
    }
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired. Sign in again.");
        return;
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          role,
          mda_id: mdaId || null,
          facility_ids: isFacility ? facilityIds : [],
          funding_mda_ids: isMdaScoped ? fundingMdas : [],
          expenditure_mda_ids: isMdaScoped ? expenditureMdas : [],
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        user?: AdminUserRecord;
      };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update user access.");
        return;
      }

      if (payload.user) {
        toast.success(`Updated access for ${payload.user.email}.`);
        onSaved(payload.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendEmail(kind: "invite" | "reset") {
    if (!supabase) return;
    setSendingEmail(kind);
    setEmailResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Your session expired. Sign in again.");
        return;
      }

      const response = await fetch(`/api/admin/users/${user.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ kind }),
      });

      const payload = (await response.json()) as {
        error?: string;
        invite?: InviteDelivery;
      };
      if (!response.ok || !payload.invite) {
        toast.error(payload.error ?? "Failed to send the email.");
        return;
      }

      setEmailResult({ kind, invite: payload.invite });
      if (payload.invite.email_sent) {
        toast.success(
          kind === "invite"
            ? `Invite email sent to ${user.email}.`
            : `Password reset email sent to ${user.email}.`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send the email.",
      );
    } finally {
      setSendingEmail(null);
    }
  }

  function handlePrepareAnotherReset() {
    setResetSuccess(null);
    setResetError(null);
    setPassword(generateTemporaryPassword());
  }

  async function handleResetPassword() {
    if (!supabase) return;
    const nextPassword = password.trim();
    if (nextPassword.length < 8) {
      setResetError("Temporary password must be at least 8 characters.");
      return;
    }

    setResetting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setResetError("Your session expired. Sign in again.");
        return;
      }

      const response = await fetch(
        `/api/admin/users/${user.id}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ password: nextPassword }),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        email?: string;
      };
      if (!response.ok) {
        setResetError(payload.error ?? "Failed to reset password.");
        return;
      }

      const email = payload.email ?? user.email;
      setPassword(nextPassword);
      setResetSuccess({ email, password: nextPassword });
      toast.success(`Reset password for ${email}.`);
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Failed to reset password.",
      );
    } finally {
      setResetting(false);
    }
  }

  const roleOptions: ComboboxOption[] = EDITABLE_ROLES.map((value) => ({
    value,
    label: getRoleLabel(value),
  }));

  return (
    <Sheet
      className="max-w-2xl"
      description="Adjust role and MDA-scoped grants. Changes apply immediately for sign-in and entry permissions."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} type="button" onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save access"}
          </Button>
        </div>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={user.full_name ?? user.email}
    >
      <div className="flex flex-col gap-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>We couldn&rsquo;t save these changes</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
          <span className="font-mono text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="edit-full-name">Full name</FieldLabel>
            <Input
              id="edit-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="h-11"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-role">Role</FieldLabel>
            <Combobox
              id="edit-role"
              options={roleOptions}
              value={role}
              onValueChange={handleRoleChange}
            />
          </Field>
        </div>

        {role === "admin" ? (
          <Alert>
            <AlertTitle>Admin accounts are global</AlertTitle>
            <AlertDescription>
              Admins can review, submit, and correct entries across every MDA.
              No per-MDA grants are required.
            </AlertDescription>
          </Alert>
        ) : null}

        {isFacility ? (
          <>
            <ReportingMdaField
              loading={loadingReference}
              mdaId={mdaId}
              mdaOptions={mdaOptions}
              onMdaChange={setMdaId}
            />
            <FacilityGrantPicker
              facilities={facilities}
              lgaFilter={lgaFilter}
              lgaOptions={lgaOptions}
              loading={loadingReference}
              onLgaFilterChange={setLgaFilter}
              onToggleFacility={(id) =>
                setFacilityIds((current) => toggleGrantId(current, id))
              }
              selectedFacilityIds={facilityIds}
            />
          </>
        ) : null}

        {isMdaScoped ? (
          <MdaScopedAccessGrants
            expenditureMdaIds={expenditureMdas}
            fundingMdaIds={fundingMdas}
            loading={loadingReference}
            mdas={mdas}
            onExpenditureIdsChange={setExpenditureMdas}
            onFundingIdsChange={setFundingMdas}
          />
        ) : null}

        {role === "reviewer" ? (
          <p className="text-sm text-muted-foreground">
            Viewers can review funding and expenditure entries for every MDA —
            no per-MDA selection needed.
          </p>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">Email invitations & resets</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Send the user a secure link to set their own password. Use the
              invite if they never activated their account, or the reset if
              they forgot their password.
            </p>
          </div>

          {emailResult && !emailResult.invite.email_sent ? (
            <Alert variant="warning">
              <AlertTitle>The email couldn&rsquo;t be delivered</AlertTitle>
              <AlertDescription>
                <span className="block">
                  {emailResult.invite.email_error ??
                    "The email service rejected the message."}
                </span>
                {emailResult.invite.action_link ? (
                  <span className="mt-2 flex items-center gap-2">
                    <span className="block truncate font-mono text-xs">
                      {emailResult.invite.action_link}
                    </span>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          emailResult.invite.action_link!,
                        );
                        toast.success("Link copied.");
                      }}
                    >
                      <CopyIcon aria-hidden="true" data-icon="inline-start" />
                      Copy link
                    </Button>
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={sendingEmail !== null}
              type="button"
              variant="outline"
              onClick={() => void handleSendEmail("invite")}
            >
              <MailIcon aria-hidden="true" data-icon="inline-start" />
              {sendingEmail === "invite" ? "Sending…" : "Resend invite email"}
            </Button>
            <Button
              disabled={sendingEmail !== null}
              type="button"
              variant="outline"
              onClick={() => void handleSendEmail("reset")}
            >
              <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
              {sendingEmail === "reset"
                ? "Sending…"
                : "Email password reset link"}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">Manual password reset</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fallback when email delivery isn&rsquo;t available: set a
              temporary password and share it securely with the user.
            </p>
          </div>

          {resetSuccess ? (
            <Alert variant="success">
              <AlertTitle className="flex items-center gap-2">
                <ShieldCheckIcon aria-hidden="true" className="size-4" />
                Password reset
              </AlertTitle>
              <AlertDescription>
                <span className="block">
                  Copy these credentials now and share them securely. The user
                  signs in with this exact password.
                </span>
                <span className="mt-2 block font-mono text-xs">
                  Email: {resetSuccess.email}
                </span>
                <span className="mt-1 block font-mono text-xs">
                  Password: {resetSuccess.password}
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          {resetError ? (
            <Alert variant="destructive">
              <AlertTitle>We couldn&rsquo;t reset the password</AlertTitle>
              <AlertDescription>{resetError}</AlertDescription>
            </Alert>
          ) : null}

          {resetSuccess ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrepareAnotherReset}
              >
                Set another password
              </Button>
            </div>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="reset-password">
                  Temporary password
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="reset-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                  At least 8 characters. The user signs in with this password
                  immediately.
                </FieldDescription>
              </Field>

              <div className="flex justify-end">
                <Button
                  disabled={resetting || password.trim().length < 8}
                  type="button"
                  variant="outline"
                  onClick={() => void handleResetPassword()}
                >
                  <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
                  {resetting ? "Resetting…" : "Reset password"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
