import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isAuthLandingPage =
    path === "/login" ||
    path === "/register" ||
    path === "/forgot-password";

  if (user && isAuthLandingPage) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const dest =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
        ? nextParam
        : "/dashboard";
    const redirect = NextResponse.redirect(new URL(dest, request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  if (path.startsWith("/dashboard") || path.startsWith("/onboarding")) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      const redirect = NextResponse.redirect(login);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      path.startsWith("/dashboard") &&
      profile &&
      !profile.onboarding_completed &&
      profile.role !== "admin"
    ) {
      const redirect = NextResponse.redirect(new URL("/onboarding", request.url));
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    if (path.startsWith("/onboarding") && profile?.onboarding_completed) {
      const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }
  }

  if (path.startsWith("/admin")) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      const redirect = NextResponse.redirect(login);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }
  }

  return supabaseResponse;
}
