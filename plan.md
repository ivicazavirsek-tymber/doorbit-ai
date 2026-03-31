# DoorBit AI — plan i status (živi dokument)

Puni arhitektonski plan sa API listama i token pravilima ostaje u Cursor plan fajlu; ovde je **kratak status po fazama** i šta sledi.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Supabase (Auth, Postgres, RLS, Storage) · Stripe (kasnije) · OpenAI (copy) · Google Gemini (slike) · Vercel (kasnije).

## Status faza

| Faza | Naziv | Status |
|------|--------|--------|
| 1 | Plan i arhitektura | **Završeno** |
| 2 | Setup projekta (Next, folderi, `.env.example`) | **Završeno** |
| 3 | Supabase šema (tabele, RLS, funkcije, storage) + migracija `service_*` RPC za Node | **Završeno** (primena na projekat kod tebe) |
| 4 | Auth (login, register, reset, middleware, dashboard/admin placeholder) | **Završeno** |
| 5 | Backend AI (`/api/generate/*`, balance, history, retry, rate limit, consume posle uspeha) | **Završeno** |
| 6 | Error format + edge case-ovi | **Završeno** |
| 7 | Stripe (checkout, webhook, portal) | **Završeno** (primeni migraciju + Stripe env) |
| 8 | Admin (stats, korisnici, token adjust, impersonation, audit) | Na čekanju |
| 9 | UI (landing, pricing, onboarding, dashboard proizvod) | **U toku** (pricing + dashboard generacije u kodu) |
| 10 | E2E / smoke testovi | Na čekanju |
| 11 | Deploy (Vercel, DEV/PROD env) | Na čekanju |

## Dev skripte (lokalno)

- `npm run dev` / `npm run dev:clean` — Next dev server  
- `npm run grant-tokens -- <email|uuid> [iznos]` — postavljanje `credit_balances` (service role); koristi **stvarni** email iz Supabase Auth (ne placeholder)  
- `npm run confirm-email -- <email|uuid>` — potvrda emaila preko Auth Admin API  
- `npm run verify:ai` — provera OpenAI + Gemini **tekst** ključeva  
- `npm run verify:gemini-image` — provera Gemini **slike** (isti model kao u aplikaciji)  

## Bezbednost

- **Nikad** ne commituj `.env.local` ni service role ključeve.  
- `.env.example` je šablon bez tajni (proveri pre push-a).

## Faza 6 (kratko)

- JSON greške: `{ request_id?, error: { code, message, details? } }`; `jsonError` podržava `Retry-After` i ostala zaglavlja.
- Stabilni kodovi u `src/lib/api/error-codes.ts`; generacije: idempotency u statusu `failed` → `IDEMPOTENCY_FAILED` (409) umesto zbunjujućeg `DUPLICATE`.
- Edge: JSON mora biti objekat; multipart `formData` u try/catch (`PAYLOAD_TOO_LARGE`); max dužina teksta (`MAX_GENERATION_TEXT_CHARS`); keš / GET bez signed URL → `SIGN_URL_FAILED`; ujednačen `BALANCE_READ_FAILED`.

## Napomena (redosled vs. plan)

- **Faza 9 (UI dashboard proizvod):** na kontrolnoj tabli su dodata polja za generisanje **pre** zvaničnog završetka faze 9, da bi se lokalno mogao koristiti već gotov backend (faza 5). To je **malo odstupanje u redosledu**, ne u arhitekturi — funkcionalnost i dalje ide preko istih `/api/generate/*` ruta iz plana.

## Generisanje slika (Gemini API — šta treba kod tebe)

1. **`APP_ENV`** u `.env.local` mora odgovarati prefiksu ključa: za `dev` koristi **`GEMINI_API_KEY_DEV`** (ili **`GEMINI_API_KEY`** kao rezervu).
2. **`GEMINI_IMAGE_MODEL`**: podrazumevano je **`gemini-2.5-flash-image`**; za noviji preview model eksplicitno postavi npr. `gemini-3-pro-image-preview` i restartuj `npm run dev`.
3. **Naplata**: u Google AI / Cloud uključi naplatu ili besplatni tier; bez toga API može vratiti 429.
4. **DoorBit tokeni**: na dashboardu treba pozitivan balans (`npm run grant-tokens -- email N` u dev-u).
5. Provera bez UI: `npm run verify:gemini-image` (isti model kao u aplikaciji).
6. **Implementacija u kodu**: `callWithRetry` oko Gemini poziva (bez ponavljanja za 400/401/403/404/429); HTTP **timeout 180 s** za generisanje slika (smanjuje lažne prekide pre odgovora; vidi [troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting) za 504). **Krediti** se skidaju tek posle uspešnog AI + upload-a (faza 5).

