import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { getRoleHomePath } from "@/lib/session-view";

const ROLE_PREFIXES: Record<string, string> = {
  student: "/student",
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

export async function middleware(request: NextRequest) {
  const { supabaseResponse, supabase, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const matchedPrefix = Object.values(ROLE_PREFIXES).find((prefix) =>
    path.startsWith(prefix)
  );
  if (!matchedPrefix) {
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const homePath = getRoleHomePath(profile?.role);
  if (!path.startsWith(homePath) || homePath === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/student/:path*", "/parent/:path*", "/teacher/:path*", "/admin/:path*"],
};
