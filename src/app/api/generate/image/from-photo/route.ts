import { checkRateLimitAllowed } from "@/lib/api/rate-limit";
import { consumeCredits } from "@/lib/api/consume-credits";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getTokenBalance } from "@/lib/api/token-balance";
import { geminiImageFromPhoto } from "@/lib/ai/gemini-image";
import {
  CREDIT_COST_IMAGE,
  RATE_LIMIT_PER_ROUTE_PER_MINUTE,
} from "@/lib/generation/constants";
import { signedUrlForOutput } from "@/lib/generation/sign-url";
import { extForMime, validateImageFile } from "@/lib/generation/validate-upload";
import { getGeminiImageModel } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Prijavi se.");
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return jsonError(
      500,
      "SERVER_CONFIG",
      "Nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru."
    );
  }

  const okRate = await checkRateLimitAllowed(
    service,
    user.id,
    "generate_image_from_photo",
    RATE_LIMIT_PER_ROUTE_PER_MINUTE
  );
  if (!okRate) {
    return jsonError(429, "RATE_LIMIT", "Previše zahteva. Pokušaj za minut.");
  }

  const balance = await getTokenBalance(supabase, user.id);
  if (balance === null) {
    return jsonError(500, "BALANCE", "Ne mogu da pročitam stanje kredita.");
  }
  if (balance < CREDIT_COST_IMAGE) {
    return jsonError(402, "INSUFFICIENT_TOKENS", "Nemaš dovoljno kredita.", {
      balance_tokens: balance,
      required: CREDIT_COST_IMAGE,
    });
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return jsonError(
      400,
      "INVALID_CONTENT_TYPE",
      "Koristi multipart/form-data (photo, side_description, opciono idempotency_key)."
    );
  }

  const form = await request.formData();
  const photoEntry = form.get("photo");
  const side_description = String(form.get("side_description") || "").trim();
  const idempotency_key = String(form.get("idempotency_key") || "").trim();

  if (!(photoEntry instanceof File)) {
    return jsonError(400, "INVALID_INPUT", "Polje photo (fajl) je obavezno.");
  }

  const v = validateImageFile(photoEntry);
  if (!v.ok) {
    return jsonError(400, "INVALID_IMAGE", v.message);
  }

  const photoBuf = Buffer.from(await v.file.arrayBuffer());
  const photoMime = v.file.type;

  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("ai_generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("generation_type", "image_from_photo")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existing?.status === "succeeded") {
      const url = await signedUrlForOutput(
        supabase,
        existing.output_image_storage_path
      );
      return jsonOk({
        cached: true,
        generation: {
          id: existing.id,
          status: existing.status,
          generation_type: existing.generation_type,
          output_image_path: existing.output_image_storage_path,
          output_image_signed_url: url,
          credits_cost: existing.credits_cost,
        },
      });
    }
    if (existing?.status === "pending") {
      return jsonError(409, "IN_PROGRESS", "Ova generacija je već u toku.", {
        id: existing.id,
      });
    }
  }

  const { data: row, error: insErr } = await supabase
    .from("ai_generations")
    .insert({
      user_id: user.id,
      generation_type: "image_from_photo",
      status: "pending",
      credits_cost: CREDIT_COST_IMAGE,
      idempotency_key: idempotency_key || null,
      input_text_prompt: side_description || null,
      ai_provider: "gemini",
      ai_model: getGeminiImageModel(),
      request_meta: {},
    })
    .select("id")
    .single();

  if (insErr || !row) {
    if (insErr?.code === "23505") {
      return jsonError(409, "DUPLICATE", "Idempotency ključ je već iskorišćen.");
    }
    console.error(insErr);
    return jsonError(500, "DB_INSERT", "Ne mogu da kreiram generaciju.");
  }

  const genId = row.id;
  const inPath = `${user.id}/${genId}/input.${extForMime(photoMime)}`;

  const { error: inUp } = await supabase.storage
    .from("generation-inputs")
    .upload(inPath, photoBuf, {
      contentType: photoMime,
      upsert: true,
    });

  if (inUp) {
    await supabase
      .from("ai_generations")
      .update({
        status: "failed",
        error_message: inUp.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", genId)
      .eq("user_id", user.id);
    return jsonError(500, "STORAGE_INPUT", "Upload fotografije nije uspeo.");
  }

  await supabase
    .from("ai_generations")
    .update({ input_image_storage_path: inPath })
    .eq("id", genId)
    .eq("user_id", user.id);

  let imageBuf: Buffer;
  try {
    imageBuf = await geminiImageFromPhoto(photoBuf, photoMime, side_description);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI greška";
    await supabase
      .from("ai_generations")
      .update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", genId)
      .eq("user_id", user.id);
    return jsonError(
      503,
      "AI_FAILED",
      "Model za slike nije uspeo posle više pokušaja.",
      { detail: msg }
    );
  }

  const outPath = `${user.id}/${genId}/output.png`;
  const { error: upErr } = await supabase.storage
    .from("generation-outputs")
    .upload(outPath, imageBuf, {
      contentType: "image/png",
      upsert: true,
    });

  if (upErr) {
    await supabase
      .from("ai_generations")
      .update({
        status: "failed",
        error_message: upErr.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", genId)
      .eq("user_id", user.id);
    return jsonError(500, "STORAGE_OUTPUT", "Čuvanje generisane slike nije uspelo.");
  }

  await supabase
    .from("ai_generations")
    .update({
      status: "succeeded",
      output_image_storage_path: outPath,
      completed_at: new Date().toISOString(),
    })
    .eq("id", genId)
    .eq("user_id", user.id);

  const consume = await consumeCredits(service, {
    userId: user.id,
    amount: CREDIT_COST_IMAGE,
    reason: "generation:image_from_photo",
    idempotencyKey: `consume_gen:${genId}`,
    relatedGenerationId: genId,
  });

  if ("error" in consume) {
    return jsonError(
      500,
      "DEBIT_FAILED",
      "Slika je sačuvana, ali skidanje kredita nije uspelo. Javi podršci.",
      { generation_id: genId, code: consume.error }
    );
  }

  const balanceAfter = consume.newBalance;

  const signed = await signedUrlForOutput(supabase, outPath);

  return jsonOk({
    generation: {
      id: genId,
      status: "succeeded",
      generation_type: "image_from_photo",
      input_image_path: inPath,
      output_image_path: outPath,
      output_image_signed_url: signed,
      credits_cost: CREDIT_COST_IMAGE,
    },
    balance_after: balanceAfter,
  });
}
