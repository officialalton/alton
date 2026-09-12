import type { SupabaseClient } from "@supabase/supabase-js";

// R9(레슨 준비 Task 1) — 준비된 선택(session_prepared_selections, 임시보관함/
// 세션 부착) 읽기 전용 로더. RLS(20261232000000_r9_session_prepared_selection.sql)가
// "담당 선생님/관리자"만 조회를 허용하므로, 이 함수는 그 이상의 권한 검사를
// 하지 않는다 — 담당이 아닌 선생님이 호출하면 그냥 빈 결과가 온다.

export type PreparedSelectionStatus = "staged" | "pinned" | "archived";
export type PreparedContentType = "material_section" | "problem";

export type PreparedSelectionUnit = {
  id: string;
  overlayUnitId: string;
  position: number;
  keywordIds: string[];
};

export type PreparedContentItem = {
  id: string;
  preparedSelectionUnitId: string;
  contentType: PreparedContentType;
  contentId: string;
  position: number;
  included: boolean;
};

export type PreparedSelection = {
  id: string;
  subjectEnrollmentId: string;
  teacherId: string;
  status: PreparedSelectionStatus;
  sessionId: string | null;
  pinnedAt: string | null;
  units: PreparedSelectionUnit[];
  contentItems: PreparedContentItem[];
};

type SelectionRow = {
  id: string;
  subject_enrollment_id: string;
  teacher_id: string;
  status: PreparedSelectionStatus;
  session_id: string | null;
  pinned_at: string | null;
};

function mapSelectionRow(row: SelectionRow): Omit<PreparedSelection, "units" | "contentItems"> {
  return {
    id: row.id,
    subjectEnrollmentId: row.subject_enrollment_id,
    teacherId: row.teacher_id,
    status: row.status,
    sessionId: row.session_id,
    pinnedAt: row.pinned_at,
  };
}

// N+1 방지: 여러 선택의 단원/키워드/콘텐츠 항목을 각각 한 번씩만 조회해
// selectionId로 그룹핑한다(student-curriculum-data.ts의 loadStudentCurriculum과
// 동일한 배치 패턴).
async function attachChildren(
  supabase: SupabaseClient,
  selections: SelectionRow[]
): Promise<PreparedSelection[]> {
  const selectionIds = selections.map((s) => s.id);
  if (selectionIds.length === 0) return [];

  const [{ data: unitRows }, { data: contentRows }] = await Promise.all([
    supabase
      .from("session_prepared_selection_units")
      .select("id, prepared_selection_id, overlay_unit_id, position")
      .in("prepared_selection_id", selectionIds)
      .order("position", { ascending: true }),
    supabase
      .from("session_prepared_selection_content_items")
      .select("id, prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position, included")
      .in("prepared_selection_id", selectionIds)
      .order("position", { ascending: true }),
  ]);

  const unitIds = (unitRows ?? []).map((u: { id: string }) => u.id);
  const { data: keywordRows } = unitIds.length
    ? await supabase
        .from("session_prepared_selection_unit_keywords")
        .select("prepared_selection_unit_id, keyword_id")
        .in("prepared_selection_unit_id", unitIds)
    : { data: [] as { prepared_selection_unit_id: string; keyword_id: string }[] };

  const keywordIdsByUnit = new Map<string, string[]>();
  for (const row of keywordRows ?? []) {
    const list = keywordIdsByUnit.get(row.prepared_selection_unit_id) ?? [];
    list.push(row.keyword_id);
    keywordIdsByUnit.set(row.prepared_selection_unit_id, list);
  }

  const unitsBySelection = new Map<string, PreparedSelectionUnit[]>();
  for (const row of unitRows ?? []) {
    const list = unitsBySelection.get(row.prepared_selection_id) ?? [];
    list.push({
      id: row.id,
      overlayUnitId: row.overlay_unit_id,
      position: row.position,
      keywordIds: keywordIdsByUnit.get(row.id) ?? [],
    });
    unitsBySelection.set(row.prepared_selection_id, list);
  }

  const contentItemsBySelection = new Map<string, PreparedContentItem[]>();
  for (const row of contentRows ?? []) {
    const list = contentItemsBySelection.get(row.prepared_selection_id) ?? [];
    list.push({
      id: row.id,
      preparedSelectionUnitId: row.prepared_selection_unit_id,
      contentType: row.content_type,
      contentId: row.content_id,
      position: row.position,
      included: row.included,
    });
    contentItemsBySelection.set(row.prepared_selection_id, list);
  }

  return selections.map((row) => ({
    ...mapSelectionRow(row),
    units: unitsBySelection.get(row.id) ?? [],
    contentItems: contentItemsBySelection.get(row.id) ?? [],
  }));
}

// 임시보관함(holding area) — 아직 특정 세션에 붙지 않은(session_id is null),
// 아직 pin되지 않은(status='staged') 준비된 선택 목록. detach 이후에도 여기
// 그대로 재등장한다(행이 삭제되지 않으므로).
export async function loadHeldSelections(
  supabase: SupabaseClient,
  subjectEnrollmentId: string
): Promise<PreparedSelection[]> {
  const { data: selections } = await supabase
    .from("session_prepared_selections")
    .select("id, subject_enrollment_id, teacher_id, status, session_id, pinned_at")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .is("session_id", null)
    .eq("status", "staged")
    .order("created_at", { ascending: false });

  return attachChildren(supabase, selections ?? []);
}

