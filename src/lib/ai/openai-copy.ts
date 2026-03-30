import OpenAI from "openai";
import { getOpenAIApiKey, getOpenAITextModel } from "@/lib/env";
import { callWithRetry } from "@/lib/retry";

function getClient() {
  const key = getOpenAIApiKey();
  if (!key) throw new Error("NEDOSTAJE_OPENAI_API_KEY");
  return new OpenAI({ apiKey: key });
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function openaiGenerateCopy(params: {
  brief: string;
  image?: { buffer: Buffer; mimeType: string };
}): Promise<string> {
  const client = getClient();
  const model = getOpenAITextModel();

  const parts: ContentPart[] = [
    {
      type: "text",
      text:
        "Ti si copywriter za salone vrata i enterijera. Napiši kratak, konkretan tekst za društvene mreže na srpskom (latinica), bez uvoda u stilu 'Evo teksta'. " +
          "Zahtev klijenta:\n\n" +
          params.brief,
    },
  ];

  if (params.image) {
    const url = `data:${params.image.mimeType};base64,${params.image.buffer.toString("base64")}`;
    parts.push({
      type: "image_url",
      image_url: { url },
    });
  }

  return callWithRetry(async () => {
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: parts,
        },
      ],
      max_completion_tokens: 2048,
    });
    const out = res.choices[0]?.message?.content?.trim();
    if (!out) throw new Error("OPENAI_EMPTY_OUTPUT");
    return out;
  });
}
