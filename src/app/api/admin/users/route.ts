import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

const MAX_PER_PAGE = 100;

export async function GET(request: Request) {
  const requestId = newRequestId();
  const ctx = await requireAdminApi();
  if (!ctx) {
    return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, parseInt(searchParams.get("per_page") || "50", 10) || 50)
  );

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return jsonError(
      500,
      "SERVER_CONFIG",
      "Nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru.",
      undefined,
      { requestId }
    );
  }

  const { data: listData, error: listErr } = await service.auth.admin.listUsers({
    page,
    perPage,
  });

  if (listErr) {
    console.error("admin listUsers", listErr);
    return jsonError(500, "DB_ERROR", "Ne mogu da učitam korisnike.", undefined, {
      requestId,
    });
  }

  const users = listData.users ?? [];
  const ids = users.map((u) => u.id);

  const { data: profiles, error: profErr } =
    ids.length === 0
      ? { data: [], error: null }
      : await ctx.supabase
          .from("profiles")
          .select("user_id, display_name, role, onboarding_completed, created_at")
          .in("user_id", ids);

  if (profErr) {
    console.error("admin profiles", profErr);
    return jsonError(500, "DB_ERROR", "Ne mogu da učitam profile.", undefined, {
      requestId,
    });
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p])
  );

  const items = users.map((u) => {
    const p = profileById.get(u.id);
    return {
      user_id: u.id,
      email: u.email ?? null,
      display_name: p?.display_name ?? null,
      role: p?.role ?? null,
      onboarding_completed: p?.onboarding_completed ?? null,
      created_at: p?.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    };
  });

  return jsonOk({
    items,
    page,
    per_page: perPage,
    total: listData.total ?? users.length,
  });
}
