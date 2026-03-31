/** Krediti po planu (Faza 5). */
export const CREDIT_COST_IMAGE = 20;
export const CREDIT_COST_COPY = 1;

/** Zahteva po korisniku i ruti u prozoru od 1 min (sp_check_rate_limit). */
export const RATE_LIMIT_PER_ROUTE_PER_MINUTE = 30;

/** Zaglavlje `Retry-After` (sekunde) za 429 odgovore. */
export const RATE_LIMIT_RETRY_AFTER_SEC = 60;

/** Maks. dužina tekstualnog polja (prompt, preferencije, opis) u generaciji. */
export const MAX_GENERATION_TEXT_CHARS = 8000;

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
