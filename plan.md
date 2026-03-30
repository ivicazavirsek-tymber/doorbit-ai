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
| 6 | Error format + edge case-ovi | U toku / sledeće |
| 7 | Stripe (checkout, webhook, portal) | Na čekanju |
| 8 | Admin (stats, korisnici, token adjust, impersonation, audit) | Na čekanju |
| 9 | UI (landing, pricing, onboarding, dashboard proizvod) | Na čekanju |
| 10 | E2E / smoke testovi | Na čekanju |
| 11 | Deploy (Vercel, DEV/PROD env) | Na čekanju |

## Dev skripte (lokalno)

- `npm run dev` / `npm run dev:clean` — Next dev server  
- `npm run grant-tokens -- <email|uuid> [iznos]` — postavljanje `credit_balances` (service role)  
- `npm run confirm-email -- <email|uuid>` — potvrda emaila preko Auth Admin API  

## Bezbednost

- **Nikad** ne commituj `.env.local` ni service role ključeve.  
- `.env.example` je šablon bez tajni (proveri pre push-a).

## Poslednje ažuriranje plana

2026-03-28 — Faze 1–5 označene kao završene u repou; Faza 6 sledeći korak.
