"use server";

import { createClient } from "@/utils/supabase/server";

async function requireAdmin() {
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
  return { supabase };
}

// 2026-09-12(UAT 지적) — 이 파일의 서버 액션들이 예외를 던지고 있었다. 던진
// 예외는 Production 빌드에서 Minified React error #441로 마스킹돼, 화면에는
// 사유 대신 내부 오류 코드가 뜬다(2026-09-10 P0-2 createSubjectKeyword와 같은
// 부류). 항상 { ok, error } 로 돌려주고 내부 메시지는 화면에 넘기지 않는다.
export type TeacherSubjectResult = { ok: true } | { ok: false; error: string };

export async function assignTeacherSubject(
  teacherId: string,
  subjectId: string
): Promise<TeacherSubjectResult> {
  const { supabase } = await requireAdmin();

  // 보관된 과목은 새로 배정하지 않는다. 기존 연결은 그대로 두고 표시만 한다.
  const { data: subject } = await supabase
    .from("subjects")
    .select("archived_at")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) return { ok: false, error: "존재하지 않는 과목입니다." };
  if (subject.archived_at) {
    return { ok: false, error: "보관된 과목은 새로 배정할 수 없습니다." };
  }

  const { data: template, error } = await supabase
    .from("teacher_curriculum_templates")
    .insert({ teacher_id: teacherId, subject_id: subjectId })
    .select("id")
    .single();
  if (error) {
    console.error(JSON.stringify({ event: "assign_teacher_subject_failed", message: error.message }));
    return { ok: false, error: "담당 과목을 추가하지 못했습니다." };
  }

  const { data: catalogUnits } = await supabase
    .from("subject_template_units")
    .select("position, unit_title, note")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  if (!catalogUnits || catalogUnits.length === 0) return { ok: true };

  const { error: unitsError } = await supabase
    .from("teacher_curriculum_template_units")
    .insert(
      catalogUnits.map((u) => ({
        template_id: template.id,
        position: u.position,
        unit_title: u.unit_title,
        note: u.note,
      }))
    );
  if (unitsError) {
    console.error(JSON.stringify({ event: "assign_teacher_subject_units_failed", message: unitsError.message }));
    return { ok: false, error: "담당 과목의 기본 회차를 만들지 못했습니다." };
  }
  return { ok: true };
}

/**
 * 담당 가능 과목에서 뺀다.
 *
 * **학생 매칭 종료와는 다른 일이다.** 이 함수는 매칭이나 예약을 건드리지 않고,
 * 활성 매칭이 남아 있으면 거부하고 기존 종료 경로로 안내한다. 과목 해제만으로
 * 진행 중인 수업 관계를 끊지 않는다.
 *
 * 보관된 과목도 해제할 수 있다 — 보관은 "새로 고르지 못한다"는 뜻이지
 * "기존 연결을 못 푼다"는 뜻이 아니다.
 */
export async function unassignTeacherSubject(
  teacherId: string,
  subjectId: string
): Promise<TeacherSubjectResult> {
  const { supabase } = await requireAdmin();

  // 레거시 enrollments만 보고 있었다 — v3 매칭(teacher_assignments)으로 붙은
  // 학생은 그대로 남은 채 담당 과목만 빠질 수 있었다. 둘 다 본다.
  const [{ data: activeEnrollments }, { data: activeAssignments }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("subject_id", subjectId)
      .eq("status", "active"),
    supabase
      .from("teacher_assignments")
      .select("id, subject_enrollment:subject_enrollments!inner(subject_id)")
      .eq("teacher_id", teacherId)
      .eq("status", "active")
      .eq("subject_enrollments.subject_id", subjectId),
  ]);

  if (
    (activeEnrollments && activeEnrollments.length > 0) ||
    (activeAssignments && activeAssignments.length > 0)
  ) {
    return {
      ok: false,
      error:
        "이 과목으로 매칭된 학생이 있어 담당 과목에서 뺄 수 없습니다. " +
        "매칭 탭에서 담당을 먼저 종료해주세요. 과목을 빼는 것만으로 매칭과 예약이 정리되지는 않습니다.",
    };
  }

  const { error } = await supabase
    .from("teacher_curriculum_templates")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId);
  if (error) {
    console.error(JSON.stringify({ event: "unassign_teacher_subject_failed", message: error.message }));
    return { ok: false, error: "담당 과목을 빼지 못했습니다." };
  }
  return { ok: true };
}
