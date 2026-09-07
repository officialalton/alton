import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubjectKeyword } from "./subject-data";

export type DocProblem = {
  id: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
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
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

function extractUnitTitle(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { unit_title?: string } | null)?.unit_title ?? null;
}

export async function loadAllCurriculumDocs(
  supabase: SupabaseClient
): Promise<DocEditorData[]> {
  const { data: docs } = await supabase
    .from("curriculum_docs")
    .select(
      "id, title, status, subject_id, unit_id, subject:subjects(name), unit:subject_template_units!curriculum_docs_unit_id_fkey(unit_title)"
    )
    .order("title", { ascending: true });
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
  const [{ data: subjectKeywordRows }, { data: sectionKeywordRows }, { data: problemKeywordRows }] =
    await Promise.all([
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
  }));
}
