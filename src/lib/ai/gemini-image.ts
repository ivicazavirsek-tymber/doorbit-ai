import { ApiError, GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { FinishReason } from "@google/genai";
import { getGeminiApiKey, getGeminiImageModel } from "@/lib/env";
import { callWithRetry } from "@/lib/retry";

/**
 * Čekanje odgovora za generisanje slike može trajati duže od podrazumevanog HTTP timeout-a u SDK-u (~60s).
 * Zvanični troubleshooting za 504 DEADLINE_EXCEEDED: povećati client timeout
 * (https://ai.google.dev/gemini-api/docs/troubleshooting).
 */
const GEMINI_IMAGE_HTTP_TIMEOUT_MS = 180_000;

/** Preview modeli (npr. gemini-3-pro-image-preview) zahtevaju Gemini API v1alpha; stabilni modeli ostaju na SDK podrazumevanom. */
function createImageGenClient() {
  const key = getGeminiApiKey();
  if (!key) throw new Error("NEDOSTAJE_GEMINI_API_KEY");
  const model = getGeminiImageModel();
  const useV1Alpha = /preview/i.test(model);
  return {
    client: new GoogleGenAI({
      apiKey: key,
      httpOptions: { timeout: GEMINI_IMAGE_HTTP_TIMEOUT_MS },
      ...(useV1Alpha ? { apiVersion: "v1alpha" } : {}),
    }),
    model,
  };
}

/**
 * Konfiguracija za native image output.
 * Napomena: polja poput `personGeneration` u `imageConfig` nisu podržana na Gemini Developer API
 * (API ključ / ai.google.dev) — šalju se samo na Vertexu; slanje ih ovde baca grešku.
 */
function imageGenerationConfig() {
  return {
    responseModalities: [Modality.IMAGE],
  };
}

function explainEmptyImageResponse(res: GenerateContentResponse): string {
  const pf = res.promptFeedback;
  if (pf?.blockReason) {
    const msg = pf.blockReasonMessage
      ? `${pf.blockReason}: ${pf.blockReasonMessage}`
      : String(pf.blockReason);
    return `GEMINI_PROMPT_BLOCKED: ${msg}`;
  }
  const cand = res.candidates?.[0];
  if (cand?.finishReason === FinishReason.SAFETY) {
    return "GEMINI_OUTPUT_SAFETY: Izlaz je odbijen zbog bezbednosnih pravila. Probaj neutralniji opis ili bez portreta dece.";
  }
  if (cand?.finishReason === FinishReason.IMAGE_SAFETY) {
    return "GEMINI_IMAGE_SAFETY: Slika nije dozvoljena po pravilima modela (npr. ličnost / sadržaj).";
  }
  if (cand?.finishReason === FinishReason.NO_IMAGE) {
    return "GEMINI_NO_IMAGE_REASON: Model nije vratio sliku — probaj jednostavniji prompt ili proveri da li ključ ima pristup ovom modelu.";
  }
  if (cand?.finishReason === FinishReason.IMAGE_PROHIBITED_CONTENT) {
    return "GEMINI_IMAGE_PROHIBITED: Zabranjen sadržaj za generisanje slike.";
  }
  const txt = res.text?.trim();
  if (txt) {
    return `GEMINI_NO_IMAGE: Model je vratio tekst umesto slike: ${txt.slice(0, 280)}`;
  }
  return "GEMINI_NO_IMAGE_IN_RESPONSE";
}

function extractImageBuffer(res: GenerateContentResponse): Buffer {
  const fromGetter = res.data;
  if (fromGetter) {
    return Buffer.from(fromGetter, "base64");
  }
  const parts = res.candidates?.[0]?.content?.parts;
  for (const p of parts || []) {
    const d = p?.inlineData;
    if (d?.data) {
      return Buffer.from(d.data, "base64");
    }
  }
  throw new Error(explainEmptyImageResponse(res));
}

function wrapGeminiCallError(e: unknown): never {
  if (e instanceof ApiError) {
    throw new Error(`GEMINI_API_${e.status}: ${e.message}`);
  }
  throw e;
}

const geminiRetryIf = (err: unknown) => {
  const m = err instanceof Error ? err.message : String(err);
  return !/^GEMINI_API_(400|401|403|404|429)\b/.test(m);
};

export async function geminiImageFromText(
  textPrompt: string,
  contextHint?: string
): Promise<Buffer> {
  const { client, model } = createImageGenClient();
  const ctx = contextHint?.trim() ?? "";
  const prompt =
    ctx.length > 0
      ? `${ctx}\n\n---\n\nZahtev za sliku:\n${textPrompt}`
      : textPrompt;
  return callWithRetry(async () => {
    try {
      const res = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: imageGenerationConfig(),
      });
      return extractImageBuffer(res);
    } catch (e) {
      wrapGeminiCallError(e);
    }
  }, { retryIf: geminiRetryIf });
}

export async function geminiImageFromPhoto(
  photo: Buffer,
  mimeType: string,
  sideDescription: string,
  contextHint?: string
): Promise<Buffer> {
  const { client, model } = createImageGenClient();
  const b64 = photo.toString("base64");
  let prompt =
    sideDescription.trim() ||
    "Na osnovu ove fotografije napravi marketinšku sliku za salon (vrata / enterijer), profesionalno osvetljenje.";
  if (contextHint?.trim()) {
    prompt = `${contextHint.trim()}\n\n---\n\n${prompt}`;
  }

  return callWithRetry(async () => {
    try {
      const res = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: { mimeType, data: b64 },
              },
              { text: prompt },
            ],
          },
        ],
        config: imageGenerationConfig(),
      });
      return extractImageBuffer(res);
    } catch (e) {
      wrapGeminiCallError(e);
    }
  }, { retryIf: geminiRetryIf });
}
