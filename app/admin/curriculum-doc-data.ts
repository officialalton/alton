import type { SupabaseClient } from "@supabase/supabase-js";

export type DocProblem = {
  id: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
};

export type DocSection = {
  id: string;
  position: number;
  title: string;
  body: string;
  teachingTip: string | null;
  problems: DocProblem[];
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
    .select("id, curriculum_doc_id, position, title, body, teaching_tip")
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
      problems: problemsBySection.get(s.id) ?? [],
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
  }));
}
