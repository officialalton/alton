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
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("subject_id, subject:subjects(name)")
    .eq("teacher_id", teacherId)
    .eq("status", "active");

  const subjectNameById = new Map<string, string>();
  for (const e of enrollments ?? []) {
    subjectNameById.set(e.subject_id, extractName(e.subject));
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
