import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { AppProfile } from "@/lib/auth-types";
import { loadProfileForUser } from "@/lib/db/memberships";
import { ImportError, importableLedgers } from "@/lib/imports/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the caller's cookie-scoped Supabase client and profile for an
 * import API route. Facility users and Viewers have no import access.
 */
export async function importRouteContext(): Promise<{ client: SupabaseClient; profile: AppProfile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ImportError("Not authenticated.", 401, "unauthenticated");
  const profile = await loadProfileForUser(supabase, user);
  if (importableLedgers(profile).length === 0) {
    throw new ImportError("Imports need a funding or expenditure submit grant.", 403, "forbidden");
  }
  return { client: supabase as unknown as SupabaseClient, profile };
}

export function importErrorResponse(error: unknown): NextResponse {
  if (error instanceof ImportError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[imports]", error);
  return NextResponse.json({ error: "The import request failed unexpectedly. Nothing was inserted." }, { status: 500 });
}
