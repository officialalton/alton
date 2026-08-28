import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type ProfileRole = "student" | "parent" | "teacher" | "admin";

const ROLE_HOME_PATH: Record<ProfileRole, string> = {
  student: "/student",
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

export function getRoleHomePath(role?: string | null) {
  if (role && role in ROLE_HOME_PATH) {
    return ROLE_HOME_PATH[role as ProfileRole];
  }
  return "/login";
}

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

/**
 * 수업 세션뷰(010-session-shell, 아직 미구현)가 따라야 할 계약.
 *
 * 목업(alton_material_viewer_prototype.html)은 `?role=student|teacher`,
 * `?state=prep|live|completed`를 URL 파라미터로 흉내냈다. 실제 구현에서는
 * 이 값을 URL로 받지 않고, 로그인한 사용자 id + sessions/enrollments 테이블
 * 조회로 서버에서 계산해야 한다:
 *
 *   role  = auth.uid()가 enrollment.student_id면 'student', enrollment.teacher_id면 'teacher'
 *           (그 외 역할이면 세션 접근 자체를 막는다 — RLS가 이미 강제)
 *   state = sessions.status가 'completed'/'cancelled'/'no_show'면 그대로 'completed' 계열,
 *           'upcoming'이면 scheduled_at·duration_minutes와 현재 시각을 비교해
 *           'prep'(아직 시작 전) vs 'live'(진행 시간대 안) 계산
 *
 * 세션뷰 라우트는 URL에 session_id만 받고(`/session/[id]`), role/state는 여기서
 * 파생시키는 함수를 010 티켓에서 구현한다. 타입만 지금 고정해둔다.
 */
export type SessionViewRole = "student" | "teacher";
export type SessionViewState = "prep" | "live" | "completed";
