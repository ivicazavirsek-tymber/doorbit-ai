/**
 * Brza provera da li .env.local ključevi rade (bez štampanja tajni).
 * OpenAI / Google naplata ide preko njihovih platformi kada API prihvati zahtev.
 *
 *   node scripts/verify-ai-keys.mjs
 */

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function appEnv() {
  return process.env.APP_ENV?.toLowerCase() === "prod" ? "prod" : "dev";
}

function openAiKey() {
  return appEnv() === "prod"
    ? process.env.OPENAI_API_KEY_PROD || ""
    : process.env.OPENAI_API_KEY_DEV ||
        process.env.OPENAI_API_KEY ||
        "";
}

function geminiKey() {
  return appEnv() === "prod"
    ? process.env.GEMINI_API_KEY_PROD || ""
    : process.env.GEMINI_API_KEY_DEV ||
        process.env.GEMINI_API_KEY ||
        "";
}

async function pingOpenAI() {
  const key = openAiKey();
  if (!key) {
    console.log("OpenAI: SKIP (nema ključa u env za trenutni APP_ENV)");
    return;
  }
  const client = new OpenAI({ apiKey: key });
  // Namerno jeftin/stabilan model samo za ping (ne koristi OPENAI_TEXT_MODEL iz app-a).
  const model = process.env.VERIFY_OPENAI_MODEL?.trim() || "gpt-4o-mini";
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply exactly: OK" }],
      max_completion_tokens: 8,
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (text) {
      console.log("OpenAI: OK (model:", model + ", odgovor:", text.slice(0, 40) + ")");
    } else {
      console.log("OpenAI: UPIT OK ali prazan odgovor (proveri model)");
    }
  } catch (e) {
    console.log("OpenAI: NEUSPEH —", e?.status || "", e?.message || e);
  }
}

async function pingGemini() {
  const key = geminiKey();
  if (!key) {
    console.log("Gemini: SKIP (nema ključa u env za trenutni APP_ENV)");
    return;
  }
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Reply with exactly one word: OK",
    });
    const text = res.text?.trim();
    if (text) {
      console.log("Gemini: OK (gemini-2.5-flash tekst, odgovor:", text.slice(0, 40) + ")");
    } else {
      console.log("Gemini: UPIT OK ali prazan tekst");
    }
  } catch (e) {
    console.log("Gemini: NEUSPEH —", e?.status || "", e?.message || e);
  }
}

console.log("APP_ENV =", appEnv());
await pingOpenAI();
await pingGemini();
console.log("Gotovo.");
