"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

type VerifyState =
  | { status: "verifying" }
  | { status: "ready"; email: string | null }
  | { status: "error"; message: string };

export function AcceptInviteRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const kind = searchParams.get("kind") === "reset" ? "reset" : "invite";

  const [verifyState, setVerifyState] = React.useState<VerifyState>({
    status: "verifying",
  });
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!supabase) {
      setVerifyState({
        status: "error",
        message: "Supabase environment is not configured.",
      });
      return;
    }
    if (!tokenHash) {
      setVerifyState({
        status: "error",
        message:
          "This link is missing its security token. Use the full link from your email.",
      });
      return;
    }

    let active = true;
    (async () => {
      const { data, error } = await supabase!.auth.verifyOtp({
        type: "recovery",
        token_hash: tokenHash,
      });
      if (!active) return;
      if (error || !data.session) {
        // The token is single-use; if it was already consumed (e.g. a repeat
        // mount) but left us with a valid session, continue with that.
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        if (!active) return;
        if (session) {
          setVerifyState({ status: "ready", email: session.user.email ?? null });
          return;
        }
        setVerifyState({
          status: "error",
          message:
            error?.message ??
            "This link is invalid or has expired. Ask your administrator to send a new one.",
        });
        return;
      }
      setVerifyState({ status: "ready", email: data.session.user.email ?? null });
    })();

    return () => {
      active = false;
    };
  }, [tokenHash]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaveError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setSaveError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setSaveError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    toast.success("Your password is set. Welcome!");
    router.replace("/");
  }

  const copy =
    kind === "invite"
      ? {
          title: "Accept your invitation",
          description:
            "You've been invited to the Kano Health Financing Flow Dashboard. Choose a password to activate your account.",
          submit: "Activate account",
        }
      : {
          title: "Reset your password",
          description:
            "Choose a new password for your Kano Health Financing Flow Dashboard account.",
          submit: "Save new password",
        };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasSupabaseConfig ? (
            <Alert variant="warning">
              <AlertTitle>Supabase environment is not configured</AlertTitle>
              <AlertDescription>
                Add NEXT_PUBLIC_SUPABASE_URL and
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your local environment.
              </AlertDescription>
            </Alert>
          ) : null}

          {verifyState.status === "verifying" ? (
            <p className="text-sm text-muted-foreground">
              Verifying your link…
            </p>
          ) : null}

          {verifyState.status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>We couldn&rsquo;t verify this link</AlertTitle>
              <AlertDescription>{verifyState.message}</AlertDescription>
            </Alert>
          ) : null}

          {verifyState.status === "ready" ? (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {verifyState.email ? (
                <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheckIcon
                      aria-hidden="true"
                      className="size-4 text-status-approved"
                    />
                    <span className="font-mono text-xs">{verifyState.email}</span>
                  </span>
                </div>
              ) : null}

              {saveError ? (
                <Alert variant="destructive">
                  <AlertTitle>We couldn&rsquo;t set this password</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              ) : null}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <Input
                    autoComplete="new-password"
                    id="new-password"
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <FieldDescription>
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    autoComplete="new-password"
                    id="confirm-password"
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button disabled={saving} type="submit">
                <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
                {saving ? "Saving…" : copy.submit}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
