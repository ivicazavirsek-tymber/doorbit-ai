import { createClient } from "@/lib/supabase/server";
import { getTokenBalance } from "@/lib/api/token-balance";
import { jsonError, jsonOk } from "@/lib/api/http";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Prijavi se.");
  }

  const balance = await getTokenBalance(supabase, user.id);
  if (balance === null) {
    return jsonError(500, "BALANCE_READ_FAILED", "Nije moguće učitati stanje kredita.");
  }

  return jsonOk({ balance_tokens: balance });
}
