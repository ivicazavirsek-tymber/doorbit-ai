/**
 * Dev: ako postoji tačno jedan auth korisnik, postavi mu balance_tokens.
 * Inače ispiši emailove i izađi sa greškom.
 *
 *   node scripts/grant-tokens-if-single-user.mjs 1000
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

async function listAllUserIds(supabase) {
  const out = [];
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      out.push({ id: u.id, email: u.email || "(bez emaila)" });
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return out;
}

async function main() {
  const amount = Math.max(0, parseInt(process.argv[2] || "1000", 10) || 1000);
  const url = getUrl();
  const key = getServiceKey();

  if (!url || !key) {
    console.error(
      "Nedostaje NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL_DEV ili service role ključ u .env.local."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users = await listAllUserIds(supabase);
  if (users.length === 0) {
    console.error("Nema registrovanih korisnika u Auth.");
    process.exit(1);
  }
  if (users.length > 1) {
    console.error(
      "Na projektu ima više korisnika. Pokreni ručno:\n  npm run grant-tokens -- <email> " +
        amount +
        "\n\nKorisnici:"
    );
    for (const u of users) {
      console.error("  -", u.email, u.id);
    }
    process.exit(1);
  }

  const userId = users[0].id;
  console.log("Jedan nalog:", users[0].email, "→ postavljam balance_tokens na", amount);

  const { data: up, error: upErr } = await supabase
    .from("credit_balances")
    .upsert({ user_id: userId, balance_tokens: amount }, { onConflict: "user_id" })
    .select("balance_tokens")
    .single();

  if (upErr) {
    console.error("Upsert credit_balances:", upErr.message);
    process.exit(1);
  }

  console.log("Gotovo. balance_tokens =", up.balance_tokens);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
