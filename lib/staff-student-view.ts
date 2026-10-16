import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatsTier } from "@/lib/student-stats/types";

// 학생 열람(오버뷰/보드/통계) 공통 권한 판정 — 모든 역할이 이 한 곳을 거친다.
//  관리자    : 전체 학생(supervisor는 `학생관리` capability 필요), 읽기 전용, 열람 기록
//  컨설턴트  : 담당 학생, 할 일 추가·이동·삭제, 열람 기록
//  선생님    : 현재 활성 배정 학생(teaches_student — 종료된 배정은 거절), 할 일 추가만, 열람 기록
//  학부모    : 본인 자녀(is_guardian_of), 읽기 전용, 오버뷰·보드·통계(학생 본인 통계와 동일 범위), 열람 기록 없음
//  통계 등급(StatsTier): 학생 본인=학부모=family(만족도·직원 전용 지표·모의고사 강약 없음), 컨설턴트=staff, 관리자=admin(+선생님 운영 지표)
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
  parent: { actions: [], tabs: ["overview", "board", "stats"], audit: false },
};

/** 통계 탭 공개 범위 등급. 선생님은 통계 탭이 없어 family 로 떨어지지 않도록 호출 전에 tabs 로 막는다. */
export function statsTierFor(role: StudentViewRole): StatsTier {
  return role === "admin" ? "admin" : role === "consultant" ? "staff" : "family";
}

export function studentViewPolicy(role: StudentViewRole): StudentViewAccess {
  return { role, ...POLICY[role] };
}

export class StudentViewDeniedError extends Error {
  constructor(message = "You don't have permission to view this student.") {
    super(message);
    this.name = "StudentViewDeniedError";
  }
}

export async function assertCanViewStudent(
  supabase: SupabaseClient,
  userId: string,
  studentId: string
): Promise<StudentViewAccess> {
  if (!studentId) throw new StudentViewDeniedError("Please select a student.");
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
    throw new StudentViewDeniedError("You can only view students assigned to you.");
  }
  if (profile?.role === "teacher") {
    const { data: teaches } = await supabase.rpc("teaches_student", { p_student_id: studentId });
    if (teaches === true) return studentViewPolicy("teacher");
    throw new StudentViewDeniedError("You can only view students you currently teach.");
  }
  if (profile?.role === "parent") {
    const { data: guardian } = await supabase.rpc("is_guardian_of", { p_student_id: studentId });
    if (guardian === true) return studentViewPolicy("parent");
    throw new StudentViewDeniedError("You can only view your own child.");
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
  if (!access.actions.includes(action)) throw new StudentViewDeniedError("You can't make changes from this view.");
  return access;
}
