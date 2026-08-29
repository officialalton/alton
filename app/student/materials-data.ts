import type { SupabaseClient } from "@supabase/supabase-js";

export type LibraryDocSummary = {
  id: string;
  title: string;
  unitTitle: string | null;
};

export type LibrarySubject = {
  subjectId: string;
  subjectName: string;
  docs: LibraryDocSummary[];
};

export type LibraryProblem = {
  id: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string | null;
  skillType: string | null;
  priorWrongCount: number;
  correct: boolean | null;
  done: boolean;
  submittedResponse: string | null;
};

export type LibrarySection = {
  id: string;
  title: string;
  body: string;
  teachingTip: string | null;
  problems: LibraryProblem[];
};

export type LibraryDocDetail = {
  id: string;
  title: string;
  sections: LibrarySection[];
};

export async function loadMaterialsLibrary(
  supabase: SupabaseClient,
  studentId: string
): Promise<LibrarySubject[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("subject_id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const subjects = new Map<string, string>();
  for (const e of enrollments ?? []) {
    const row = Array.isArray(e.subject) ? e.subject[0] : e.subject;
    subjects.set(e.subject_id, (row as { name?: string } | null)?.name ?? "");
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
    ? await supabase
        .from("subject_template_units")
        .select("id, unit_title")
        .in("id", unitIds)
    : { data: [] as { id: string; unit_title: string }[] };
  const unitTitleById = new Map((units ?? []).map((u) => [u.id, u.unit_title]));

  const bySubject = new Map<string, LibraryDocSummary[]>();
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

export async function loadLibraryDoc(
  supabase: SupabaseClient,
  docId: string,
  studentId: string | null
): Promise<LibraryDocDetail | null> {
  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, title")
    .eq("id", docId)
    .eq("status", "published")
    .maybeSingle();
  if (!doc) return null;

  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position, title, body, teaching_tip")
    .eq("curriculum_doc_id", docId)
    .order("position", { ascending: true });

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: problems } = sectionIds.length
    ? await supabase
        .from("problems")
        .select(
          "id, format, passage, options, correct_index, explanation, difficulty, skill_type, section_id"
        )
        .in("section_id", sectionIds)
        .eq("status", "confirmed")
    : { data: [] as never[] };

  const problemIds = (problems ?? []).map((p) => p.id);

  const { data: attempts } = studentId && problemIds.length
    ? await supabase
        .from("session_problem_attempts")
        .select("problem_id, correct, response")
        .is("session_id", null)
        .eq("student_id", studentId)
        .in("problem_id", problemIds)
    : { data: [] as { problem_id: string; correct: boolean | null; response: unknown }[] };

  function buildProblem(p: NonNullable<typeof problems>[number]): LibraryProblem {
    const attemptsForProblem = (attempts ?? []).filter(
      (a) => a.problem_id === p.id
    );
    const wrongCount = attemptsForProblem.filter((a) => a.correct === false).length;
    const correctAttempt = attemptsForProblem.find((a) => a.correct === true);
    const correct = correctAttempt ? true : wrongCount >= 3 ? false : null;
    const done = correct !== null;
    const lastResponse = attemptsForProblem.at(-1)?.response ?? null;

    return {
      id: p.id,
      format: p.format,
      passage: p.passage,
      options: p.options,
      correctIndex: p.correct_index,
      explanation: p.explanation,
      difficulty: p.difficulty,
      skillType: p.skill_type,
      priorWrongCount: wrongCount,
      correct,
      done,
      submittedResponse:
        p.format !== "mc" && typeof lastResponse === "string" ? lastResponse : null,
    };
  }

  const problemsBySection = new Map<string, LibraryProblem[]>();
  (problems ?? []).forEach((p) => {
    const list = problemsBySection.get(p.section_id) ?? [];
    list.push(buildProblem(p));
    problemsBySection.set(p.section_id, list);
  });

  return {
    id: doc.id,
    title: doc.title,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body ?? "",
      teachingTip: s.teaching_tip,
      problems: problemsBySection.get(s.id) ?? [],
    })),
  };
}
