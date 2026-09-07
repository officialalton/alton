import type { SupabaseClient } from "@supabase/supabase-js";

// R9(Task 3) — 담당 학생의 운영 커리큘럼(오버레이) + 조합 가능한 라이브러리 콘텐츠를
// 읽기 전용으로 로드한다. RLS(20261229000000_r9_student_curriculum_overlay.sql)가
// "담당 선생님/본인 학생/관리자"만 조회를 허용하므로, 이 함수는 그 이상의 권한
// 검사를 하지 않는다 — 담당이 아닌 선생님이 호출하면 그냥 빈 결과가 온다.

export type OverlayUnit = {
  id: string;
  sourceUnitId: string | null;
  position: number;
  unitTitle: string;
  note: string | null;
  status: "not_started" | "in_progress" | "completed" | "reinforcement_needed" | "skipped";
  statusChangedAt: string | null;
  keywordIds: string[];
  materialDocIds: string[];
};

export type StudentCurriculum = {
  overlayId: string | null;
  units: OverlayUnit[];
};

export async function loadStudentCurriculum(
  supabase: SupabaseClient,
  subjectEnrollmentId: string
): Promise<StudentCurriculum> {
  const { data: overlay } = await supabase
    .from("student_curriculum_overlays")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("status", "active")
    .maybeSingle();

  if (!overlay) return { overlayId: null, units: [] };

  const { data: units } = await supabase
    .from("curriculum_overlay_units")
    .select(
      "id, source_unit_id, position, unit_title, note, status, status_changed_at"
    )
    .eq("overlay_id", overlay.id)
    .order("position", { ascending: true });

  const unitIds = (units ?? []).map((u) => u.id);

  // N+1 방지: 단원마다 따로 조회하지 않고 이 오버레이의 전체 단원 id 집합에
  // 대해 키워드/자료 관계를 각각 한 번씩만 조회한다.
  const [{ data: keywordRows }, { data: materialRows }] = await Promise.all([
    unitIds.length
      ? supabase
          .from("curriculum_overlay_unit_keywords")
          .select("overlay_unit_id, keyword_id")
          .in("overlay_unit_id", unitIds)
      : Promise.resolve({ data: [] as { overlay_unit_id: string; keyword_id: string }[] }),
    unitIds.length
      ? supabase
          .from("curriculum_overlay_unit_materials")
          .select("overlay_unit_id, curriculum_doc_id")
          .in("overlay_unit_id", unitIds)
      : Promise.resolve({ data: [] as { overlay_unit_id: string; curriculum_doc_id: string }[] }),
  ]);

  const keywordIdsByUnit = new Map<string, string[]>();
  for (const row of keywordRows ?? []) {
    const list = keywordIdsByUnit.get(row.overlay_unit_id) ?? [];
    list.push(row.keyword_id);
    keywordIdsByUnit.set(row.overlay_unit_id, list);
  }
  const materialIdsByUnit = new Map<string, string[]>();
  for (const row of materialRows ?? []) {
    const list = materialIdsByUnit.get(row.overlay_unit_id) ?? [];
    list.push(row.curriculum_doc_id);
    materialIdsByUnit.set(row.overlay_unit_id, list);
  }

  return {
    overlayId: overlay.id,
    units: (units ?? []).map((u) => ({
      id: u.id,
      sourceUnitId: u.source_unit_id,
      position: u.position,
      unitTitle: u.unit_title,
      note: u.note,
      status: u.status,
      statusChangedAt: u.status_changed_at,
      keywordIds: keywordIdsByUnit.get(u.id) ?? [],
      materialDocIds: materialIdsByUnit.get(u.id) ?? [],
    })),
  };
}

export type LibraryUnit = {
  id: string;
  position: number;
  unitTitle: string;
};

export type LibraryDoc = {
  id: string;
  title: string;
};

export type EligibleLibrary = {
  units: LibraryUnit[];
  publishedDocs: LibraryDoc[];
};

// 선생님이 "라이브러리에서 불러오기"로 고를 수 있는 원본: 과목 템플릿 단원 전체
// (단원 자체는 draft/published 개념이 없다 — 실제 콘텐츠 게이트는 교재/문제 쪽)와
// 공개(published)된 교재만. 미공개 교재는 애초에 목록에 담지 않아, 선생님이
// 고르는 순간부터 "검수·공개된 콘텐츠만" 원칙을 지킨다(스펙 §4).
export async function loadEligibleLibrary(
  supabase: SupabaseClient,
  subjectId: string
): Promise<EligibleLibrary> {
  const [{ data: units }, { data: docs }] = await Promise.all([
    supabase
      .from("subject_template_units")
      .select("id, position, unit_title")
      .eq("subject_id", subjectId)
      .order("position", { ascending: true }),
    supabase
      .from("curriculum_docs")
      .select("id, title")
      .eq("subject_id", subjectId)
      .eq("status", "published")
      .order("title", { ascending: true }),
  ]);

  return {
    units: (units ?? []).map((u) => ({ id: u.id, position: u.position, unitTitle: u.unit_title })),
    publishedDocs: (docs ?? []).map((d) => ({ id: d.id, title: d.title })),
  };
}
