/**
 * One-off: provision the demo facility user via the Supabase Admin API.
 * Creates the auth user properly (GoTrue), then attaches the profile and a
 * single PHC facility assignment. Safe to re-run.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const file = path.join(__dirname, "..", ".env.local");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase URL or service-role key.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const email = "facility@example.gov.ng";
  const password = "ChangeMe123!";
  const fullName = "Facility Officer";

  // 1. Find or create the auth user.
  let userId;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    userId = existing.id;
    console.log(`Auth user already exists: ${userId}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created auth user: ${userId}`);
  }

  // 2. Resolve a reporting MDA and a PHC facility.
  const { data: mda, error: mdaErr } = await admin
    .from("mdas")
    .select("id, name")
    .eq("name", "Ministry of Health (HQ)")
    .maybeSingle();
  if (mdaErr) throw mdaErr;
  if (!mda) throw new Error("Reporting MDA 'Ministry of Health (HQ)' not found.");

  const { data: facility, error: facErr } = await admin
    .from("facilities")
    .select("id, name, lga_id")
    .eq("facility_type", "phc")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (facErr) throw facErr;
  if (!facility) throw new Error("No active PHC facility found.");

  // 3. Profile + assignment (service role bypasses RLS).
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, full_name: fullName, role: "facility_user" });
  if (profileErr) throw profileErr;

  const { error: assignErr } = await admin
    .from("user_facility_assignments")
    .upsert(
      { user_id: userId, facility_id: facility.id, mda_id: mda.id },
      { onConflict: "user_id,facility_id" },
    );
  if (assignErr) throw assignErr;

  console.log(
    `Assigned ${fullName} to facility "${facility.name}" under "${mda.name}".`,
  );
  console.log(`Sign in: ${email} / ${password}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message ?? err);
  process.exit(1);
});
