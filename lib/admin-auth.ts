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

// 2026-09-29(온보딩 시나리오 감사) — 배정 이후의 상담 진행(수락·거절·결과 기록)은 담당 컨설턴트의
// 몫이다. DB RPC(admin_accept/reject_consultation·admin_record_consultation_outcome)는 이미
// "관리자 또는 담당 컨설턴트"만 통과시키는데, 서버 액션이 requireAdmin()이라 컨설턴트 화면의
// 같은 버튼이 항상 "관리자만 사용할 수 있습니다"로 막혀 있었다(막다른 길). 이 헬퍼는 관리자나
// 컨설턴트 역할만 통과시키고, 담당 여부는 사용자 세션으로 호출하는 RPC가 최종 판정한다.
export async function requireAdminOrConsultant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "consultant") {
    throw new Error("관리자 또는 담당 컨설턴트만 사용할 수 있습니다.");
  }
  return { supabase, actorUserId: user.id, role: profile.role as "admin" | "consultant" };
}

// 상담 하나에 대한 작업(체험 진행 확정 등): 관리자·capability 보유자, 또는 그 상담의 담당 컨설턴트.
export async function requireAdminCapabilityOrAssignedConsultant(capability: string, consultationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase.from("profiles").select("role, admin_tier").eq("id", user.id).single();
  if (profile?.role === "admin" && profile.admin_tier !== "supervisor") {
    return { supabase, actorUserId: user.id };
  }
  if (profile?.role === "consultant") {
    const { data: row } = await supabase
      .from("consultations")
      .select("admissions_consultant_id")
      .eq("id", consultationId)
      .maybeSingle();
    if (row?.admissions_consultant_id === user.id) return { supabase, actorUserId: user.id };
    throw new Error("담당 컨설턴트만 이 상담을 진행할 수 있습니다.");
  }
  const { data: hasCapability } = await supabase.rpc("current_user_has_capability", { p_capability: capability });
  if (!hasCapability) throw new Error("이 작업을 수행할 권한이 없습니다.");
  return { supabase, actorUserId: user.id };
}

// 2026-10-06(오너 확정) — 수취 계좌 전체 번호를 다루는 작업(대리 입력·수정, 전체 번호 보기)은 일반 관리자 전원이 아니라
// **마스터 관리자 또는 정산권한 보유 관리자**만 한다. DB 함수(payout_account_staff_allowed 등)가 같은 기준으로 최종 방어한다.
// 교사·컨설턴트 계좌가 같은 기준을 쓰도록 이 헬퍼를 공유한다.
export async function requirePayoutAccountStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase.from("profiles").select("role, admin_tier").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("이 작업을 수행할 권한이 없습니다.");
  if (profile.admin_tier !== "master") {
    const { data: hasCapability } = await supabase.rpc("current_user_has_capability", { p_capability: "정산권한" });
    if (!hasCapability) throw new Error("이 작업을 수행할 권한이 없습니다(정산권한 또는 마스터 관리자 필요).");
  }
  return { supabase, actorUserId: user.id };
}

// 2026-10-07(Mercury 지급 통합) — 정산·지급·회계 권한 분리. 마스터 관리자는 전부 허용, 그 외는 해당 capability가 있어야 한다.
// "view"는 마스터 또는 정산·지급·회계 관련 capability(레거시 '정산권한' 포함) 중 하나면 된다. DB 함수(payout_actor_can 등)가 같은 기준으로 최종 방어한다.
export type PayoutCapability =
  | "view"
  | "payout_settlement_edit"
  | "payout_settlement_approve"
  | "payout_request_mercury"
  | "payout_approve_mercury"
  | "accounting_reconcile";

export async function requirePayoutCapability(capability: PayoutCapability) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role, admin_tier").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("You do not have permission for this action.");
  if (profile.admin_tier === "master") return { supabase, actorUserId: user.id };
  if (capability === "view") {
    const { data: canView } = await supabase.rpc("payout_staff_can_view");
    if (canView) return { supabase, actorUserId: user.id };
  } else {
    const { data: has } = await supabase.rpc("current_user_has_capability", { p_capability: capability });
    if (has) return { supabase, actorUserId: user.id };
  }
  throw new Error(`You do not have permission for this action (requires ${capability}).`);
}
