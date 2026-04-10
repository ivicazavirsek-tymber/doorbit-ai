/**
 * Primenjuje migraciju admin_adjust_tokens i postavlja admin ulogu.
 *
 * Upotreba:
 *   node scripts/apply-admin-migration.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function appEnv() {
  return process.env.APP_ENV?.toLowerCase() === "prod" ? "prod" : "dev";
}

function getUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (appEnv() === "prod"
      ? process.env.SUPABASE_URL_PROD
      : process.env.SUPABASE_URL_DEV) ||
    ""
  );
}

function getServiceKey() {
  return (
    (appEnv() === "prod"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD
      : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV) ||
    ""
  );
}

const url = getUrl();
const key = getServiceKey();

if (!url || !key) {
  console.error("❌ Nedostaje SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY u .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`\n📋 Supabase: ${url}  (${appEnv()})\n`);

// --- 1. Listaj korisnike ---
const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 50,
});

if (listErr) {
  console.error("❌ Ne mogu da učitam korisnike:", listErr.message);
  process.exit(1);
}

const users = listData.users ?? [];
if (users.length === 0) {
  console.log("⚠️  Nema registrovanih korisnika u Auth. Registruj se prvo.\n");
  process.exit(0);
}

console.log("👥 Registrovani korisnici:");
for (const u of users) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("user_id", u.id)
    .maybeSingle();
  const role = profile?.role ?? "?";
  const name = profile?.display_name ?? "";
  console.log(
    `   ${u.email ?? "bez emaila"}  [${role}]  ${name}  (${u.id})`
  );
}

// --- 2. Postavi prvog korisnika kao admin ako nema nijednog admina ---
const { data: adminExists } = await supabase
  .from("profiles")
  .select("user_id")
  .eq("role", "admin")
  .limit(1)
  .maybeSingle();

if (adminExists) {
  console.log(`\n✅ Admin već postoji (user_id: ${adminExists.user_id}).`);
} else {
  const firstUser = users[0];
  console.log(
    `\n🔧 Nema admina. Postavljam prvog korisnika kao admin: ${firstUser.email ?? firstUser.id}`
  );
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("user_id", firstUser.id);
  if (upErr) {
    console.error("❌ Greška pri postavljanju admin uloge:", upErr.message);
  } else {
    console.log("✅ Admin uloga postavljena.");
  }
}

// --- 3. Proveri da li admin_adjust_tokens RPC već postoji ---
const { error: rpcTest } = await supabase.rpc("admin_adjust_tokens", {
  p_target_user_id: "00000000-0000-0000-0000-000000000000",
  p_delta: 1,
  p_reason: "__migration_test__",
});

const rpcMsg = rpcTest?.message?.toLowerCase() ?? "";
const rpcExists =
  !rpcMsg.includes("could not find the function") &&
  !rpcMsg.includes("function") &&
  !rpcMsg.includes("does not exist");

if (rpcExists) {
  console.log("\n✅ RPC admin_adjust_tokens je već dostupna u PostgREST.\n");
} else {
  console.log("\n⚠️  RPC admin_adjust_tokens NIJE pronađena u PostgREST.");
  console.log("   Ovo znači da migracija još nije primenjena.");
  console.log("   Sledi uputstvo za SQL Editor u sledećem koraku.\n");

  const migPath = path.join(
    root,
    "supabase",
    "migrations",
    "20260405120000_admin_adjust_tokens.sql"
  );
  if (fs.existsSync(migPath)) {
    const sql = fs.readFileSync(migPath, "utf-8");
    console.log("─".repeat(60));
    console.log("KOPIRAJ OVAJ SQL U SUPABASE SQL EDITOR:");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
  }
}

console.log("Gotovo.\n");
