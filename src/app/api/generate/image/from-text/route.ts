import { checkRateLimitAllowed } from "@/lib/api/rate-limit";
import { consumeCredits } from "@/lib/api/consume-credits";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getTokenBalance } from "@/lib/api/token-balance";
import { geminiImageFromText } from "@/lib/ai/gemini-image";
import {
  CREDIT_COST_IMAGE,
  RATE_LIMIT_PER_ROUTE_PER_MINUTE,
} from "@/lib/generation/constants";
import { signedUrlForOutput } from "@/lib/generation/sign-url";
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
    "generate_image_from_text",
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "INVALID_JSON", "Telo mora biti JSON.");
  }

  const text_prompt =
    typeof body.text_prompt === "string" ? body.text_prompt.trim() : "";
  const idempotency_key =
    typeof body.idempotency_key === "string"
      ? body.idempotency_key.trim()
      : null;

  if (!text_prompt) {
    return jsonError(400, "INVALID_INPUT", "Polje text_prompt je obavezno.");
  }

  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("ai_generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("generation_type", "image_from_text")
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
      generation_type: "image_from_text",
      status: "pending",
      credits_cost: CREDIT_COST_IMAGE,
      idempotency_key: idempotency_key || null,
      input_text_prompt: text_prompt,
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

  let imageBuf: Buffer;
  try {
    imageBuf = await geminiImageFromText(text_prompt);
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
      "Model za slike nije uspeo posle više pokušaja. Proveri GEMINI_API_KEY i naziv modela.",
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
    return jsonError(500, "STORAGE_UPLOAD", "Čuvanje slike nije uspelo.");
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
    reason: "generation:image_from_text",
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
      generation_type: "image_from_text",
      output_image_path: outPath,
      output_image_signed_url: signed,
      credits_cost: CREDIT_COST_IMAGE,
    },
    balance_after: balanceAfter,
  });
}
