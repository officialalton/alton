import type { SupabaseClient } from "@supabase/supabase-js";

export type MaterialProblem = {
  id: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string | null;
  skillType: string | null;
  // 새로고침해도 유지되도록, 기존 시도 기록에서 재구성한 현재 상태.
  priorWrongCount: number;
  correct: boolean | null; // true=정답, false=오답으로 종료(3회 소진), null=아직 안 끝남
  done: boolean;
  submittedResponse: string | null; // essay/math 이미 제출한 응답
};

export type MaterialSection = {
  id: string;
  title: string;
  body: string;
  teachingTip: string | null;
  problems: MaterialProblem[];
};

export type MaterialData = {
  docId: string;
  title: string;
  sections: MaterialSection[];
} | null;

export async function loadMaterialData(
  supabase: SupabaseClient,
  curriculumDocId: string | null,
  sessionId: string,
  studentId: string
): Promise<MaterialData> {
  if (!curriculumDocId) return null;

  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, title")
    .eq("id", curriculumDocId)
    .single();
  if (!doc) return null;

  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position, title, body, teaching_tip")
    .eq("curriculum_doc_id", curriculumDocId)
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

  const { data: attempts } = problemIds.length
    ? await supabase
        .from("session_problem_attempts")
        .select("problem_id, correct, response, attempted_at")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .in("problem_id", problemIds)
        .order("attempted_at", { ascending: true })
    : { data: [] as never[] };

  function buildProblem(p: NonNullable<typeof problems>[number]): MaterialProblem {
    const attemptsForProblem = (attempts ?? []).filter(
      (a) => a.problem_id === p.id
    );
    const wrongCount = attemptsForProblem.filter(
      (a) => a.correct === false
    ).length;
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
        p.format !== "mc" && typeof lastResponse === "string"
          ? lastResponse
          : null,
    };
  }

  const problemsBySection = new Map<string, MaterialProblem[]>();
  (problems ?? []).forEach((p) => {
    const list = problemsBySection.get(p.section_id) ?? [];
    list.push(buildProblem(p));
    problemsBySection.set(p.section_id, list);
  });

  return {
    docId: doc.id,
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
