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

1. U Stripe Dashboard kreiraj **Products** i **Prices** (mesečno/godišnje) i kopiraj Price ID u `STRIPE_PRICE_*_ID_DEV` u `.env.local`.
2. Postavi **`NEXT_PUBLIC_APP_URL`** (npr. `http://localhost:3000`).
3. **`STRIPE_WEBHOOK_SECRET_DEV`**: lokalno `stripe listen --forward-to localhost:3000/api/stripe/webhook` pa kopiraj signing secret.
4. Primeni migraciju `20260330120000_service_grant_tokens.sql` na Supabase (`supabase db push` ili SQL Editor).
5. U Stripe → Webhooks (test), dodaj endpoint kada deployuješ; za dev koristi Stripe CLI.

## Poslednje ažuriranje plana

2026-03-31 — Gemini slike: podrazumevani model `gemini-2.5-flash-image`, `verify:gemini-image` / `verify:ai`, duži HTTP timeout za slike, retry pravila; `grant-tokens` bez naglog `process.exit` u async (Windows). Faza 7 ostaje završena; Faza 9 delimično (pricing + dashboard generacije). Kod sinhronizovan sa GitHub (`main`).
