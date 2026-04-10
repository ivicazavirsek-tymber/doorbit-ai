import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kratak kontekst iz profila i onboardinga za AI prompt (bez PII u logu klijenta).
 */
export async function buildGenerationContextForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const [{ data: p }, { data: o }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, business_name, brand_tone, social_platforms")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_onboarding")
      .select("industry, main_city, website, door_styles, value_proposition")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const lines: string[] = [];

  if (p?.business_name?.trim()) {
    lines.push(`Naziv biznisa: ${p.business_name.trim()}`);
  }
  if (p?.display_name?.trim()) {
    lines.push(`Kontakt ime / brend: ${p.display_name.trim()}`);
  }
  if (p?.brand_tone?.trim()) {
    lines.push(`Ton komunikacije: ${p.brand_tone.trim()}`);
  }
  if (p?.social_platforms?.length) {
    lines.push(`Platforme: ${p.social_platforms.join(", ")}`);
  }

  if (o?.industry?.trim()) {
    lines.push(`Delatnost: ${o.industry.trim()}`);
  }
  if (o?.main_city?.trim()) {
    lines.push(`Lokacija: ${o.main_city.trim()}`);
  }
  if (o?.website?.trim()) {
    lines.push(`Sajt: ${o.website.trim()}`);
  }
  if (o?.door_styles?.length) {
    lines.push(`Stilovi vrata: ${o.door_styles.join(", ")}`);
  }
  if (o?.value_proposition?.trim()) {
    lines.push(`Vrednosna ponuda: ${o.value_proposition.trim()}`);
  }

  if (lines.length === 0) {
    return "";
  }

  return lines.join("\n");
}
