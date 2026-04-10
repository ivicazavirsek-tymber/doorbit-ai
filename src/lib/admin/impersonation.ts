import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** HttpOnly cookie set by POST /api/admin/impersonate/start */
export const IMPERSONATION_SESSION_COOKIE = "doorbit_impersonation_session_id";

/**
 * Kada je admin u režimu pregleda korisnika, vraća `target_user_id` iz sesije.
 * Inače vraća JWT korisnikov id.
 */
export async function getEffectiveUserId(
  supabase: SupabaseClient,
  jwtUserId: string
): Promise<string> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(IMPERSONATION_SESSION_COOKIE)?.value;
  if (!sid) {
    return jwtUserId;
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", jwtUserId)
    .maybeSingle();
  if (adminProfile?.role !== "admin") {
    return jwtUserId;
  }

  const { data: row } = await supabase
    .from("impersonation_sessions")
    .select("target_user_id, expires_at, admin_user_id")
    .eq("id", sid)
    .maybeSingle();

  if (
    !row ||
    row.admin_user_id !== jwtUserId ||
    new Date(row.expires_at).getTime() <= Date.now()
  ) {
    return jwtUserId;
  }

  return row.target_user_id;
}
