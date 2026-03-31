import OpenAI, { APIError } from "openai";
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

  return callWithRetry(
    async () => {
      try {
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
      } catch (e) {
        if (e instanceof APIError) {
          if (e.status === 429) {
            throw new Error(
              "OPENAI_QUOTA: Na OpenAI nalogu nema dostupne kvote (HTTP 429). U platform.openai.com proveri naplatu i limite — DoorBit tokeni su nezavisni i ne plaćaju OpenAI."
            );
          }
          throw new Error(`OPENAI_API_${e.status ?? "?"}: ${e.message}`);
        }
        throw e;
      }
    },
    {
      retryIf: (err) =>
        !(
          err instanceof Error &&
          (err.message.startsWith("OPENAI_QUOTA") ||
            /^OPENAI_API_(400|401|403|404|413|422|429)\b/.test(err.message))
        ),
    }
  );
}
