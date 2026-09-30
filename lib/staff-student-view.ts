import type { SupabaseClient } from "@supabase/supabase-js";

// 관리자·담당 컨설턴트의 학생 열람(오버뷰/보드/통계) 권한 판정 — 읽기 전용 화면 전용.
// 허용: 관리자(supervisor는 `학생관리` capability 필요), 그 학생의 담당 컨설턴트.
// 거절: 타 컨설턴트·학부모·학생(본인 포함 — 본인은 학생 포털을 쓴다)·선생님.
export async function assertCanViewStudent(
  supabase: SupabaseClient,
  userId: string,
  studentId: string
): Promise<void> {
  if (!studentId) throw new Error("학생을 지정하세요.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_tier")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    if (profile.admin_tier !== "supervisor") return;
    const { data: ok } = await supabase.rpc("current_user_has_capability", { p_capability: "학생관리" });
    if (ok) return;
    throw new Error("이 학생을 열람할 권한이 없습니다.");
  }
  if (profile?.role === "consultant") {
    const { data: assigned } = await supabase.rpc("is_assigned_consultant_of", { p_student_id: studentId });
    if (assigned === true) return;
    throw new Error("담당 학생만 열람할 수 있습니다.");
  }
  throw new Error("이 학생을 열람할 권한이 없습니다.");
}
