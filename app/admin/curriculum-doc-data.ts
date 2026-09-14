import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubjectKeyword } from "./subject-data";

export type DocProblem = {
  id: string;
  format: "mc" | "spr" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  /** spr(숫자 입력) 동치 정답 목록. 다른 형식은 null. */
  answers?: string[] | null;
  /** 도형·그래프 데이터(lib/problem-figures). */
  figure?: unknown | null;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  // R9(Task 2): 확정(confirmed)된 문제만 실제로 이 배열에 값이 들어간다(트리거가
  // draft 문제의 problem_keywords 행 생성을 막는다) — draft 문제는 항상 [].
  keywords?: SubjectKeyword[];
};

export type DocSection = {
  id: string;
  position: number;
  title: string;
  body: string;
  teachingTip: string | null;
  sectionType: "concept" | "problem";
  problems: DocProblem[];
  // R9(Task 2): 공개(published)된 교재의 섹션만 실제로 값이 들어간다 — draft 교재는 항상 [].
  keywords?: SubjectKeyword[];
};

export type DocEditorData = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  unitId: string | null;
  unitTitle: string | null;
  status: string;
  sections: DocSection[];
  // R9(Task 2): 이 교재가 속한 과목의 공용 키워드 사전 전체(태깅 picker용).
  subjectKeywords?: SubjectKeyword[];
  // 이 과목의 단원 목록. 교재를 만들 때 단원을 안 정했어도 나중에 바꿀 수
  // 있어야 한다 — 편집 화면이 이 목록으로 고르게 한다.
  subjectUnits?: { id: string; unitTitle: string; position: number }[];
  // P2 2차: 교재당 대표 키워드 1개. null은 "아직 정하지 않음"이다.
  primaryKeywordId: string | null;
  // 그 키워드 안에서의 기본 교재 순서. null이면 제목순으로 뒤에 붙는다.
  primaryKeywordPosition: number | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

function extractUnitTitle(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { unit_title?: string } | null)?.unit_title ?? null;
}

// 2026-09-10(P1 성능 배치 — "과목 및 교재" 첫 진입) — 이 함수는 문서마다
// 전체 섹션 본문·티칭 팁·문제·키워드까지 통째로 읽는다. 관리자 목록 화면
// (CurriculumDocsTab/MaterialsLibraryTab)은 실제로 제목·상태·과목·단원·
// 섹션 개수만 쓰므로, 목록 첫 진입에는 아래 loadCurriculumDocList()(경량,
// 본문/문제 미조회)를 쓰고 이 함수는 특정 문서를 "열 때"만
// loadCurriculumDocsByIds()를 통해 호출한다. 전체를 무제한으로 읽는 이
// 함수 자체는 하위 호환(기존 테스트)을 위해 그대로 두되, admin/page.tsx의
// SSR 경로에서는 더 이상 호출하지 않는다.
export async function loadAllCurriculumDocs(
  supabase: SupabaseClient
): Promise<DocEditorData[]> {
  return loadCurriculumDocsByIds(supabase, null);
}

/** 특정 문서 id들만(또는 docIds=null이면 전체) 전체 상세(섹션·문제·키워드
 * 포함)를 읽는다. 문서 하나를 열 때는 [docId] 하나만 넘겨 그 문서만 조회한다 —
 * 목록 전체를 다시 읽지 않는다. */
