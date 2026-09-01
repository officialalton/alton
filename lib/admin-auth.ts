import { createClient } from "@/utils/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase, adminUserId: user.id };
}

// R2 Task 8 — R0 §5.1 원칙 4: Supervisor는 역할 문자열이 아니라 capability
// 조합으로 권한을 받는다. `role='admin'`이 아니어도 해당 capability를
// 부여받은 운영자는 통과시킨다 — DB 쪽 SECURITY DEFINER 함수·RLS도 같은
// capability로 별도로 게이트돼 있어야 실제로 의미가 있다(이 함수만으로는
// 앱 레이어 진입만 통과시킬 뿐 DB 권한까지 열어주지 않는다).
export async function requireAdminOrCapability(capability: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") {
    return { supabase, actorUserId: user.id };
  }

  const { data: hasCapability } = await supabase.rpc("current_user_has_capability", {
    p_capability: capability,
  });
  if (!hasCapability) {
    throw new Error("이 작업을 수행할 권한이 없습니다.");
  }
  return { supabase, actorUserId: user.id };
}
