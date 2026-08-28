// 서버/클라이언트 컴포넌트 양쪽에서 다 쓰는 순수 타입/함수만 모아둔 파일.
// next/headers 등 서버 전용 모듈을 import하는 코드(lib/auth.ts)와 분리해서,
// 클라이언트 컴포넌트(SessionShell 등)가 이 파일만 import하도록 한다.

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
 * 수업 세션뷰(010-session-shell)의 role/state 파생 규칙.
 *
 * 목업(alton_material_viewer_prototype.html)은 `?role=student|teacher`,
 * `?state=prep|live|completed`를 URL 파라미터로 흉내냈다. 실제 구현은 이 값을
 * URL로 받지 않고 세션 id만 라우트로 받아서(`/session/[id]`) 서버에서 계산한다.
 *
 * viewer는 4종이다 — 목업은 student/teacher 토글만 있었지만, functional-spec §3은
 * 학부모가 지난 수업 기록을 읽기전용으로 열람한다고 명시하므로 parent/admin을
 * 읽기전용 뷰어로 추가했다. 편집 권한(문제생성 탭, 수업종료 버튼 등)은 teacher만 가진다.
 */
export type SessionViewRole = "student" | "teacher";
export type SessionViewViewer = SessionViewRole | "parent" | "admin";
export type SessionViewState = "prep" | "live" | "completed";

export function computeSessionViewState(
  status: string,
  scheduledAt: string | null,
  durationMinutes: number
): SessionViewState {
  if (status !== "upcoming") {
    // completed/cancelled/no_show는 전부 "완료됨" 배지로 묶어서 보여준다.
    return "completed";
  }
  if (!scheduledAt) {
    return "prep";
  }
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();
  return now >= start && now <= end ? "live" : "prep";
}
