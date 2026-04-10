import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";

type SaveBody = {
  business_name?: unknown;
  main_city?: unknown;
  door_styles?: unknown;
  onboarding_completed?: unknown;
};

export async function POST(request: Request) {
  const requestId = newRequestId();
  const fail = (
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) => jsonError(status, code, message, details, { requestId });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "UNAUTHORIZED", "Prijavi se.");

  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return fail(400, "INVALID_JSON", "Telo mora biti JSON.");
  }

  const businessName =
    typeof body.business_name === "string" ? body.business_name.trim() : "";
  const mainCity = typeof body.main_city === "string" ? body.main_city.trim() : "";
  const stylesRaw = Array.isArray(body.door_styles) ? body.door_styles : [];
  const doorStyles = stylesRaw
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const onboardingCompleted = Boolean(body.onboarding_completed);

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      business_name: businessName || null,
      onboarding_completed: onboardingCompleted,
    })
    .eq("user_id", user.id);

  if (profileErr) {
    return fail(500, "DB_UPDATE_PROFILE", profileErr.message);
  }

  const { error: onboardingErr } = await supabase.from("user_onboarding").upsert(
    {
      user_id: user.id,
      main_city: mainCity || null,
      door_styles: doorStyles.length ? doorStyles : null,
    },
    { onConflict: "user_id" }
  );

  if (onboardingErr) {
    return fail(500, "DB_UPDATE_ONBOARDING", onboardingErr.message);
  }

  return jsonOk({ saved: true });
}
