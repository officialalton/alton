import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurriculumData, CurriculumUnit, CurriculumUnitStatus } from "@/app/student/curriculum-data";

export type TeacherCurriculumData = CurriculumData & {
  studentId: string;
  studentName: string;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

// 2026-09-11(제품 오너 실사용 보고 — "학생별 커리큘럼" 진입이 매우 느림,
// 실측 결과 Gateway Timeout까지 발생) — 원래 이 함수는 학생마다
// loadCurricula()를 각각 호출했다(학생 수만큼 동시 요청 N개, 그 안에서도
// 학생당 순차 3단계 왕복). 담당 학생이 소수일 땐 안 보이다가, 실제 계정처럼
// 담당 학생·과목 수가 많아지면 한 번의 /teacher 페이지 로드가 DB 커넥션
// 풀에 수십~수백 개 동시 쿼리를 쏟아내 응답이 걷잡을 수 없이 느려지고
// (Vercel 함수 타임아웃까지 발생) — 이 페이지의 유일한 호출부이므로
// loadCurricula()는 그대로 두고(학생/학부모 단일 조회 경로는 변경 없음),
// 여기만 전체 담당 학생을 한 번에 배치 조회하도록 다시 짰다(쿼리 수가
// 학생 수와 무관하게 고정 4회).
export async function loadAllStudentCurricula(
  supabase: SupabaseClient,
  students: { studentId: string; studentName: string }[]
): Promise<TeacherCurriculumData[]> {
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.studentId);
  const studentNameById = new Map(students.map((s) => [s.studentId, s.studentName]));

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id, teacher_id, subject_id, subject:subjects(name)")
    .in("student_id", studentIds)
    .eq("status", "active");
  if (!enrollments || enrollments.length === 0) return [];

  const teacherIds = Array.from(new Set(enrollments.map((e) => e.teacher_id)));
  const enrollmentIds = enrollments.map((e) => e.id);
  const teacherSubjectPairs = Array.from(
    new Set(enrollments.map((e) => `and(teacher_id.eq.${e.teacher_id},subject_id.eq.${e.subject_id})`))
  );

  const [{ data: teacherProfiles }, { data: templates }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", teacherIds),
    supabase
      .from("teacher_curriculum_templates")
      .select("id, teacher_id, subject_id")
      .or(teacherSubjectPairs.join(",")),
  ]);
  const teacherNameById = new Map((teacherProfiles ?? []).map((t) => [t.id, t.name]));
  const templateByTeacherSubject = new Map(
    (templates ?? []).map((t) => [`${t.teacher_id}:${t.subject_id}`, t.id])
  );

  const templateIds = Array.from(new Set((templates ?? []).map((t) => t.id)));
  const [{ data: units }, { data: sessions }] = await Promise.all([
    templateIds.length
      ? supabase
          .from("teacher_curriculum_template_units")
          .select("id, template_id, position, unit_title, note, teacher_comment")
          .in("template_id", templateIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("legacy_sessions")
      .select("id, status, scheduled_at, source_template_unit_id, enrollment_id")
      .in("enrollment_id", enrollmentIds),
  ]);

  const unitsByTemplateId = new Map<string, typeof units>();
  for (const u of units ?? []) {
    const list = unitsByTemplateId.get(u.template_id) ?? [];
    list.push(u);
    unitsByTemplateId.set(u.template_id, list);
  }
  const sessionByEnrollmentAndUnit = new Map(
    (sessions ?? []).map((s) => [`${s.enrollment_id}:${s.source_template_unit_id}`, s])
  );

  return enrollments.map((e) => {
    const templateId = templateByTeacherSubject.get(`${e.teacher_id}:${e.subject_id}`);
    const enrollmentUnits = (templateId ? unitsByTemplateId.get(templateId) : undefined) ?? [];

    const curriculumUnits: CurriculumUnit[] = enrollmentUnits.map((u) => {
      const session = sessionByEnrollmentAndUnit.get(`${e.id}:${u.id}`);
      let status: CurriculumUnitStatus = "upcoming";
      if (session?.status === "completed") status = "done";
      else if (session?.status === "upcoming") status = "in_progress";

      return {
        position: u.position,
        unitTitle: u.unit_title,
        note: u.note,
        teacherComment: u.teacher_comment,
        status,
        sessionId: session?.id ?? null,
        scheduledAt: session?.scheduled_at ?? null,
      };
    });

    const completedCount = curriculumUnits.filter((u) => u.status === "done").length;
    const totalSessions = curriculumUnits.length;

    return {
      enrollmentId: e.id,
      subjectId: e.subject_id,
      subjectName: extractName(e.subject),
      teacherName: teacherNameById.get(e.teacher_id) ?? "",
      totalSessions,
      currentSession: Math.min(completedCount + 1, Math.max(totalSessions, 1)),
      units: curriculumUnits,
      studentId: e.student_id,
      studentName: studentNameById.get(e.student_id) ?? "",
    };
  });
}
