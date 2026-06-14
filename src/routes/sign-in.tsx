"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogInIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getDefaultPathForProfile } from "@/lib/access";

export function SignInRoute() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (profile) {
      router.replace(getDefaultPathForProfile(profile));
    }
  }, [profile, router]);

  if (profile) {
    return null;
  }

  const from = searchParams.get("redirect") ?? "/mda";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    router.replace(from);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kano Health Financing Flow Dashboard</CardTitle>
          <CardDescription>
            Sign in to manage MDA entries, review queues, reference data, and exports.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasSupabaseConfig ? (
            <Alert variant="warning">
              <AlertTitle>Supabase environment is not configured</AlertTitle>
              <AlertDescription>
                Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your local environment.
              </AlertDescription>
            </Alert>
          ) : null}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  autoComplete="email"
                  id="email"
                  placeholder="finance@example.gov.ng"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  autoComplete="current-password"
                  id="password"
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <FieldDescription>
                  Sign in with the email and password issued by your administrator.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <Button disabled={!hasSupabaseConfig || loading} type="submit">
              <LogInIcon aria-hidden="true" data-icon="inline-start" />
              {loading ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
