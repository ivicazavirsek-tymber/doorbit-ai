import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { requireAdminApi } from "@/lib/admin/api-auth";

const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const requestId = newRequestId();
  const ctx = await requireAdminApi();
  if (!ctx) {
    return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("page_size") || "40", 10) || 40)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await ctx.supabase
    .from("admin_audit_logs")
    .select(
      "id, admin_user_id, target_user_id, action_type, meta, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("admin audit", error);
    return jsonError(500, "DB_ERROR", "Ne mogu da učitam audit log.", undefined, {
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
