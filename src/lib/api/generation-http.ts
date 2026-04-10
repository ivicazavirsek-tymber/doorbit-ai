import { jsonError, type JsonErrorInit } from "@/lib/api/http";

/**
 * Klijent dobija samo bezbedne poruke (bez imena provajdera / sirovog API odgovora).
 * Puni kontekst ide u server log.
 */
const PUBLIC_MESSAGE: Record<string, string> = {
  UNAUTHORIZED: "Prijavi se da bi koristio generisanje.",
  FORBIDDEN: "Nemaš dozvolu za ovu akciju.",
  RATE_LIMIT: "Previše zahteva u kratkom roku. Sačekaj minut i pokušaj ponovo.",
  INSUFFICIENT_TOKENS:
    "Nemaš dovoljno kredita za ovu generaciju. Možeš dopuniti na stranici sa cenama.",
  INVALID_JSON: "Zahtev nije ispravno poslat. Osveži stranicu i pokušaj ponovo.",
  INVALID_CONTENT_TYPE: "Neispravan format zahteva.",
  INVALID_INPUT: "Proveri unos i pokušaj ponovo.",
  INVALID_IMAGE: "Slika nije prihvaćena. Proveri format i veličinu.",
  INPUT_TOO_LONG: "Tekst je predugačak. Skrati ga i pokušaj ponovo.",
  PAYLOAD_TOO_LARGE: "Zahtev je prevelik. Smanji prilog ili tekst.",
  DUPLICATE: "Ovaj zahtev je već obrađen.",
  IN_PROGRESS: "Ova generacija je već u toku. Sačekaj da se završi.",
  IDEMPOTENCY_FAILED:
    "Prethodni pokušaj nije uspeo. Pošalji nov zahtev bez starog idempotency ključa.",
  DB_INSERT: "Došlo je do greške pri čuvanju. Pokušaj ponovo ili kontaktiraj podršku.",
  BALANCE_READ_FAILED:
    "Trenutno ne možemo da pročitamo stanje kredita. Pokušaj ponovo za minut.",
  STORAGE_INPUT: "Upload materijala nije uspeo. Pokušaj ponovo.",
  STORAGE_UPLOAD: "Čuvanje rezultata nije uspelo. Pokušaj ponovo.",
  STORAGE_OUTPUT: "Čuvanje rezultata nije uspelo. Pokušaj ponovo.",
  SIGN_URL_FAILED:
    "Privremeni link za prikaz nije mogao da se napravi. Pokušaj ponovo.",
  DEBIT_FAILED:
    "Generisanje je uspelo, ali ažuriranje kredita nije. Javi podršci (navedi vreme pokušaja).",
  SERVER_CONFIG:
    "Servis je privremeno nedostupan. Pokušaj kasnije ili kontaktiraj podršku.",
  AI_FAILED:
    "Došlo je do greške pri generisanju. Pokušaj ponovo kasnije ili kontaktiraj podršku.",
  OPENAI_AUTH:
    "Došlo je do greške pri generisanju. Pokušaj ponovo kasnije ili kontaktiraj podršku.",
  OPENAI_QUOTA:
    "Servis za tekst je trenutno zauzet ili nedostupan. Pokušaj ponovo za nekoliko minuta.",
};

/** Kodovi gde `details` sme da stigne do klijenta (bez sirovog spoljnog API-ja). */
const CLIENT_DETAILS_OK = new Set([
  "INSUFFICIENT_TOKENS",
  "INPUT_TOO_LONG",
  "INVALID_INPUT",
  "DUPLICATE",
  "IN_PROGRESS",
  "IDEMPOTENCY_FAILED",
  "INVALID_JSON",
  "INVALID_CONTENT_TYPE",
  "PAYLOAD_TOO_LARGE",
  "INVALID_IMAGE",
  "RATE_LIMIT",
]);

type GenerationFailArgs = {
  requestId: string;
  status: number;
  code: string;
  /** Interna poruka / stack — samo log, ne šalje se korisniku ako postoji javna mapa. */
  internalMessage?: string;
  /** Za log; klijent dobija samo bezbedan rezidual. */
  details?: unknown;
  headers?: HeadersInit;
};

export function generationFail(args: GenerationFailArgs) {
  const { requestId, status, code, internalMessage, details, headers } = args;
  const publicMsg =
    PUBLIC_MESSAGE[code] ??
    "Došlo je do neočekivane greške. Pokušaj ponovo ili kontaktiraj podršku.";

  console.error("[api/generate]", {
    code,
    requestId,
    internalMessage: internalMessage ?? publicMsg,
    details,
  });

  let clientDetails: unknown = undefined;
  if (details !== undefined && CLIENT_DETAILS_OK.has(code)) {
    clientDetails = details;
  }

  const init: JsonErrorInit = { requestId, headers };
  return jsonError(status, code, publicMsg, clientDetails, init);
}
