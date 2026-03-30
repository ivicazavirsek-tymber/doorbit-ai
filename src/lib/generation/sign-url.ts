import type { SupabaseClient } from "@supabase/supabase-js";

export async function signedUrlForOutput(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
  expiresSec = 3600
): Promise<string | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from("generation-outputs")
    .createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
