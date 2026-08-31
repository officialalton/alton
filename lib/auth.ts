import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getRoleHomePath } from "./session-view";

export * from "./session-view";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * R2 §5.7 계정 상태 게이트. current_account_status()는 auth.uid()(= 이
 * supabase 클라이언트의 현재 세션 사용자) 본인 상태만 조회한다 — 타인의
 * 상태를 조회할 방법이 없는 안전한 함수라 인자로 userId를 받지 않는다.
 *
 * - closure_pending/closed: 즉시 로그아웃(§5.7 "closed는 인증 차단") — 세션을
 *   남겨두지 않는다.
 * - unknown(프로필/역할별 레코드가 없거나 불완전한 계정, fail-closed): 역시
 *   로그아웃 — 정상적으로 초대·가입된 계정이라면 나타날 수 없는 상태라
 *   데이터 이상으로 취급한다.
 * - suspended: 세션은 유지한 채(관리자가 재활성화하면 새로고침만으로 다시
 *   들어올 수 있어야 하므로) /account-suspended로 보낸다.
 * - pending: 아직 관리자 승인 전 온보딩 상태 — 정상 포털 대신
 *   /account-pending으로 보낸다(§R2 정책 확인 1).
 * - active: 계정 lifecycle은 정상이다. 다만 R2 Task 6(13세 미만 보호자
 *   동의)에 의해 실제 이용 자격이 추가로 걸릴 수 있다 —
 *   current_account_access_allowed()가 false면(13세 미만 학생인데 유효한
 *   보호자 동의가 없음) /consent-pending으로 보낸다. 동의가 유효해지면
 *   (또는 13세가 지나면) 다음 페이지 이동에서 자동으로 정상 role 홈으로
 *   돌아온다 — lifecycle 상태 자체는 건드리지 않는 별개의 게이트라서
 *   여기 추가 분기 하나로 충분하다.
 */
export async function resolveAccountDestination(
  supabase: SupabaseServerClient,
  role?: string | null
): Promise<string> {
  const { data: status } = await supabase.rpc("current_account_status");

  if (status === "closure_pending" || status === "closed") {
    await supabase.auth.signOut();
    return "/login?error=" + encodeURIComponent("계정이 폐쇄되어 로그인할 수 없습니다.");
  }
  if (status === "unknown") {
    await supabase.auth.signOut();
    return (
      "/login?error=" +
      encodeURIComponent("계정 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.")
    );
  }
  if (status === "suspended") {
    return "/account-suspended";
  }
  if (status === "pending") {
    return "/account-pending";
  }

  const { data: accessAllowed } = await supabase.rpc("current_account_access_allowed");
  if (accessAllowed === false) {
    return "/consent-pending";
  }
  return getRoleHomePath(role);
}

/**
 * 로그인한 사용자 + role을 가져온다. 세션이 없으면 /login으로 보낸다.
 * 역할별 대시보드 페이지(app/student, app/parent, ...)와 그 서버 액션에서
 * 쓰는 실질적인 유일한 진입 관문이라, 계정 상태 게이트(R2 §5.7)도 여기서
 * 강제한다 — 로그인 직후 리다이렉트(login/actions.ts, post-auth/page.tsx)만
 * 통과해도, 이후 아무 포털 페이지든 이 함수를 호출하는 순간 다시 검사된다.
 * 즉 로그인 시점엔 active였다가 세션 도중 suspended/closed로 바뀐 계정도
 * 다음 페이지 이동에서 바로 걸린다.
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

  const destination = await resolveAccountDestination(supabase, profile?.role);
  if (destination !== getRoleHomePath(profile?.role)) {
    redirect(destination);
  }

  return { user, profile, supabase };
}
