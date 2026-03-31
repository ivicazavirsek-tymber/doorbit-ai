import { createClient } from "@/lib/supabase/server";
import { getTokenBalance } from "@/lib/api/token-balance";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";

export async function GET() {
  const requestId = newRequestId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Prijavi se.", undefined, { requestId });
  }

  const balance = await getTokenBalance(supabase, user.id);
  if (balance === null) {
    return jsonError(
      500,
      "BALANCE_READ_FAILED",
      "Nije moguće učitati stanje kredita.",
      undefined,
      { requestId }
    );
  }

  return jsonOk({ balance_tokens: balance });
}
