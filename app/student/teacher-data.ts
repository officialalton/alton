import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCurriculumOverlayProgressByEnrollment, getCurriculumOverlayProgress } from "@/lib/curriculum-overlay-progress";

// M4 골든패스 실사용 버그 #1 — 이 파일은 원래 legacy `enrollments`/`teachers` 테이블
// (정규 전환 후에만 채워짐)을 조회했다. 체험 수업만 진행 중인 학생은 `subject_enrollments`
// + `teacher_assignments`(v3, R1/R5)만 있고 `enrollments` 행이 없어 "매칭된 선생님이
// 없습니다"로 잘못 표시됐다. v3 배정 테이블 기준으로 재작성.
// (관련 RLS 갭은 20261212000000_m4_teacher_student_v3_visibility_fix.sql에서 함께 수정.)

export type TeacherSubject = {
  subjectName: string;
  currentSession: number;
  totalSessions: number;
  // C-1(2026-09-10) — "교사 운영 커리큘럼 기준"/"공통 커리큘럼 기준" 표시용.
  curriculumSourceLabel: string | null;
};

export type TeacherListItem = {
  teacherId: string;
  name: string;
  school: string | null;
  subjects: TeacherSubject[];
};

export type TeacherProfileData = {
  teacherId: string;
  name: string;
  school: string | null;
  bio: string | null;
  subjects: string[];
};

export type TeacherSessionHistoryItem = {
  sessionId: string;
  subjectName: string;
  sessionNumber: number;
  scheduledAt: string | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

type ActiveAssignment = {
  teacherId: string;
  subjectEnrollmentId: string;
  subjectName: string;
};

// 학생의 v3 배정(현재 활성/예정) 목록을 (subject_enrollments + teacher_assignments)로
// 조회한다. 여러 화면에서 재사용.
async function loadActiveAssignments(
  supabase: SupabaseClient,
  studentId: string
): Promise<ActiveAssignment[]> {
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, subject:subjects(name)")
    .eq("child_id", studentId);
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  if (enrollmentIds.length === 0) return [];

  const subjectNameByEnrollment = new Map(
    (enrollments ?? []).map((e) => [e.id, extractName(e.subject)])
  );

  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("teacher_id, subject_enrollment_id")
    .in("subject_enrollment_id", enrollmentIds)
    .in("status", ["planned", "active"]);

  return (assignments ?? []).map((a) => ({
    teacherId: a.teacher_id,
    subjectEnrollmentId: a.subject_enrollment_id,
    subjectName: subjectNameByEnrollment.get(a.subject_enrollment_id) ?? "",
  }));
}

export async function loadTeacherList(
  supabase: SupabaseClient,
  studentId: string
): Promise<TeacherListItem[]> {
  const assignments = await loadActiveAssignments(supabase, studentId);
  const teacherIds = Array.from(new Set(assignments.map((a) => a.teacherId)));
  if (teacherIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", teacherIds);
  const { data: teacherRows } = await supabase
    .from("teachers")
    .select("id, school")
    .in("id", teacherIds);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const schoolById = new Map((teacherRows ?? []).map((t) => [t.id, t.school]));

  // C-1(2026-09-10) — 진도는 세션 실적이 아니라 curriculum_overlay_units
  // 기준으로 통일한다(다른 화면과 동일 기준).
  const enrollmentIds = Array.from(
    new Set(assignments.map((a) => a.subjectEnrollmentId))
  );
  const progressByEnrollment = await loadCurriculumOverlayProgressByEnrollment(supabase, enrollmentIds);

  const bySubjectMap = new Map<string, TeacherSubject[]>();
  for (const a of assignments) {
    const list = bySubjectMap.get(a.teacherId) ?? [];
    const progress = getCurriculumOverlayProgress(progressByEnrollment, a.subjectEnrollmentId);
    list.push({
      subjectName: a.subjectName,
      currentSession: progress.doneUnits,
      totalSessions: progress.totalUnits,
      curriculumSourceLabel: progress.sourceLabel,
    });
    bySubjectMap.set(a.teacherId, list);
  }

  return teacherIds.map((teacherId) => ({
    teacherId,
    name: nameById.get(teacherId) ?? "",
    school: schoolById.get(teacherId) ?? null,
    subjects: bySubjectMap.get(teacherId) ?? [],
  }));
}

export async function loadTeacherProfile(
  supabase: SupabaseClient,
  studentId: string,
  teacherId: string
): Promise<TeacherProfileData | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", teacherId)
    .maybeSingle();
  if (!profile) return null;

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("school, bio")
    .eq("id", teacherId)
    .maybeSingle();

  const assignments = await loadActiveAssignments(supabase, studentId);

  return {
    teacherId,
    name: profile.name,
    school: teacherRow?.school ?? null,
    bio: teacherRow?.bio ?? null,
    subjects: assignments
      .filter((a) => a.teacherId === teacherId)
      .map((a) => a.subjectName),
  };
}

export async function loadTeacherSessionHistory(
  supabase: SupabaseClient,
  studentId: string,
  teacherId: string
): Promise<TeacherSessionHistoryItem[]> {
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, subject:subjects(name)")
    .eq("child_id", studentId);
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  if (enrollmentIds.length === 0) return [];

  const subjectByEnrollment = new Map(
    (enrollments ?? []).map((e) => [e.id, extractName(e.subject)])
  );

  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("subject_enrollment_id")
    .eq("teacher_id", teacherId)
    .in("subject_enrollment_id", enrollmentIds);
  const relevantEnrollmentIds = new Set(
    (assignments ?? []).map((a) => a.subject_enrollment_id)
  );
  if (relevantEnrollmentIds.size === 0) return [];

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, subject_enrollment_id, final_status, reservation:reservations!sessions_reservation_id_fkey(starts_at)")
    .eq("teacher_id", teacherId)
    .in("subject_enrollment_id", Array.from(relevantEnrollmentIds))
    .in("final_status", ["completed", "no_show"])
    .order("id", { ascending: false });

  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }

  return (sessions ?? []).map((s, idx) => {
    const reservation = one(s.reservation as unknown) as { starts_at?: string } | null;
    return {
      sessionId: s.id,
      subjectName: subjectByEnrollment.get(s.subject_enrollment_id) ?? "",
      sessionNumber: (sessions?.length ?? 0) - idx,
      scheduledAt: reservation?.starts_at ?? null,
    };
  });
}