## Git / GitHub

- **Remote:** `origin` → `github.com/ivicazavirsek-tymber/doorbit-ai`  
- Poslednji push sa ovog plana: vidi sekciju „Poslednje ažuriranje plana“ ispod.

## Faza 7 (Stripe — šta uraditi lokalno)

1. U Stripe Dashboard kreiraj **Products** i **Prices** (mesečno/godišnje) i kopiraj Price ID u `STRIPE_PRICE_*_ID_DEV` u `.env.local` (uključujući i `STRIPE_PRICE_PRO_YEARLY_ID_DEV`).
2. Postavi **`NEXT_PUBLIC_APP_URL`** (npr. `http://localhost:3000`).
3. **`STRIPE_WEBHOOK_SECRET_DEV`**: lokalno `stripe listen --forward-to localhost:3000/api/stripe/webhook` pa kopiraj signing secret.
4. Primeni migraciju `20260330120000_service_grant_tokens.sql` na Supabase (`supabase db push` ili SQL Editor).
5. U Stripe → Webhooks (test), dodaj endpoint kada deployuješ; za dev koristi Stripe CLI.

### Trenutne cene (DEV / Stripe test)

| Plan key | Price ID | Iznos |
|---|---|---|
| `starter_monthly` | `price_1TH5c1BSdb8AjNiPs0yyN8Zg` | `19.99 EUR / month` |
| `pro_monthly` | `price_1TH5x1BSdb8AjNiPPJnZSnU7` | `49.99 USD / month` |
| `starter_yearly` | `price_1TH5c1BSdb8AjNiPI68W88uT` | `190.00 USD / year` |
| `pro_yearly` | `price_1TH5y4BSdb8AjNiPPybeuX7E` | `480.00 EUR / year` |

Napomena: valute su trenutno mešane (EUR/USD). To tehnički radi, ali je obično bolje da svi planovi budu u istoj valuti.

### Otkazivanje pretplate — očekivana logika i test

- Kada korisnik otkaže u Stripe portalu sa opcijom **cancel at period end**, pretplata ostaje aktivna do `current_period_end`.
- Primer: ako je period `01.02 → 01.03` i korisnik otkaže `25.02`, pristup važi do `01.03` (ne prekida se odmah).
- Na dashboardu prikazujemo: plan, status, datum važenja i poruku „otkazana, ali važi do ...“ kada je `cancel_at_period_end=true`.

**Checklist testiranja (DEV):**
1. Korisnik ima aktivnu pretplatu (`starter_monthly`, `pro_monthly`, `starter_yearly` ili `pro_yearly`).
2. Uđi u Stripe portal preko Dashboard dugmeta i otkaži pretplatu (**at period end**).
3. Potvrdi da webhook primi `customer.subscription.updated` (HTTP 200).
4. U `stripe_subscriptions` proveri `cancel_at_period_end=true`, status i `current_period_end`.
5. U aplikaciji proveri da je poruka o otkazivanju vidljiva i da korisnik i dalje ima pristup do kraja perioda.
6. Posle period end-a (ili simulacijom vremena), status treba da pređe u neaktivan i pristup da bude ukinut.

## Poslednje ažuriranje plana

2026-03-31 — Gemini slike: podrazumevani model `gemini-2.5-flash-image`, `verify:gemini-image` / `verify:ai`, duži HTTP timeout za slike, retry pravila; `grant-tokens` bez naglog `process.exit` u async (Windows). Stripe proširen za `pro_yearly` plan (kod + env + migracija + cene u planu). Dodata kartica statusa pretplate na dashboardu (uključujući „otkazana, ali važi do kraja perioda“). Faza 7 ostaje završena; Faza 9 delimično (pricing + dashboard generacije). Kod sinhronizovan sa GitHub (`main`).
