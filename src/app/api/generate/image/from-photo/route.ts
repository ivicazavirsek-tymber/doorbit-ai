import { checkRateLimitAllowed } from "@/lib/api/rate-limit";
import { consumeCredits } from "@/lib/api/consume-credits";
import { generationFail } from "@/lib/api/generation-http";
import { jsonOk, newRequestId } from "@/lib/api/http";
import { getTokenBalance } from "@/lib/api/token-balance";
import { buildGenerationContextForUser } from "@/lib/ai/generation-context";
import { geminiImageFromPhoto } from "@/lib/ai/gemini-image";
import {
  CREDIT_COST_IMAGE,
  MAX_GENERATION_TEXT_CHARS,
  RATE_LIMIT_PER_ROUTE_PER_MINUTE,
  RATE_LIMIT_RETRY_AFTER_SEC,
} from "@/lib/generation/constants";
import { signedUrlForOutput } from "@/lib/generation/sign-url";
import { extForMime, validateImageFile } from "@/lib/generation/validate-upload";
import { getGeminiImageModel } from "@/lib/env";
import { getEffectiveUserId } from "@/lib/admin/impersonation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const requestId = newRequestId();
  const fail = (
    status: number,
    code: string,
    internalMessage: string,
    details?: unknown,
    headers?: HeadersInit
  ) =>
    generationFail({ requestId, status, code, internalMessage, details, headers });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail(401, "UNAUTHORIZED", "Prijavi se.");
  }

  const subjectUserId = await getEffectiveUserId(supabase, user.id);
  const contextHint = await buildGenerationContextForUser(supabase, subjectUserId);

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return fail(
      500,
      "SERVER_CONFIG",
      "Nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru."
    );
  }

  const okRate = await checkRateLimitAllowed(
    service,
    subjectUserId,
    "generate_image_from_photo",
    RATE_LIMIT_PER_ROUTE_PER_MINUTE
  );
  if (!okRate) {
    return fail(429, "RATE_LIMIT", "Previše zahteva. Pokušaj za minut.", undefined, {
      "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SEC),
    });
  }

  const balance = await getTokenBalance(supabase, subjectUserId);
  if (balance === null) {
    return fail(500, "BALANCE_READ_FAILED", "Ne mogu da pročitam stanje kredita.");
  }
  if (balance < CREDIT_COST_IMAGE) {
    return fail(402, "INSUFFICIENT_TOKENS", "Nemaš dovoljno kredita.", {
      balance_tokens: balance,
      required: CREDIT_COST_IMAGE,
    });
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return fail(
      400,
      "INVALID_CONTENT_TYPE",
      "Koristi multipart/form-data (photo, side_description, opciono idempotency_key)."
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(
      413,
      "PAYLOAD_TOO_LARGE",
      "Zahtev je prevelik ili telo nije validno multipart polje."
    );
  }

  const photoEntry = form.get("photo");
  const side_description = String(form.get("side_description") || "").trim();
  const idempotency_key = String(form.get("idempotency_key") || "").trim();

  if (!(photoEntry instanceof File)) {
    return fail(400, "INVALID_INPUT", "Polje photo (fajl) je obavezno.");
  }

  if (side_description.length > MAX_GENERATION_TEXT_CHARS) {
    return fail(400, "INPUT_TOO_LONG", "Polje side_description je predugačko.", {
      max_chars: MAX_GENERATION_TEXT_CHARS,
    });
  }

  const v = validateImageFile(photoEntry);
  if (!v.ok) {
    return fail(400, "INVALID_IMAGE", v.message);
  }

  const photoBuf = Buffer.from(await v.file.arrayBuffer());
  const photoMime = v.file.type;

  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("ai_generations")
      .select("*")
      .eq("user_id", subjectUserId)
      .eq("generation_type", "image_from_photo")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existing?.status === "succeeded") {
      const url = await signedUrlForOutput(
        supabase,
        existing.output_image_storage_path
      );
      if (existing.output_image_storage_path && !url) {
        return fail(500, "SIGN_URL_FAILED", "sign url failed cached");
      }
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
      return fail(409, "IN_PROGRESS", "Ova generacija je već u toku.", {
        generation_id: existing.id,
      });
    }
    if (existing?.status === "failed") {
      return fail(
        409,
        "IDEMPOTENCY_FAILED",
        "Prethodni pokušaj sa ovim idempotency ključem nije uspeo. Upotrebi novi ključ ili ga izostavi.",
        { generation_id: existing.id }
      );
    }
  }

  const { data: row, error: insErr } = await supabase
    .from("ai_generations")
    .insert({
      user_id: subjectUserId,
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
      return fail(409, "DUPLICATE", "Idempotency ključ je već iskorišćen.");
    }
    console.error(insErr);
    return fail(500, "DB_INSERT", "Ne mogu da kreiram generaciju.");
  }

  const genId = row.id;
  const inPath = `${subjectUserId}/${genId}/input.${extForMime(photoMime)}`;

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
      .eq("user_id", subjectUserId);
    return fail(500, "STORAGE_INPUT", "Upload fotografije nije uspeo.");
  }

  await supabase
    .from("ai_generations")
    .update({ input_image_storage_path: inPath })
    .eq("id", genId)
    .eq("user_id", subjectUserId);

  let imageBuf: Buffer;
  try {
    imageBuf = await geminiImageFromPhoto(
      photoBuf,
      photoMime,
      side_description,
      contextHint.trim() ? contextHint : undefined
    );
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
      .eq("user_id", subjectUserId);
    return fail(503, "AI_FAILED", msg);
  }

  const outPath = `${subjectUserId}/${genId}/output.png`;
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
      .eq("user_id", subjectUserId);
    return fail(500, "STORAGE_OUTPUT", "Čuvanje generisane slike nije uspelo.");
  }

  await supabase
    .from("ai_generations")
    .update({
      status: "succeeded",
      output_image_storage_path: outPath,
      completed_at: new Date().toISOString(),
    })
    .eq("id", genId)
    .eq("user_id", subjectUserId);

  const consume = await consumeCredits(service, {
    userId: subjectUserId,
    amount: CREDIT_COST_IMAGE,
    reason: "generation:image_from_photo",
    idempotencyKey: `consume_gen:${genId}`,
    relatedGenerationId: genId,
  });

  if ("error" in consume) {
    return fail(500, "DEBIT_FAILED", `debit ${consume.error}`);
  }

  const balanceAfter = consume.newBalance;

  const signed = await signedUrlForOutput(supabase, outPath);
  if (!signed) {
    return fail(500, "SIGN_URL_FAILED", "sign url failed after upload");
  }

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
