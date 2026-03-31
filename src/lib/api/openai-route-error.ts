/**
 * Mapira poruku iz `openaiGenerateCopy` na HTTP odgovor za API rutu.
 */
export function copyOpenAiFailureResponse(
  msg: string
): {
  status: number;
  code: string;
  message: string;
  details: { detail: string };
} {
  if (msg.startsWith("OPENAI_QUOTA")) {
    return {
      status: 429,
      code: "OPENAI_QUOTA",
      message:
        "OpenAI kvota je potrošena ili nalog nema aktivnu naplatu. U platform.openai.com proveri Billing i Usage — DoorBit tokeni su nezavisni i ne plaćaju OpenAI.",
      details: { detail: msg },
    };
  }
  if (msg.startsWith("OPENAI_API_401") || msg.startsWith("OPENAI_API_403")) {
    return {
      status: 502,
      code: "OPENAI_AUTH",
      message:
        "OpenAI je odbio ključ (autorizacija). Proveri OPENAI_API_KEY u .env.local i da ključ nije opozvan.",
      details: { detail: msg },
    };
  }
  return {
    status: 503,
    code: "AI_FAILED",
    message:
      "OpenAI nije uspeo posle više pokušaja. Proveri model i ključ; detalj ispod.",
    details: { detail: msg },
  };
}