export async function loadCurriculumDocsByIds(
  supabase: SupabaseClient,
  filterDocIds: string[] | null
): Promise<DocEditorData[]> {
  if (filterDocIds && filterDocIds.length === 0) return [];
  let query = supabase
    .from("curriculum_docs")
    .select(
      "id, title, status, subject_id, unit_id, primary_keyword_id, primary_keyword_position, subject:subjects(name), unit:subject_template_units!curriculum_docs_unit_id_fkey(unit_title)"
    )
    .order("title", { ascending: true });
  if (filterDocIds) query = query.in("id", filterDocIds);
  const { data: docs } = await query;
  if (!docs || docs.length === 0) return [];

  const docIds = docs.map((d) => d.id);
  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, curriculum_doc_id, position, title, body, teaching_tip, section_type")
    .in("curriculum_doc_id", docIds)
    .order("position", { ascending: true });

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: problems } = sectionIds.length
    ? await supabase
        .from("problems")
        .select(
          "id, section_id, format, passage, options, correct_index, explanation, difficulty"
        )
        .in("section_id", sectionIds)
    : { data: [] as never[] };

  const problemIds = (problems ?? []).map((p) => p.id);
  const subjectIds = Array.from(new Set(docs.map((d) => d.subject_id)));

  // R9(Task 2) N+1 방지: 문서마다/섹션마다/문제마다 따로 조회하지 않고,
  // 이번 페이지에 등장하는 과목/섹션/문제 id 전체에 대해 각각 한 번씩만 조회한다.
  const [
    { data: subjectKeywordRows },
    { data: sectionKeywordRows },
    { data: problemKeywordRows },
    { data: subjectUnitRows },
  ] = await Promise.all([
      subjectIds.length
        ? supabase
            .from("subject_keywords")
            .select("id, subject_id, label, status")
            .in("subject_id", subjectIds)
            .order("label", { ascending: true })
        : Promise.resolve({ data: [] as never[] }),
      sectionIds.length
        ? supabase
            .from("curriculum_doc_section_keywords")
            .select("section_id, keyword:subject_keywords(id, label, status)")
            .in("section_id", sectionIds)
        : Promise.resolve({ data: [] as never[] }),
      problemIds.length
        ? supabase
            .from("problem_keywords")
            .select("problem_id, keyword:subject_keywords(id, label, status)")
            .in("problem_id", problemIds)
        : Promise.resolve({ data: [] as never[] }),
      subjectIds.length
        ? supabase
            .from("subject_template_units")
            .select("id, subject_id, unit_title, position")
            .in("subject_id", subjectIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as never[] }),
    ]);

  function extractKeyword(rel: unknown): SubjectKeyword | null {
    const row = Array.isArray(rel) ? rel[0] : rel;
    const k = row as { id?: string; label?: string; status?: string } | null;
    if (!k?.id) return null;
    return { id: k.id, label: k.label ?? "", status: k.status ?? "active" };
  }

  const keywordsBySection = new Map<string, SubjectKeyword[]>();
  for (const row of sectionKeywordRows ?? []) {
    const kw = extractKeyword((row as { keyword: unknown }).keyword);
    if (!kw) continue;
    const sectionId = (row as { section_id: string }).section_id;
    const list = keywordsBySection.get(sectionId) ?? [];
    list.push(kw);
    keywordsBySection.set(sectionId, list);
  }

  const keywordsByProblem = new Map<string, SubjectKeyword[]>();
  for (const row of problemKeywordRows ?? []) {
    const kw = extractKeyword((row as { keyword: unknown }).keyword);
    if (!kw) continue;
    const problemId = (row as { problem_id: string }).problem_id;
    const list = keywordsByProblem.get(problemId) ?? [];
    list.push(kw);
    keywordsByProblem.set(problemId, list);
  }

  const keywordsBySubject = new Map<string, SubjectKeyword[]>();
  for (const k of subjectKeywordRows ?? []) {
    const row = k as { id: string; subject_id: string; label: string; status: string };
    const list = keywordsBySubject.get(row.subject_id) ?? [];
    list.push({ id: row.id, label: row.label, status: row.status });
    keywordsBySubject.set(row.subject_id, list);
  }

  const unitsBySubject = new Map<string, { id: string; unitTitle: string; position: number }[]>();
  for (const u of subjectUnitRows ?? []) {
    const row = u as { id: string; subject_id: string; unit_title: string; position: number };
    const list = unitsBySubject.get(row.subject_id) ?? [];
    list.push({ id: row.id, unitTitle: row.unit_title, position: row.position });
    unitsBySubject.set(row.subject_id, list);
  }
  for (const list of unitsBySubject.values()) list.sort((a, b) => a.position - b.position);

  const problemsBySection = new Map<string, DocProblem[]>();
  for (const p of problems ?? []) {
    const list = problemsBySection.get(p.section_id) ?? [];
    list.push({
      id: p.id,
      format: p.format,
      passage: p.passage,
      options: p.options,
      correctIndex: p.correct_index,
      explanation: p.explanation,
      difficulty: p.difficulty,
      keywords: keywordsByProblem.get(p.id) ?? [],
    });
    problemsBySection.set(p.section_id, list);
  }

  const sectionsByDoc = new Map<string, DocSection[]>();
  for (const s of sections ?? []) {
    const list = sectionsByDoc.get(s.curriculum_doc_id) ?? [];
    list.push({
      id: s.id,
      position: s.position,
      title: s.title,
      body: s.body ?? "",
      teachingTip: s.teaching_tip,
      sectionType: s.section_type,
      problems: problemsBySection.get(s.id) ?? [],
      keywords: keywordsBySection.get(s.id) ?? [],
    });
    sectionsByDoc.set(s.curriculum_doc_id, list);
  }

  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    subjectId: d.subject_id,
    subjectName: extractName(d.subject),
    unitId: d.unit_id,
    unitTitle: extractUnitTitle(d.unit),
    status: d.status,
    sections: sectionsByDoc.get(d.id) ?? [],
    subjectKeywords: keywordsBySubject.get(d.subject_id) ?? [],
    subjectUnits: unitsBySubject.get(d.subject_id) ?? [],
    primaryKeywordId: (d.primary_keyword_id as string | null) ?? null,
    primaryKeywordPosition: (d.primary_keyword_position as number | null) ?? null,
  }));
}

