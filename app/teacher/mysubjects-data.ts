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
  /**
   * 보관된 과목. 신규 배정 후보에서는 빠지지만 **기존 커리큘럼은 계속 열어볼 수
   * 있어야 한다** — 보관은 숨김이지 접근 차단이 아니다(2026-09-12 확정).
   */
  archived: boolean;
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
  // 2026-09-12(UAT 지적) — 세 번째 소스가 빠져 있었다. 관리자가 담당 과목을
  // 배정하면 teacher_curriculum_templates 행만 생기는데(assignTeacherSubject),
  // 여기서는 그것을 읽지 않아 **학생이 매칭되기 전까지 과목이 보이지 않았다**.
  // 배정만으로 기본 커리큘럼을 준비할 수 있어야 하므로 운영본 유무로 과목을
  // 숨기지 않는다.
  const [{ data: enrollments }, { data: assignments }, { data: assigned }] = await Promise.all([
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
    supabase
      .from("teacher_curriculum_templates")
      .select("subject_id, subject:subjects(name, archived_at)")
      .eq("teacher_id", teacherId),
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
  // 보관된 과목도 목록에는 넣는다. 화면이 '현재'와 '보관됨'으로 나눠 보여주고,
  // 보관된 쪽은 읽기 위주로 쓴다. 목록에서 빼버리면 이 선생님이 쌓아 둔
  // 커리큘럼에 들어갈 길이 없어진다.
  const archivedSubjectIds = new Set<string>();
  for (const a of assigned ?? []) {
    const subject = Array.isArray(a.subject) ? a.subject[0] : a.subject;
    const subjectId = a.subject_id as string;
    if ((subject as { archived_at?: string | null } | null)?.archived_at) {
      archivedSubjectIds.add(subjectId);
    }
    subjectNameById.set(subjectId, extractName(a.subject));
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
      archived: archivedSubjectIds.has(subjectId),
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