// 특정 세션에 현재 붙어있는 준비된 선택(staged 또는 pinned, archived 제외) — 세션당
// 최대 1개(유니크 인덱스가 보장).
export async function loadSessionSelection(
  supabase: SupabaseClient,
  sessionId: string
): Promise<PreparedSelection | null> {
  const { data: selection } = await supabase
    .from("session_prepared_selections")
    .select("id, subject_enrollment_id, teacher_id, status, session_id, pinned_at")
    .eq("session_id", sessionId)
    .neq("status", "archived")
    .maybeSingle();

  if (!selection) return null;
  const [full] = await attachChildren(supabase, [selection]);
  return full ?? null;
}

export type EligibleMaterialSection = {
  sectionId: string;
  title: string;
  curriculumDocId: string;
  keywordId: string;
};

export type EligibleProblem = {
  problemId: string;
  passage: string | null;
  keywordId: string;
};

export type EligibleSelectionContent = {
  materialSections: EligibleMaterialSection[];
  problems: EligibleProblem[];
};

// 선생님이 스테이징 콘텐츠로 고를 수 있는 후보 — 이 선택의 모든 단원의 활성
// 키워드 부분집합에 대해 curriculum_doc_section_keywords_selectable/
// problem_keywords_selectable(코렉티브 2, published/confirmed 게이트가 있는
// 읽기 시점 뷰)를 조회한다. 관계 테이블을 직접 읽지 않는다(§corrective 2).
export async function loadEligibleContentForSelection(
  supabase: SupabaseClient,
  preparedSelectionId: string
): Promise<EligibleSelectionContent> {
  const { data: units } = await supabase
    .from("session_prepared_selection_units")
    .select("id")
    .eq("prepared_selection_id", preparedSelectionId);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (unitIds.length === 0) return { materialSections: [], problems: [] };

  const { data: keywordRows } = await supabase
    .from("session_prepared_selection_unit_keywords")
    .select("keyword_id")
    .in("prepared_selection_unit_id", unitIds);
  const keywordIds = Array.from(new Set((keywordRows ?? []).map((k: { keyword_id: string }) => k.keyword_id)));
  if (keywordIds.length === 0) return { materialSections: [], problems: [] };

  // 임베드 조인(!inner) 대신 두 단계 조회로 나눈다 — selectable 뷰에서 (id,
  // keyword_id) 쌍을 먼저 얻고, 표시용 필드는 기저 테이블에서 별도로 채운다
  // (Supabase 임베드 타입 추론이 FK 방향에 따라 배열/단일을 다르게 잡는 문제를
  // 피하고, 뷰가 여전히 유일한 selectable 판정 지점이라는 점도 그대로 유지한다).
  const [{ data: sectionKeywordRows }, { data: problemKeywordRows }] = await Promise.all([
    supabase
      .from("curriculum_doc_section_keywords_selectable")
      .select("section_id, keyword_id")
      .in("keyword_id", keywordIds),
    supabase
      .from("problem_keywords_selectable")
      .select("problem_id, keyword_id")
      .in("keyword_id", keywordIds),
  ]);

  const sectionIds = Array.from(
    new Set((sectionKeywordRows ?? []).map((r: { section_id: string }) => r.section_id))
  );
  const problemIds = Array.from(
    new Set((problemKeywordRows ?? []).map((r: { problem_id: string }) => r.problem_id))
  );

  const [{ data: sectionDetails }, { data: problemDetails }] = await Promise.all([
    sectionIds.length
      ? supabase.from("curriculum_doc_sections").select("id, title, curriculum_doc_id").in("id", sectionIds)
      : Promise.resolve({ data: [] as { id: string; title: string; curriculum_doc_id: string }[] }),
    problemIds.length
      ? supabase.from("problems").select("id, passage").in("id", problemIds)
      : Promise.resolve({ data: [] as { id: string; passage: string | null }[] }),
  ]);

  const sectionDetailById = new Map((sectionDetails ?? []).map((s: { id: string; title: string; curriculum_doc_id: string }) => [s.id, s]));
  const problemDetailById = new Map((problemDetails ?? []).map((p: { id: string; passage: string | null }) => [p.id, p]));

  const materialSections: EligibleMaterialSection[] = (sectionKeywordRows ?? [])
    .map((row: { section_id: string; keyword_id: string }) => {
      const detail = sectionDetailById.get(row.section_id);
      if (!detail) return null;
      return {
        sectionId: row.section_id,
        keywordId: row.keyword_id,
        title: detail.title,
        curriculumDocId: detail.curriculum_doc_id,
      };
    })
    .filter((row): row is EligibleMaterialSection => row !== null);

  const problems: EligibleProblem[] = (problemKeywordRows ?? [])
    .map((row: { problem_id: string; keyword_id: string }) => {
      const detail = problemDetailById.get(row.problem_id);
      if (!detail) return null;
      return { problemId: row.problem_id, keywordId: row.keyword_id, passage: detail.passage };
    })
    .filter((row): row is EligibleProblem => row !== null);

  return { materialSections, problems };
}
