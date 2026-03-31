export function appEnv(): "dev" | "prod" {
  const v = process.env.APP_ENV?.toLowerCase();
  return v === "prod" ? "prod" : "dev";
}

/** Bazni URL aplikacije (success/cancel Stripe, portal). */
export function getAppBaseUrl(): string {
  const u =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "";
  if (!u) return "";
  if (u.startsWith("http")) return u.replace(/\/$/, "");
  return `https://${u.replace(/\/$/, "")}`;
}

export function getStripeSecretKey(): string {
  return appEnv() === "prod"
    ? process.env.STRIPE_SECRET_KEY_PROD || ""
    : process.env.STRIPE_SECRET_KEY_DEV ||
        process.env.STRIPE_SECRET_KEY ||
        "";
}

export function getStripeWebhookSecret(): string {
  return appEnv() === "prod"
    ? process.env.STRIPE_WEBHOOK_SECRET_PROD || ""
    : process.env.STRIPE_WEBHOOK_SECRET_DEV ||
        process.env.STRIPE_WEBHOOK_SECRET ||
        "";
}

/** Javni ključ za Stripe.js (ako kasnije treba Elements). */
export function getStripePublishableKey(): string {
  return appEnv() === "prod"
    ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_PROD || ""
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_DEV ||
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
        "";
}

/** URL za Supabase (u browseru mora biti NEXT_PUBLIC_*). */
export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (appEnv() === "prod"
      ? process.env.SUPABASE_URL_PROD
      : process.env.SUPABASE_URL_DEV) ||
    ""
  );
}

/** Anon key za Supabase (u browseru mora biti NEXT_PUBLIC_*). */
export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (appEnv() === "prod"
      ? process.env.SUPABASE_ANON_KEY_PROD
      : process.env.SUPABASE_ANON_KEY_DEV) ||
    ""
  );
}

/** Samo server — nikad u klijent. */
export function getSupabaseServiceRoleKey(): string {
  return appEnv() === "prod"
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD || ""
    : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "";
}

export function getOpenAIApiKey(): string {
  return appEnv() === "prod"
    ? process.env.OPENAI_API_KEY_PROD || ""
    : process.env.OPENAI_API_KEY_DEV ||
        process.env.OPENAI_API_KEY ||
        "";
}

export function getGeminiApiKey(): string {
  return appEnv() === "prod"
    ? process.env.GEMINI_API_KEY_PROD || ""
    : process.env.GEMINI_API_KEY_DEV ||
        process.env.GEMINI_API_KEY ||
        "";
}

export function getOpenAITextModel(): string {
  return process.env.OPENAI_TEXT_MODEL || "gpt-5.2";
}

export function getGeminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
}

export function getMaxUploadBytes(): number {
  const n = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 10_485_760;
}
