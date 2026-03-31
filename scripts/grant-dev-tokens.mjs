/**
 * Postavlja balance_tokens za korisnika (dev).
 * Koristi SUPABASE_SERVICE_ROLE_KEY iz .env.local — ne commituj taj ključ.
 *
 * Upotreba:
 *   npm run grant-tokens -- korisnik@example.com 500
 *   npm run grant-tokens -- 967e4b25-668e-4423-acc8-3a8a8f4d1c13 500
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
  const arg2 = process.argv[3];

  if (!arg1) {
    console.log(`
Korišćenje:
  npm run grant-tokens -- <email ILI user-uuid> [iznos]

Primeri (zameni email stvarnim nalogom iz Supabase auth):
  npm run grant-tokens -- ime.prezime@gmail.com 500
  npm run grant-tokens -- 967e4b25-668e-4423-acc8-3a8a8f4d1c13 500

Podrazumevani iznos ako ga izostaviš: 500
`);
    return 1;
  }

  // Napomena: `parseInt(...) || 500` tretira 0 kao „falsy“ i vraća 500 — zato eksplicitno za arg2.
  const amountRaw = process.argv[3];
  const amount =
    amountRaw === undefined || amountRaw === ""
      ? 500
      : Math.max(0, Number.parseInt(amountRaw, 10) || 0);
  const url = getUrl();
  const key = getServiceKey();

  if (!url || !key) {
    console.error(
      "Greška: u .env.local moraju biti NEXT_PUBLIC_SUPABASE_URL (ili SUPABASE_URL_DEV) i SUPABASE_SERVICE_ROLE_KEY_DEV."
    );
    return 1;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = arg1.trim();
  if (!uuidRe.test(userId)) {
    try {
      const id = await findUserIdByEmail(supabase, userId);
      if (!id) {
        console.error("Nisam našao korisnika sa emailom:", userId);
        return 1;
      }
      console.log("Pronađen korisnik:", userId, "→", id);
      userId = id;
    } catch (e) {
      console.error("Auth admin listUsers greška:", e?.message || e);
      return 1;
    }
  }

  const { data: up, error: upErr } = await supabase
    .from("credit_balances")
    .upsert(
      { user_id: userId, balance_tokens: amount },
      { onConflict: "user_id" }
    )
    .select("balance_tokens")
    .single();

  if (upErr) {
    console.error("Upsert credit_balances neuspeo:", upErr.message);
    return 1;
  }

  console.log("Gotovo. balance_tokens =", up.balance_tokens);
  return 0;
}

main()
  .then((code) => {
    process.exit(typeof code === "number" ? code : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
