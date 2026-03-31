/**
 * Test istog toka kao u aplikaciji: generateContent + IMAGE modality.
 * Koristi GEMINI_API_KEY_* i GEMINI_IMAGE_MODEL iz .env.local (kao src/lib/env.ts).
 *
 *   npm run verify:gemini-image
 */

import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function appEnv() {
  return process.env.APP_ENV?.toLowerCase() === "prod" ? "prod" : "dev";
}

function geminiKey() {
  return appEnv() === "prod"
    ? process.env.GEMINI_API_KEY_PROD || ""
    : process.env.GEMINI_API_KEY_DEV ||
        process.env.GEMINI_API_KEY ||
        "";
}

/** Isti fallback kao getGeminiImageModel() u src/lib/env.ts */
function imageModel() {
  return (
    process.env.GEMINI_IMAGE_MODEL?.trim() ||
    "gemini-2.5-flash-image"
  );
}

const key = geminiKey();
const model = imageModel();
const useV1Alpha = /preview/i.test(model);

if (!key) {
  console.error(
    "Nema API ključa: postavi GEMINI_API_KEY_DEV (ili GEMINI_API_KEY) za APP_ENV=dev."
  );
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: key,
  ...(useV1Alpha ? { apiVersion: "v1alpha" } : {}),
});

console.log("APP_ENV =", appEnv());
console.log("Model   =", model, useV1Alpha ? "(API v1alpha)" : "");

try {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Small abstract square, two soft pastel colors, no text, no people.",
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  let bytes = 0;
  if (res.data) {
    bytes = Buffer.from(res.data, "base64").length;
  } else {
    const parts = res.candidates?.[0]?.content?.parts;
    for (const p of parts || []) {
      if (p?.inlineData?.data) {
        bytes += Buffer.from(p.inlineData.data, "base64").length;
      }
    }
  }

  if (bytes > 0) {
    console.log("Gemini slika: OK (izlaz ~", bytes, "bajtova)");
  } else {
    console.error(
      "Gemini: odgovor bez slike. Proveri model, kvotu i da li nalog ima pristup image generisanju."
    );
    process.exit(1);
  }
} catch (e) {
  console.error("Gemini slika: NEUSPEH —", e?.status ?? "", e?.message ?? e);
  process.exit(1);
}

console.log("Gotovo.");
