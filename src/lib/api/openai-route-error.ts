/**
 * Mapira poruku iz `openaiGenerateCopy` na HTTP kod za `generationFail`.
 * Korisniku se ne šalju tehnički detalji — samo stabilni `code`.
 */
export function copyOpenAiFailureMeta(msg: string): {
  status: number;
  code: string;
} {
  if (msg.startsWith("OPENAI_QUOTA")) {
    return { status: 429, code: "OPENAI_QUOTA" };
  }
  if (msg.startsWith("OPENAI_API_401") || msg.startsWith("OPENAI_API_403")) {
    return { status: 502, code: "OPENAI_AUTH" };
  }
  return { status: 503, code: "AI_FAILED" };
}
