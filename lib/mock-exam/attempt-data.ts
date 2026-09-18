import type { SupabaseClient } from "@supabase/supabase-js";

// 고정형 SAT 모의고사 V1 — 응시 기록 읽기 계층(학생/교사/학부모 공용, 권한은 RLS가 가른다).
// 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3절(역할별 흐름)·5절(상태)·7절(답안·채점).

export type AttemptStatus = "assigned" | "in_progress" | "submitted" | "graded";

export type MockExamAttemptSummary = {
  id: string;
  examSetId: string;
  examSetName: string;
  difficultyTier: string;
  studentId: string;
  studentName: string | null;
  status: AttemptStatus;
  dueAt: string | null;
  startBy: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  totalCount: number;
  correctCount: number | null;
};

export type MockExamAttemptItem = {
  setItemId: string;
  section: "rw" | "math";
  position: number;
  problemId: string;
  satDomain: string;
  skillCode: string | null;
  difficulty: string;
  format: "mc" | "essay" | "math" | "spr";
  passage: string | null;
  question: string | null;
  options: string[] | null;
  correctIndex: number | null;
  answers: string[] | null;
  explanation: string | null;
  figure: unknown;
  response: string | null;
  correct: boolean | null;
  flagged: boolean;
  timeSpentSeconds: number | null;
};

export type MockExamAttemptDetail = {
  id: string;
  examSetId: string;
  examSetName: string;
  difficultyTier: string;
  studentId: string;
  studentName: string | null;
  status: AttemptStatus;
  dueAt: string | null;
  startBy: string | null;
  maxAttempts: number;
  attemptCount: number;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  rwTimeLimitMinutes: number;
  mathTimeLimitMinutes: number;
  mathCalculatorAllowed: boolean;
  mathReferenceSheetAllowed: boolean;
  timeRemainingSeconds: { rw?: number; math?: number } | null;
  items: MockExamAttemptItem[];
};

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const SUMMARY_COLUMNS = `
  id, exam_set_id, student_id, status, due_at, start_by, started_at, submitted_at, graded_at,
  exam_set:mock_exam_sets!mock_exam_attempts_exam_set_id_fkey(name, difficulty_tier),
  student:profiles!mock_exam_attempts_student_id_fkey(name)
`;

async function withCounts(
  supabase: SupabaseClient,
  rows: {
    id: string;
    exam_set_id: string;
    student_id: string;
    status: AttemptStatus;
    due_at: string | null;
    start_by: string | null;
    started_at: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    exam_set: { name: string; difficulty_tier: string } | { name: string; difficulty_tier: string }[] | null;
    student: { name: string | null } | { name: string | null }[] | null;
  }[],
): Promise<MockExamAttemptSummary[]> {
  if (rows.length === 0) return [];
  const attemptIds = rows.map((r) => r.id);
  const examSetIds = [...new Set(rows.map((r) => r.exam_set_id))];
  const [{ data: itemCounts }, { data: answerCounts }] = await Promise.all([
    supabase.from("mock_exam_set_items").select("exam_set_id").in("exam_set_id", examSetIds),
    supabase.from("mock_exam_answers").select("attempt_id, correct").in("attempt_id", attemptIds),
  ]);
  const totalBySet = new Map<string, number>();
  for (const r of itemCounts ?? []) totalBySet.set(r.exam_set_id, (totalBySet.get(r.exam_set_id) ?? 0) + 1);
  const correctByAttempt = new Map<string, number>();
  const gradedByAttempt = new Map<string, boolean>();
  for (const r of answerCounts ?? []) {
    gradedByAttempt.set(r.attempt_id, true);
    if (r.correct) correctByAttempt.set(r.attempt_id, (correctByAttempt.get(r.attempt_id) ?? 0) + 1);
  }
  return rows.map((r) => {
    const set = firstOf(r.exam_set);
    return {
      id: r.id,
      examSetId: r.exam_set_id,
      examSetName: set?.name ?? "모의고사",
      difficultyTier: set?.difficulty_tier ?? "standard",
      studentId: r.student_id,
      studentName: firstOf(r.student)?.name ?? null,
      status: r.status,
      dueAt: r.due_at,
      startBy: r.start_by,
      startedAt: r.started_at,
      submittedAt: r.submitted_at,
      gradedAt: r.graded_at,
      totalCount: totalBySet.get(r.exam_set_id) ?? 0,
      correctCount: r.status === "graded" && gradedByAttempt.get(r.id) ? correctByAttempt.get(r.id) ?? 0 : null,
    };
  });
}

/** 학생 본인의 모의고사 탭(수업 안/밖 공용) — 자기 응시 기록 전체. */
export async function loadStudentMockExamAttempts(supabase: SupabaseClient, studentId: string): Promise<MockExamAttemptSummary[]> {
  const { data, error } = await supabase
    .from("mock_exam_attempts")
    .select(SUMMARY_COLUMNS)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withCounts(supabase, (data ?? []) as never);
}

/** 학부모 읽기 전용 화면 — 자녀 응시 기록(RLS가 본인 자녀만 허용). */
export async function loadGuardianMockExamAttempts(supabase: SupabaseClient, studentId: string): Promise<MockExamAttemptSummary[]> {
  return loadStudentMockExamAttempts(supabase, studentId);
}

/** 교사가 담당 학생에게 배정한 모의고사 목록(수업 화면 `모의고사` 탭). */
export async function loadTeacherMockExamAttemptsForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<MockExamAttemptSummary[]> {
  const { data, error } = await supabase
    .from("mock_exam_attempts")
    .select(SUMMARY_COLUMNS)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withCounts(supabase, (data ?? []) as never);
}

