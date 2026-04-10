import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AdminApiContext = {
  supabase: SupabaseClient;
  user: User;
};

/** Za /api/admin/* — vraća null ako nije ulogovan ili nije admin. */
export async function requireAdminApi(): Promise<AdminApiContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return null;
  }
  return { supabase, user };
}
