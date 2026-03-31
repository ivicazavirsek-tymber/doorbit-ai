import { checkRateLimitAllowed } from "@/lib/api/rate-limit";
import { consumeCredits } from "@/lib/api/consume-credits";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { copyOpenAiFailureResponse } from "@/lib/api/openai-route-error";
import { getTokenBalance } from "@/lib/api/token-balance";
import { openaiGenerateCopy } from "@/lib/ai/openai-copy";
import {
  CREDIT_COST_COPY,
  MAX_GENERATION_TEXT_CHARS,
  RATE_LIMIT_PER_ROUTE_PER_MINUTE,
  RATE_LIMIT_RETRY_AFTER_SEC,
} from "@/lib/generation/constants";
import { extForMime, validateImageFile } from "@/lib/generation/validate-upload";
import { getOpenAITextModel } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const requestId = newRequestId();
  const fail = (
    status: number,
    code: string,
    message: string,
    details?: unknown,
    headers?: HeadersInit
  ) => jsonError(status, code, message, details, { requestId, headers });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail(401, "UNAUTHORIZED", "Prijavi se.");
  }

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
    user.id,
    "generate_copy",
    RATE_LIMIT_PER_ROUTE_PER_MINUTE
  );
  if (!okRate) {
    return fail(429, "RATE_LIMIT", "Previše zahteva. Pokušaj za minut.", undefined, {
      "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SEC),
    });
  }

  const balance = await getTokenBalance(supabase, user.id);
  if (balance === null) {
    return fail(500, "BALANCE_READ_FAILED", "Ne mogu da pročitam stanje kredita.");
  }
  if (balance < CREDIT_COST_COPY) {
    return fail(402, "INSUFFICIENT_TOKENS", "Nemaš dovoljno kredita.", {
      balance_tokens: balance,
      required: CREDIT_COST_COPY,
    });
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return fail(
      400,
      "INVALID_CONTENT_TYPE",
      "Koristi multipart/form-data (polje text_preferences, opciono image)."
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
  const text_preferences = String(form.get("text_preferences") || "").trim();
  const idempotency_key = String(form.get("idempotency_key") || "").trim();
  const imageEntry = form.get("image");

  if (!text_preferences) {
    return fail(400, "INVALID_INPUT", "Polje text_preferences je obavezno.");
  }
  if (text_preferences.length > MAX_GENERATION_TEXT_CHARS) {
    return fail(400, "INPUT_TOO_LONG", "Polje text_preferences je predugačko.", {
      max_chars: MAX_GENERATION_TEXT_CHARS,
    });
  }

  let optionalImage: { buffer: Buffer; mimeType: string } | undefined;
  if (imageEntry instanceof File && imageEntry.size > 0) {
    const v = validateImageFile(imageEntry);
    if (!v.ok) {
      return fail(400, "INVALID_IMAGE", v.message);
    }
    const buf = Buffer.from(await v.file.arrayBuffer());
    optionalImage = { buffer: buf, mimeType: v.file.type };
  }

  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("ai_generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("generation_type", "copy_from_optional_image")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existing?.status === "succeeded") {
      return jsonOk({
        cached: true,
        generation: {
          id: existing.id,
          status: existing.status,
          generation_type: existing.generation_type,
          output_text: existing.output_text,
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
      user_id: user.id,
      generation_type: "copy_from_optional_image",
      status: "pending",
      credits_cost: CREDIT_COST_COPY,
      idempotency_key: idempotency_key || null,
      input_text_prompt: text_preferences,
      input_image_storage_path: null,
      ai_provider: "openai",
      ai_model: getOpenAITextModel(),
      request_meta: { had_image: Boolean(optionalImage) },
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
  let finalInputPath: string | null = null;

  if (optionalImage) {
    const inPath = `${user.id}/${genId}/input.${extForMime(optionalImage.mimeType)}`;
    const { error: inUp } = await supabase.storage
      .from("generation-inputs")
      .upload(inPath, optionalImage.buffer, {
        contentType: optionalImage.mimeType,
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
      return fail(500, "STORAGE_INPUT", "Upload ulazne slike nije uspeo.");
    }
    finalInputPath = inPath;
    await supabase
      .from("ai_generations")
      .update({ input_image_storage_path: inPath })
      .eq("id", genId)
      .eq("user_id", user.id);
  }

  let copy: string;
  try {
    copy = await openaiGenerateCopy({
      brief: text_preferences,
      image: optionalImage,
    });
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
    const r = copyOpenAiFailureResponse(msg);
    return fail(r.status, r.code, r.message, r.details);
  }

  await supabase
    .from("ai_generations")
    .update({
      status: "succeeded",
      output_text: copy,
      completed_at: new Date().toISOString(),
    })
    .eq("id", genId)
    .eq("user_id", user.id);

  const consume = await consumeCredits(service, {
    userId: user.id,
    amount: CREDIT_COST_COPY,
    reason: "generation:copy_from_optional_image",
    idempotencyKey: `consume_gen:${genId}`,
    relatedGenerationId: genId,
  });

  if ("error" in consume) {
    return fail(
      500,
      "DEBIT_FAILED",
      "Tekst je sačuvan, ali skidanje kredita nije uspelo. Javi podršci.",
      { generation_id: genId, debit_code: consume.error }
    );
  }

  const balanceAfter = consume.newBalance;

  return jsonOk({
    generation: {
      id: genId,
      status: "succeeded",
      generation_type: "copy_from_optional_image",
      output_text: copy,
      input_image_storage_path: finalInputPath,
      credits_cost: CREDIT_COST_COPY,
    },
    balance_after: balanceAfter,
  });
}
