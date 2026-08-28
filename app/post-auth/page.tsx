import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getRoleHomePath } from "@/lib/auth";

/**
 * 로그인 화면을 거치지 않고 세션만 새로 생겼을 때(예: 비밀번호 설정 직후)
 * 역할에 맞는 홈으로 보내주는 공용 경유지.
 */
export default async function PostAuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(getRoleHomePath(profile?.role));
}
