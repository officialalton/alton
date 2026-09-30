import type { SupabaseClient } from "@supabase/supabase-js";

// 학생 열람(오버뷰/보드/통계) 공통 권한 판정 — 모든 역할이 이 한 곳을 거친다.
//  관리자    : 전체 학생(supervisor는 `학생관리` capability 필요), 읽기 전용, 열람 기록
//  컨설턴트  : 담당 학생, 할 일 추가·이동·삭제, 열람 기록
//  선생님    : 현재 활성 배정 학생(teaches_student — 종료된 배정은 거절), 할 일 추가만, 열람 기록
//  학부모    : 본인 자녀(is_guardian_of), 읽기 전용, 오버뷰·보드만(통계 없음), 열람 기록 없음
// 학생 본인은 학생 포털을 쓰므로 이 공통 열람 대상이 아니다.
export type StudentViewRole = "admin" | "consultant" | "teacher" | "parent";
export type StudentViewAction = "create" | "move" | "delete";
export type StudentViewTab = "overview" | "board" | "stats";

export type StudentViewAccess = {
  role: StudentViewRole;
  /** 보드에서 허용된 쓰기 동작. 비어 있으면 읽기 전용. */
  actions: StudentViewAction[];
  tabs: StudentViewTab[];
  /** 열람 감사 기록 대상 여부(직원만). */
  audit: boolean;
};

const POLICY: Record<StudentViewRole, Omit<StudentViewAccess, "role">> = {
  admin: { actions: [], tabs: ["overview", "board", "stats"], audit: true },
  consultant: { actions: ["create", "move", "delete"], tabs: ["overview", "board", "stats"], audit: true },
  teacher: { actions: ["create"], tabs: ["overview", "board"], audit: true },
  parent: { actions: [], tabs: ["overview", "board"], audit: false },
};

export function studentViewPolicy(role: StudentViewRole): StudentViewAccess {
  return { role, ...POLICY[role] };
}

export class StudentViewDeniedError extends Error {
  constructor(message = "이 학생을 열람할 권한이 없습니다.") {
    super(message);
    this.name = "StudentViewDeniedError";
  }
}

export async function assertCanViewStudent(
  supabase: SupabaseClient,
  userId: string,
  studentId: string
): Promise<StudentViewAccess> {
  if (!studentId) throw new StudentViewDeniedError("학생을 지정하세요.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_tier")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    if (profile.admin_tier !== "supervisor") return studentViewPolicy("admin");
    const { data: ok } = await supabase.rpc("current_user_has_capability", { p_capability: "학생관리" });
    if (ok) return studentViewPolicy("admin");
    throw new StudentViewDeniedError();
  }
  if (profile?.role === "consultant") {
    const { data: assigned } = await supabase.rpc("is_assigned_consultant_of", { p_student_id: studentId });
    if (assigned === true) return studentViewPolicy("consultant");
    throw new StudentViewDeniedError("담당 학생만 열람할 수 있습니다.");
  }
  if (profile?.role === "teacher") {
    const { data: teaches } = await supabase.rpc("teaches_student", { p_student_id: studentId });
    if (teaches === true) return studentViewPolicy("teacher");
    throw new StudentViewDeniedError("현재 담당 중인 학생만 열람할 수 있습니다.");
  }
  if (profile?.role === "parent") {
    const { data: guardian } = await supabase.rpc("is_guardian_of", { p_student_id: studentId });
    if (guardian === true) return studentViewPolicy("parent");
    throw new StudentViewDeniedError("자녀만 열람할 수 있습니다.");
  }
  throw new StudentViewDeniedError();
}

/** 쓰기 동작 권한: 열람 권한 + 역할별 허용 동작. */
export async function assertCanWriteStudentTask(
  supabase: SupabaseClient,
  userId: string,
  studentId: string,
  action: StudentViewAction
): Promise<StudentViewAccess> {
  const access = await assertCanViewStudent(supabase, userId, studentId);
  if (!access.actions.includes(action)) throw new StudentViewDeniedError("이 화면에서는 수정할 수 없습니다.");
  return access;
}
