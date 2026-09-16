import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStudentHomeworkSets, type StudentHomeworkSet } from "@/app/student/homework-v3-data";

// 2026-09-16 제품 오너 지시(개정) — 과제를 회차 키워드 풀에 묶지 않는다. 교사 포털 "과제 생성"에서
// 학생·수업(세션)·키워드를 한 번에 골라 즉시 발급한다(발급 즉시 학생 포털·세션뷰의 기존 과제 UI에
// 그대로 뜬다 — 별도 "불러오기" 단계 없음). "과제 내역"은 학생 포털과 같은 회차별 묶음을 교사도
// 본다. docs/2026-09-16-homework-direct-issue-plan.md 참고.

export type HomeworkKeywordOption = { id: string; label: string };

/** 이 학생이 수강 중인 과목들의 활성 키워드 — 회차와 무관하게 전부 보여준다. */
export async function loadStudentSubjectKeywords(supabase: SupabaseClient, studentId: string): Promise<HomeworkKeywordOption[]> {
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("subject_id")
    .eq("child_id", studentId);
  const subjectIds = Array.from(new Set((enrollments ?? []).map((e) => e.subject_id as string)));
  if (subjectIds.length === 0) return [];
  const { data: keywords } = await supabase
    .from("subject_keywords")
    .select("id, label")
    .in("subject_id", subjectIds)
    .eq("status", "active")
    .order("label", { ascending: true });
  return (keywords ?? []).map((k) => ({ id: k.id as string, label: k.label as string }));
}

export type TeacherSessionOption = { sessionId: string; label: string; startsAt: string | null };

/** 이 교사가 이 학생과 담당하는 수업(v3) 중, 과제를 발급할 수 있는 것들 — 예정·진행 중 우선, 최근순. */
export async function loadTeacherSessionsForStudent(supabase: SupabaseClient, teacherId: string, studentId: string): Promise<TeacherSessionOption[]> {
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, subject:subjects(name)")
    .eq("child_id", studentId);
  const enrollmentIds = (enrollments ?? []).map((e) => e.id as string);
  if (enrollmentIds.length === 0) return [];
  const subjectNameByEnrollment = new Map(
    (enrollments ?? []).map((e) => {
      const subject = Array.isArray(e.subject) ? e.subject[0] : e.subject;
      return [e.id as string, (subject as { name?: string } | null)?.name ?? ""];
    })
  );
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("subject_enrollment_id")
    .eq("teacher_id", teacherId)
    .in("subject_enrollment_id", enrollmentIds)
    .in("status", ["planned", "active"]);
  const myEnrollmentIds = (assignments ?? []).map((a) => a.subject_enrollment_id as string);
  if (myEnrollmentIds.length === 0) return [];

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, subject_enrollment_id, reservation:reservations!sessions_reservation_id_fkey(starts_at, status)")
    .in("subject_enrollment_id", myEnrollmentIds)
    .order("id", { ascending: false })
    .limit(50);
  const one = (rel: unknown) => (Array.isArray(rel) ? rel[0] : rel) as { starts_at?: string; status?: string } | null | undefined;
  return (sessions ?? [])
    .map((s) => {
      const reservation = one(s.reservation);
      const startsAt = reservation?.starts_at ?? null;
      const subjectName = subjectNameByEnrollment.get(s.subject_enrollment_id as string) ?? "";
      const label = startsAt
        ? `${new Date(startsAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} · ${subjectName} 수업`
        : `${subjectName} 수업`;
      return { sessionId: s.id as string, label, startsAt };
    })
    .filter((s) => s.startsAt === null || new Date(s.startsAt).getTime() > Date.now() - 1000 * 60 * 60 * 6)
    .sort((a, b) => (a.startsAt && b.startsAt ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() : 0));
}

export type { StudentHomeworkSet };

/** 교사가 자신이 낸 과제 내역을 본다 — 학생 포털과 같은 회차별 묶음(loadStudentHomeworkSets)을
 * 그대로 재사용한다. RLS(is_session_teacher_v3)가 이 교사가 가르치는 세션의 것만 보여준다. */
export async function loadTeacherHomeworkSets(supabase: SupabaseClient, studentId: string): Promise<StudentHomeworkSet[]> {
  return loadStudentHomeworkSets(supabase, studentId);
}
