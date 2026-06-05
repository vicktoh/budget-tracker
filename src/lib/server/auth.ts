import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/server/env";

export function createServiceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
      },
    },
  );
}

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    throw new Error("Missing Authorization header");
  }

  const serviceClient = createServiceClient();
  const token = authorization.replace("Bearer ", "");
  const { data, error } = await serviceClient.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid Supabase session");
  }

  return { serviceClient, user: data.user };
}
