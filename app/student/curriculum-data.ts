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
    .select(
      "id, teacher_id, subject_id, total_sessions, current_session, subject:subjects(name)"
    )
    .eq("student_id", studentId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) return [];

  const teacherIds = Array.from(new Set(enrollments.map((e) => e.teacher_id)));
  const { data: teacherProfiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", teacherIds);
  const teacherNameById = new Map(
    (teacherProfiles ?? []).map((t) => [t.id, t.name])
  );

  const results: CurriculumData[] = [];

  for (const e of enrollments) {
    const { data: template } = await supabase
      .from("teacher_curriculum_templates")
      .select("id")
      .eq("teacher_id", e.teacher_id)
      .eq("subject_id", e.subject_id)
      .maybeSingle();

    const { data: units } = template
      ? await supabase
          .from("teacher_curriculum_template_units")
          .select("id, position, unit_title, note, teacher_comment")
          .eq("template_id", template.id)
          .order("position", { ascending: true })
      : { data: [] as never[] };

    const unitIds = (units ?? []).map((u) => u.id);
    const { data: sessions } = unitIds.length
      ? await supabase
          .from("legacy_sessions")
          .select("id, status, scheduled_at, source_template_unit_id")
          .eq("enrollment_id", e.id)
          .in("source_template_unit_id", unitIds)
      : { data: [] as never[] };

    const sessionByUnitId = new Map(
      (sessions ?? []).map((s) => [s.source_template_unit_id, s])
    );

    const curriculumUnits: CurriculumUnit[] = (units ?? []).map((u) => {
      const session = sessionByUnitId.get(u.id);
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

    results.push({
      enrollmentId: e.id,
      subjectId: e.subject_id,
      subjectName: extractName(e.subject),
      teacherName: teacherNameById.get(e.teacher_id) ?? "",
      totalSessions: e.total_sessions,
      currentSession: e.current_session,
      units: curriculumUnits,
    });
  }

  return results;
}
