import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MailIcon } from "lucide-react";
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
  const location = useLocation();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (profile) {
    return <Navigate replace to={getDefaultPathForProfile(profile)} />;
  }

  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/mda";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${from}`,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Magic link sent. Check your email to continue.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kano Health Finance Tracker</CardTitle>
          <CardDescription>
            Sign in to manage MDA entries, review queues, reference data, and exports.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasSupabaseConfig ? (
            <Alert variant="warning">
              <AlertTitle>Supabase environment is not configured</AlertTitle>
              <AlertDescription>
                Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local environment.
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
                <FieldDescription>
                  Supabase Auth sends a secure sign-in link to this address.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <Button disabled={!hasSupabaseConfig || loading} type="submit">
              <MailIcon aria-hidden="true" data-icon="inline-start" />
              {loading ? "Sending link" : "Send magic link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
