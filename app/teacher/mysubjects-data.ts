import type { SupabaseClient } from "@supabase/supabase-js";

export type TemplateUnit = {
  id: string;
  position: number;
  unitTitle: string;
  note: string | null;
  teacherComment: string | null;
};

export type MySubject = {
  subjectId: string;
  subjectName: string;
  templateId: string | null;
  units: TemplateUnit[];
};

export type CatalogUnit = {
  position: number;
  unitTitle: string;
  note: string | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadMySubjects(
  supabase: SupabaseClient,
  teacherId: string
): Promise<MySubject[]> {
  // 2026-09-09(UAT 지적): 레거시 1:1 enrollments만 조회하면 R5 매칭 모델
  // (teacher_assignments + subject_enrollments)로 배정된 v3 담당 과목이
  // 전혀 보이지 않는다(app/admin/users-data.ts::loadTeachers()와 동일한
  // 부류의 표시 버그). 두 소스를 함께 조회해 합친다.
  const [{ data: enrollments }, { data: assignments }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("subject_id, subject:subjects(name)")
      .eq("teacher_id", teacherId)
      .eq("status", "active"),
    supabase
      .from("teacher_assignments")
      .select("subject_enrollment:subject_enrollments!inner(subject_id, subject:subjects(name))")
      .eq("teacher_id", teacherId)
      .eq("status", "active"),
  ]);

  const subjectNameById = new Map<string, string>();
  for (const e of enrollments ?? []) {
    subjectNameById.set(e.subject_id, extractName(e.subject));
  }
  for (const a of assignments ?? []) {
    const se = Array.isArray(a.subject_enrollment) ? a.subject_enrollment[0] : a.subject_enrollment;
    if (!se) continue;
    subjectNameById.set(se.subject_id, extractName(se.subject));
  }
  if (subjectNameById.size === 0) return [];

  const subjectIds = Array.from(subjectNameById.keys());
  const { data: templates } = await supabase
    .from("teacher_curriculum_templates")
    .select("id, subject_id")
    .eq("teacher_id", teacherId)
    .in("subject_id", subjectIds);

  const templateBySubject = new Map(
    (templates ?? []).map((t) => [t.subject_id, t.id])
  );

  const templateIds = (templates ?? []).map((t) => t.id);
  const { data: units } = templateIds.length
    ? await supabase
        .from("teacher_curriculum_template_units")
        .select("id, template_id, position, unit_title, note, teacher_comment")
        .in("template_id", templateIds)
        .order("position", { ascending: true })
    : { data: [] as never[] };

  const unitsByTemplate = new Map<string, TemplateUnit[]>();
  for (const u of units ?? []) {
    const list = unitsByTemplate.get(u.template_id) ?? [];
    list.push({
      id: u.id,
      position: u.position,
      unitTitle: u.unit_title,
      note: u.note,
      teacherComment: u.teacher_comment,
    });
    unitsByTemplate.set(u.template_id, list);
  }

  return subjectIds.map((subjectId) => {
    const templateId = templateBySubject.get(subjectId) ?? null;
    return {
      subjectId,
      subjectName: subjectNameById.get(subjectId) ?? "",
      templateId,
      units: templateId ? unitsByTemplate.get(templateId) ?? [] : [],
    };
  });
}

export async function loadCatalogUnits(
  supabase: SupabaseClient,
  subjectId: string
): Promise<CatalogUnit[]> {
  const { data } = await supabase
    .from("subject_template_units")
    .select("position, unit_title, note")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  return (data ?? []).map((u) => ({
    position: u.position,
    unitTitle: u.unit_title,
    note: u.note,
  }));
}
