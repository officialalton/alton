import { createClient } from "@/utils/supabase/server";

// R15-A(2/3) — 컨설턴트 전용 서버 액션(신규 칸반 분리, 선생님 배정 요청 등)이
// 공통으로 쓰는 인증 헬퍼. app/consultant/messenger-actions.ts에 있던 로컬
// 버전과 동일한 검사를 공유 위치로 옮겼다.
export async function requireConsultant() {
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
  if (profile?.role !== "consultant") throw new Error("컨설턴트만 사용할 수 있습니다.");
  return { supabase, user };
}

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

// 2026-09-22(관리자 계정 구조) — 다른 관리자의 등급·capability를 바꾸는 화면·
// 액션 전용. is_master_admin() RLS 헬퍼와 같은 기준(profiles.admin_tier =
// 'master')을 앱 레이어에서도 확인한다(DB SECURITY DEFINER 함수가 최종
// 방어선이고, 이건 사용자에게 더 빨리 에러를 보여주기 위한 것).
export async function requireMasterAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_tier")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || profile.admin_tier !== "master") {
    throw new Error("마스터 관리자만 사용할 수 있습니다.");
  }
  return { supabase, adminUserId: user.id };
}

// R2 Task 8 — R0 §5.1 원칙 4: Supervisor는 역할 문자열이 아니라 capability
// 조합으로 권한을 받는다. `role='admin'`이 아니어도 해당 capability를
// 부여받은 운영자는 통과시킨다 — DB 쪽 SECURITY DEFINER 함수·RLS도 같은
// capability로 별도로 게이트돼 있어야 실제로 의미가 있다(이 함수만으로는
// 앱 레이어 진입만 통과시킬 뿐 DB 권한까지 열어주지 않는다).
//
// 2026-09-22(관리자 계정 구조) — role='admin'이라고 항상 통과시키던 것을
// admin_tier로 좁힌다. master·full(기존 관리자 전원의 기본값 — 오늘과 동일하게
// 무제한)은 그대로 통과, supervisor(마스터가 새로 지정하는 중간 관리자)만
// capability 검사를 실제로 받는다.
export async function requireAdminOrCapability(capability: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_tier")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin" && profile.admin_tier !== "supervisor") {
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
