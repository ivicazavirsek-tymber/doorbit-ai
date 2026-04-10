import { getEffectiveUserId } from "@/lib/admin/impersonation";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";

const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  const requestId = newRequestId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Prijavi se.", undefined, { requestId });
  }

  const subjectUserId = await getEffectiveUserId(supabase, user.id);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("page_size") || "20", 10) || 20)
  );
  const type = searchParams.get("type");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("ai_generations")
    .select(
      "id, generation_type, status, credits_cost, created_at, completed_at, output_text, output_image_storage_path, error_message",
      { count: "exact" }
    )
    .eq("user_id", subjectUserId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (type && type.length > 0) {
    q = q.eq("generation_type", type);
  }

  const { data, error, count } = await q;

  if (error) {
    console.error("history", error);
    return jsonError(500, "HISTORY_FAILED", "Ne mogu da učitam istoriju.", undefined, {
      requestId,
    });
  }

  return jsonOk({
    items: data ?? [],
    page,
    page_size: pageSize,
    total: count ?? 0,
  });
}
