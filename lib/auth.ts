import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export * from "./session-view";

/**
 * 로그인한 사용자 + role을 가져온다. 세션이 없으면 /login으로 보낸다.
 * 역할별 대시보드 페이지(app/student, app/parent, ...)에서 사용.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  return { user, profile, supabase };
}
