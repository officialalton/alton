import type { SupabaseClient } from "@supabase/supabase-js";

export type CurriculumUnitStatus = "done" | "in_progress" | "upcoming";

export type CurriculumUnit = {
  position: number;
  unitTitle: string;
  note: string | null;
  teacherComment: string | null;
  status: CurriculumUnitStatus;
  sessionId: string | null;
  scheduledAt: string | null;
};

export type CurriculumData = {
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  totalSessions: number;
  currentSession: number;
  units: CurriculumUnit[];
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadCurricula(
  supabase: SupabaseClient,
  studentId: string
): Promise<CurriculumData[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, teacher_id, subject_id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) return [];

  const teacherIds = Array.from(new Set(enrollments.map((e) => e.teacher_id)));
  const enrollmentIds = enrollments.map((e) => e.id);

  // 배치 조회 3회로 축소(기존: enrollment마다 순차 3쿼리, N개면 3N회 —
  // 계획 문서 5절 P0. teacher_curriculum_templates는 (teacher_id, subject_id)
  // 조합이 enrollment마다 다를 수 있어 or() 조건으로 한 번에 조회한다.
  const [{ data: teacherProfiles }, { data: templates }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", teacherIds),
    supabase
      .from("teacher_curriculum_templates")
      .select("id, teacher_id, subject_id")
      .or(
        enrollments
          .map((e) => `and(teacher_id.eq.${e.teacher_id},subject_id.eq.${e.subject_id})`)
          .join(",")
      ),
  ]);
  const teacherNameById = new Map(
    (teacherProfiles ?? []).map((t) => [t.id, t.name])
  );
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

  const results: CurriculumData[] = enrollments.map((e) => {
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

    // 2026-09-10(P0 결함 수정) — enrollments.total_sessions/current_session은
    // 매칭 확정 시 더 이상 입력받지 않는다(제품 정책: 회차 수는 커리큘럼
    // 단원 구성으로 관리). 회차 표시는 그 대신 실제 커리큘럼 단원 수와 완료
    // 단원 수로 계산한다 — app/student/teacher-data.ts가 이미 legacy_sessions
    // 실적으로 회차를 세는 것과 같은 접근이다.
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
    };
  });

  return results;
}
