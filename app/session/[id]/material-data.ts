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

export type CanvasStroke = {
  /** 그릴 때의 캔버스 너비(px). 화면 크기가 바뀌어도 필기 위치를 유지하는 기준. */
  w?: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  tool: "pen" | "eraser";
};

export type MaterialData = {
  docId: string;
  title: string;
  sections: MaterialSection[];
  canvasStrokes: CanvasStroke[];
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

  const { data: annotation } = await supabase
    .from("canvas_annotations")
    .select("strokes")
    .eq("session_id", sessionId)
    .eq("curriculum_doc_id", curriculumDocId)
    .maybeSingle();

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
    canvasStrokes: (annotation?.strokes as CanvasStroke[] | null) ?? [],
  };
}

// P2/P3 5단계 — 수업 시작 시 고정된 교재를 읽는다.
//
// loadMaterialData()는 세션 행의 curriculum_doc_id 하나를 통째로 펼친다(레거시
// 경로). v3 수업에서 실제로 다루는 교재는 "선생님이 준비 화면에서 고르고 수업
// 시작 시 고정된 조각들"(session_content_manifest)이라, 그 목록을 그대로 읽어야
// 화면과 준비 내용이 일치한다. 고정된 교재가 없으면 null을 돌려주고, 호출하는
// 쪽이 기존 경로로 넘어간다.
export async function loadPinnedMaterialData(
  supabase: SupabaseClient,
  sessionId: string
): Promise<MaterialData> {
  const { data: manifest } = await supabase
    .from("session_content_manifest")
    .select("content_id, display_position")
    .eq("session_id", sessionId)
    .eq("content_type", "material_section")
    .order("display_position", { ascending: true });
  if (!manifest?.length) return null;

  const sectionIds = manifest.map((m) => m.content_id as string);
  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, title, body, teaching_tip, curriculum_doc_id")
    .in("id", sectionIds);
  if (!sections?.length) return null;

  const byId = new Map(sections.map((s) => [s.id as string, s]));
  const ordered = sectionIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (!ordered.length) return null;

  const docId = ordered[0].curriculum_doc_id as string;
  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, title")
    .eq("id", docId)
    .maybeSingle();

  const { data: annotation } = await supabase
    .from("canvas_annotations")
    .select("strokes")
    .eq("session_id", sessionId)
    .eq("curriculum_doc_id", docId)
    .maybeSingle();

  return {
    docId,
    title: (doc?.title as string) ?? "이번 수업 교재",
    sections: ordered.map((s) => ({
      id: s.id as string,
      title: s.title as string,
      body: (s.body as string) ?? "",
      teachingTip: (s.teaching_tip as string | null) ?? null,
      // 문제는 "문제" 탭에서 고정된 버전으로 다룬다 — 교재 안에 섞지 않는다.
      problems: [],
    })),
    canvasStrokes: (annotation?.strokes as CanvasStroke[] | null) ?? [],
  };
}
