import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibrarySubject } from "@/app/student/materials-data";

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

// 2026-09-09(UAT 지적, 제품 오너 승인) — 교사 포털에는 지금까지 "교재" 진입점
// 자체가 없었다("교재" 네비게이션 항목은 있었지만 "탭은 준비 중입니다"만
// 렌더링). 학생 쪽 loadMaterialsLibrary()와 동일한 원칙(공개된 자료만, 본인
// 담당 과목만)으로 교사 전용 로더를 추가한다 — 레거시 enrollments와 v3
// teacher_assignments를 모두 확인한다(둘 다 20261267000000에서 RLS도 함께
// 확장됨).
export async function loadTeacherMaterialsLibrary(
  supabase: SupabaseClient,
  teacherId: string
): Promise<LibrarySubject[]> {
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

  const subjects = new Map<string, string>();
  for (const e of enrollments ?? []) {
    subjects.set(e.subject_id, extractName(e.subject));
  }
  for (const a of assignments ?? []) {
    const se = Array.isArray(a.subject_enrollment) ? a.subject_enrollment[0] : a.subject_enrollment;
    if (!se) continue;
    subjects.set(se.subject_id, extractName(se.subject));
  }

  const subjectIds = Array.from(subjects.keys());
  if (subjectIds.length === 0) return [];

  const { data: docs } = await supabase
    .from("curriculum_docs")
    .select("id, title, subject_id, unit_id")
    .in("subject_id", subjectIds)
    .eq("status", "published")
    .order("title", { ascending: true });

  const unitIds = Array.from(
    new Set((docs ?? []).map((d) => d.unit_id).filter((id): id is string => !!id))
  );
  const { data: units } = unitIds.length
    ? await supabase.from("subject_template_units").select("id, unit_title").in("id", unitIds)
    : { data: [] as { id: string; unit_title: string }[] };
  const unitTitleById = new Map((units ?? []).map((u) => [u.id, u.unit_title]));

  const bySubject = new Map<string, { id: string; title: string; unitTitle: string | null }[]>();
  for (const d of docs ?? []) {
    const list = bySubject.get(d.subject_id) ?? [];
    list.push({
      id: d.id,
      title: d.title,
      unitTitle: d.unit_id ? unitTitleById.get(d.unit_id) ?? null : null,
    });
    bySubject.set(d.subject_id, list);
  }

  return Array.from(subjects.entries())
    .filter(([subjectId]) => (bySubject.get(subjectId) ?? []).length > 0)
    .map(([subjectId, subjectName]) => ({
      subjectId,
      subjectName,
      docs: bySubject.get(subjectId) ?? [],
    }));
}