/** 문서 하나의 전체 상세(섹션·문제·키워드)를 읽는다 — 편집 화면(CurriculumDocEditor)을
 * 열 때만 호출한다. */
export async function loadCurriculumDocDetail(
  supabase: SupabaseClient,
  docId: string
): Promise<DocEditorData | null> {
  const [doc] = await loadCurriculumDocsByIds(supabase, [docId]);
  return doc ?? null;
}

// 2026-09-10(P1 성능 배치) — 목록 화면(CurriculumDocsTab의 flat 목록,
// MaterialsLibraryTab의 과목→단원→교재 드릴다운)은 섹션 본문·티칭 팁·
// 문제·키워드를 전혀 렌더링하지 않는다(제목·상태·과목·단원·섹션 개수만
// 씀). 이 함수는 그 목록에 필요한 값만 조회한다 — curriculum_docs 1회 +
// 섹션 개수 집계 1회, 총 2회 쿼리로 끝난다(문서·섹션 수와 무관하게 고정).
export type CurriculumDocListItem = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  unitId: string | null;
  unitTitle: string | null;
  status: string;
  sectionCount: number;
  // P2 2차: 대표 키워드가 아직 없는 교재를 목록에서 찾아낼 수 있어야 한다.
  hasPrimaryKeyword: boolean;
  /** 대표 키워드 — 교재 탭이 키워드별·단원별로 접는 기준(2026-09-14). */
  primaryKeywordId: string | null;
  primaryKeywordLabel: string | null;
  // 보관된 교재는 현재 목록에서 빠지고 '보관됨'에서만 보인다.
  archivedAt: string | null;
  archivedReason: string | null;
  /** html = 본문 편집 교재. pdf/video = Drive 에서 가져온 파일 자료(2026-09-14). */
  kind: "html" | "pdf" | "video";
  sourceDriveName: string | null;
  hasDriveSource: boolean;
};

export async function loadCurriculumDocList(supabase: SupabaseClient): Promise<CurriculumDocListItem[]> {
  const { data: docs } = await supabase
    .from("curriculum_docs")
    .select(
      "id, title, status, subject_id, unit_id, primary_keyword_id, archived_at, archived_reason, kind, source_drive_name, source_drive_file_id, subject:subjects(name), unit:subject_template_units!curriculum_docs_unit_id_fkey(unit_title), primary_keyword:subject_keywords!curriculum_docs_primary_keyword_id_fkey(label)"
    )
    .order("title", { ascending: true });
  if (!docs || docs.length === 0) return [];

  const docIds = docs.map((d) => d.id);
  const { data: sectionRows } = await supabase
    .from("curriculum_doc_sections")
    .select("curriculum_doc_id")
    .in("curriculum_doc_id", docIds);

  const sectionCountByDoc = new Map<string, number>();
  for (const s of sectionRows ?? []) {
    sectionCountByDoc.set(s.curriculum_doc_id, (sectionCountByDoc.get(s.curriculum_doc_id) ?? 0) + 1);
  }

  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    subjectId: d.subject_id,
    subjectName: extractName(d.subject),
    unitId: d.unit_id,
    unitTitle: extractUnitTitle(d.unit),
    status: d.status,
    sectionCount: sectionCountByDoc.get(d.id) ?? 0,
    hasPrimaryKeyword: Boolean(d.primary_keyword_id),
    primaryKeywordId: (d.primary_keyword_id as string | null) ?? null,
    primaryKeywordLabel: extractLabel((d as { primary_keyword?: unknown }).primary_keyword),
    archivedAt: (d.archived_at as string | null) ?? null,
    archivedReason: (d.archived_reason as string | null) ?? null,
    kind: ((d as { kind?: string }).kind === "pdf" || (d as { kind?: string }).kind === "video"
      ? (d as { kind: "pdf" | "video" }).kind
      : "html"),
    sourceDriveName: ((d as { source_drive_name?: string | null }).source_drive_name as string | null) ?? null,
    hasDriveSource: Boolean((d as { source_drive_file_id?: string | null }).source_drive_file_id),
  }));
}

function extractLabel(rel: unknown): string | null {
  const one = Array.isArray(rel) ? rel[0] : rel;
  const label = (one as { label?: string } | null | undefined)?.label;
  return typeof label === "string" ? label : null;
}
