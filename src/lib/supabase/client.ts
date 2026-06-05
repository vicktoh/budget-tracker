import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export type TypedSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let browserClient: TypedSupabaseClient | null = null;

export function createClient(): TypedSupabaseClient {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase environment is not configured");
  }

  return createBrowserClient<Database>(
    supabaseUrl as string,
    supabasePublishableKey as string,
  );
}

export const supabase: TypedSupabaseClient | null = hasSupabaseConfig
  ? (browserClient ??= createClient())
  : null;
