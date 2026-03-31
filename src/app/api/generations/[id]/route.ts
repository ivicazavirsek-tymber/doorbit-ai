import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { signedUrlForOutput } from "@/lib/generation/sign-url";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const requestId = newRequestId();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Prijavi se.", undefined, { requestId });
  }

  const { data, error } = await supabase
    .from("ai_generations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("generations/[id]", error);
    return jsonError(500, "DB_ERROR", "Greška pri učitavanju generacije.", undefined, {
      requestId,
    });
  }
  if (!data) {
    return jsonError(404, "NOT_FOUND", "Generacija nije pronađena.", undefined, {
      requestId,
    });
  }

  const signed = await signedUrlForOutput(
    supabase,
    data.output_image_storage_path
  );

  if (data.output_image_storage_path && !signed) {
    return jsonError(
      500,
      "SIGN_URL_FAILED",
      "Ne mogu da napravim privremeni link za sliku.",
      { generation_id: data.id },
      { requestId }
    );
  }

  return jsonOk({
    generation: {
      ...data,
      output_image_signed_url: signed,
    },
  });
}
