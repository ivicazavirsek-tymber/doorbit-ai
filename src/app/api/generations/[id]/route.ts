import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { signedUrlForOutput } from "@/lib/generation/sign-url";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Prijavi se.");
  }

  const { data, error } = await supabase
    .from("ai_generations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return jsonError(500, "DB_ERROR", error.message);
  }
  if (!data) {
    return jsonError(404, "NOT_FOUND", "Generacija nije pronađena.");
  }

  const signed = await signedUrlForOutput(
    supabase,
    data.output_image_storage_path
  );

  return jsonOk({
    generation: {
      ...data,
      output_image_signed_url: signed,
    },
  });
}
