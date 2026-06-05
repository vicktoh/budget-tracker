import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";

export function createServiceClient() {
  return createClient(
    requireEnv("SUPABASE_URL"),
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
