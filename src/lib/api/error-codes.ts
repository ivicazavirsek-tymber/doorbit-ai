/**
 * Dokumentacija stabilnih vrednosti `error.code` u JSON telu greške.
 * Klijent može da grana ponašanje po ovim stringovima (ne menjati tekstualne poruke kao kontrakt).
 */
export const API_ERROR_CODES = [
  "UNAUTHORIZED",
  "SERVER_CONFIG",
  "RATE_LIMIT",
  "BALANCE_READ_FAILED",
  "INSUFFICIENT_TOKENS",
  "INVALID_CONTENT_TYPE",
  "INVALID_JSON",
  "INVALID_INPUT",
  "INVALID_IMAGE",
  "INPUT_TOO_LONG",
  "PAYLOAD_TOO_LARGE",
  "IN_PROGRESS",
  "IDEMPOTENCY_FAILED",
  "DUPLICATE",
  "DB_INSERT",
  "DB_ERROR",
  "NOT_FOUND",
  "HISTORY_FAILED",
  "STORAGE_INPUT",
  "STORAGE_UPLOAD",
  "STORAGE_OUTPUT",
  "AI_FAILED",
  "OPENAI_QUOTA",
  "OPENAI_AUTH",
  "DEBIT_FAILED",
  "SIGN_URL_FAILED",
  "STRIPE_CONFIG",
  "STRIPE_ERROR",
  "NO_STRIPE_CUSTOMER",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
