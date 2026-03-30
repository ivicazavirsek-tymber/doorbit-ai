/**
 * Potvrđuje email korisnika preko Auth Admin API (dev).
 * Isto kao ručni UPDATE na email_confirmed_at, ali bez SQL Editora.
 *
 *   npm run confirm-email -- zavirsek@live.com
 *   npm run confirm-email -- 967e4b25-668e-4423-acc8-3a8a8f4d1c13
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
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
  return appEnv() === "prod"
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD || ""
    : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "";
}

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findUserIdByEmail(supabase, email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  const arg1 = process.argv[2];

  if (!arg1) {
    console.log(`
Korišćenje:
  npm run confirm-email -- <email ILI user-uuid>

Primer:
  npm run confirm-email -- zavirsek@live.com
`);
    process.exit(1);
  }

  const url = getUrl();
  const key = getServiceKey();

  if (!url || !key) {
    console.error(
      "Greška: u .env.local moraju biti URL i SUPABASE_SERVICE_ROLE_KEY_DEV."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = arg1.trim();
  if (!uuidRe.test(userId)) {
    const id = await findUserIdByEmail(supabase, userId);
    if (!id) {
      console.error("Nisam našao korisnika:", userId);
      process.exit(1);
    }
    console.log("Korisnik:", userId, "→", id);
    userId = id;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    console.error("updateUserById greška:", error.message);
    process.exit(1);
  }

  console.log("Gotovo. Email potvrđen za:", data.user?.email ?? userId);
  console.log("email_confirmed_at:", data.user?.email_confirmed_at ?? "(proveri u Dashboardu)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