/** 응시 상세 — 문항·본문·(채점 확정 전까지 숨긴) 정답/해설을 포함한 전체 화면 데이터. */
export async function loadMockExamAttemptDetail(supabase: SupabaseClient, attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { data: attempt, error } = await supabase
    .from("mock_exam_attempts")
    .select(
      `id, exam_set_id, student_id, status, due_at, start_by, max_attempts, attempt_count, started_at, submitted_at, graded_at, time_remaining_seconds,
       exam_set:mock_exam_sets!mock_exam_attempts_exam_set_id_fkey(name, difficulty_tier, rw_time_limit_minutes, math_time_limit_minutes, math_calculator_allowed, math_reference_sheet_allowed),
       student:profiles!mock_exam_attempts_student_id_fkey(name)`,
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!attempt) return null;
  const set = firstOf(
    attempt.exam_set as
      | { name: string; difficulty_tier: string; rw_time_limit_minutes: number; math_time_limit_minutes: number; math_calculator_allowed: boolean; math_reference_sheet_allowed: boolean }
      | { name: string; difficulty_tier: string; rw_time_limit_minutes: number; math_time_limit_minutes: number; math_calculator_allowed: boolean; math_reference_sheet_allowed: boolean }[]
      | null,
  );

  const [{ data: setItems, error: itemsErr }, { data: answers, error: answersErr }] = await Promise.all([
    supabase
      .from("mock_exam_set_items")
      .select(
        `id, section, position, problem_id, sat_domain, skill_code, difficulty,
         problem_version:problem_versions!mock_exam_set_items_problem_version_id_fkey(passage, question, options, correct_index, answers, explanation, figure),
         problem:problems!mock_exam_set_items_problem_id_fkey(format)`,
      )
      .eq("exam_set_id", attempt.exam_set_id)
      .order("section", { ascending: true })
      .order("position", { ascending: true }),
    supabase.from("mock_exam_answers").select("set_item_id, response, correct, flagged, time_spent_seconds").eq("attempt_id", attemptId),
  ]);
  if (itemsErr) throw new Error(itemsErr.message);
  if (answersErr) throw new Error(answersErr.message);

  const answerByItem = new Map((answers ?? []).map((a) => [a.set_item_id, a]));
  const resultsVisible = attempt.status === "graded";

  const items: MockExamAttemptItem[] = (setItems ?? []).map((row) => {
    const version = firstOf(
      row.problem_version as
        | { passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; answers: string[] | null; explanation: string | null; figure: unknown }
        | { passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; answers: string[] | null; explanation: string | null; figure: unknown }[]
        | null,
    );
    const problem = firstOf(row.problem as { format: MockExamAttemptItem["format"] } | { format: MockExamAttemptItem["format"] }[] | null);
    const answer = answerByItem.get(row.id);
    return {
      setItemId: row.id,
      section: row.section,
      position: row.position,
      problemId: row.problem_id,
      satDomain: row.sat_domain,
      skillCode: row.skill_code,
      difficulty: row.difficulty,
      format: problem?.format ?? "mc",
      passage: version?.passage ?? null,
      question: version?.question ?? null,
      options: version?.options ?? null,
      // 실전형 응시에서는 채점 확정 전까지 정답·해설을 숨긴다(사양 4·7절).
      correctIndex: resultsVisible ? (version?.correct_index ?? null) : null,
      answers: resultsVisible ? (version?.answers ?? null) : null,
      explanation: resultsVisible ? (version?.explanation ?? null) : null,
      figure: version?.figure ?? null,
      response: answer?.response ? String(answer.response) : null,
      correct: resultsVisible ? (answer?.correct ?? null) : null,
      flagged: answer?.flagged ?? false,
      timeSpentSeconds: answer?.time_spent_seconds ?? null,
    };
  });

  return {
    id: attempt.id,
    examSetId: attempt.exam_set_id,
    examSetName: set?.name ?? "모의고사",
    difficultyTier: set?.difficulty_tier ?? "standard",
    studentId: attempt.student_id,
    studentName: firstOf(attempt.student as { name: string | null } | { name: string | null }[] | null)?.name ?? null,
    status: attempt.status,
    dueAt: attempt.due_at,
    startBy: attempt.start_by,
    maxAttempts: attempt.max_attempts,
    attemptCount: attempt.attempt_count,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    gradedAt: attempt.graded_at,
    rwTimeLimitMinutes: set?.rw_time_limit_minutes ?? 64,
    mathTimeLimitMinutes: set?.math_time_limit_minutes ?? 70,
    mathCalculatorAllowed: set?.math_calculator_allowed ?? true,
    mathReferenceSheetAllowed: set?.math_reference_sheet_allowed ?? true,
    timeRemainingSeconds: (attempt.time_remaining_seconds as { rw?: number; math?: number } | null) ?? null,
    items,
  };
}

/** 관리자가 배정할 때 고를 공개 세트 목록(교사 배정 화면에서 재사용). */
export async function loadPublishedMockExamSetsForAssignment(
  supabase: SupabaseClient,
): Promise<{ id: string; setGroupId: string; name: string; difficultyTier: string }[]> {
  const { data, error } = await supabase
    .from("mock_exam_sets")
    .select("id, set_group_id, name, difficulty_tier")
    .eq("status", "published")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, setGroupId: r.set_group_id, name: r.name, difficultyTier: r.difficulty_tier }));
}
