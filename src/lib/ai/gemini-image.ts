import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { getGeminiApiKey, getGeminiImageModel } from "@/lib/env";
import { callWithRetry } from "@/lib/retry";

function getClient() {
  const key = getGeminiApiKey();
  if (!key) throw new Error("NEDOSTAJE_GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
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
  throw new Error("GEMINI_NO_IMAGE_IN_RESPONSE");
}

export async function geminiImageFromText(textPrompt: string): Promise<Buffer> {
  const ai = getClient();
  const model = getGeminiImageModel();
  return callWithRetry(async () => {
    const res = await ai.models.generateContent({
      model,
      contents: textPrompt,
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    return extractImageBuffer(res);
  });
}

export async function geminiImageFromPhoto(
  photo: Buffer,
  mimeType: string,
  sideDescription: string
): Promise<Buffer> {
  const ai = getClient();
  const model = getGeminiImageModel();
  const b64 = photo.toString("base64");
  const prompt =
    sideDescription.trim() ||
    "Na osnovu ove fotografije napravi marketinšku sliku za salon (vrata / enterijer), profesionalno osvetljenje.";

  return callWithRetry(async () => {
    const res = await ai.models.generateContent({
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
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    return extractImageBuffer(res);
  });
}
