"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { StrokePayload } from "./annotation-events-types";
import { loadSessionProblems, type ProblemGrade, type SessionProblem } from "./session-problem-data";

// P3 4단계(제품 오너 피드백 5) — 문제별 풀이 화이트보드를 실제 학습 흐름에
// 연결한다. 풀이판은 (수업, 학생, 문제, 재풀이 회차) 하나를 가리키고, 모든
// 필기는 그 풀이판을 참조한다 — 문제를 바꾸거나 다시 풀어도 기록이 섞이지 않는다.

export type ProblemWorkBoard = {
  workId: string;
  attemptNo: number;
  submitted: boolean;
  /** 제출 시점에 고정된 답안. */
  submittedChoiceIndex: number | null;
  submittedText: string | null;
  /**
   * 제출 시점까지의 학생 풀이 필기 경계. 이 값보다 뒤에 그린 획은 제출 뒤에
   * 덧그린 것이라 채점 대상이 아니었다.
   */
  submittedStrokeSeq: string | null;
  /** 학생이 남긴 원본 풀이(제출 시점까지). */
  studentStrokes: StrokePayload[];
  /** 제출한 뒤에 덧그린 획 — 채점 대상이 아니었음을 구분해 보여준다. */
  strokesAfterSubmit: StrokePayload[];
  /** 교사 피드백 — 같은 풀이판 위의 별도 레이어다. */
  feedbackStrokes: StrokePayload[];
  /** 채점(2026-09-14). 객관식 자동 채점은 정답과 같은 정보라 교사 조회에서만 채운다. */
  autoCorrect: boolean | null;
  grade: ProblemGrade | null;
  gradeComment: string | null;
  gradedAt: string | null;
};

const WORK_COLUMNS =
  "id, attempt_no, submitted_at, submitted_choice_index, submitted_text, submitted_stroke_seq, auto_correct, grade, grade_comment, graded_at";

type WorkRow = {
  id: string;
  attempt_no: number;
  submitted_at: string | null;
  submitted_choice_index: number | null;
  submitted_text: string | null;
  submitted_stroke_seq: string | null;
  auto_correct: boolean | null;
  grade: string | null;
  grade_comment: string | null;
  graded_at: string | null;
};

/** 풀이판 행의 메타 — 필기는 따로 붙인다. 채점 전 학생에게 자동 채점 결과가 새지 않게 한다. */
function boardMeta(row: WorkRow, revealAuto: boolean): Omit<ProblemWorkBoard, "studentStrokes" | "strokesAfterSubmit" | "feedbackStrokes"> {
  const graded = Boolean(row.graded_at);
  return {
    workId: row.id,
    attemptNo: row.attempt_no,
    submitted: Boolean(row.submitted_at),
    submittedChoiceIndex: row.submitted_choice_index ?? null,
    submittedText: row.submitted_text ?? null,
    submittedStrokeSeq: row.submitted_stroke_seq ?? null,
    autoCorrect: revealAuto || graded ? (row.auto_correct ?? null) : null,
    grade: graded ? ((row.grade as ProblemGrade | null) ?? null) : null,
    gradeComment: graded ? (row.grade_comment ?? null) : null,
    gradedAt: row.graded_at ?? null,
  };
}

const EMPTY_BOARD: ProblemWorkBoard = {
  workId: "",
  attemptNo: 0,
  submitted: false,
  submittedChoiceIndex: null,
  submittedText: null,
  submittedStrokeSeq: null,
  studentStrokes: [],
  strokesAfterSubmit: [],
  feedbackStrokes: [],
  autoCorrect: null,
  grade: null,
  gradeComment: null,
  gradedAt: null,
};

/** 이 문제의 풀이판을 연다(진행 중인 판이 있으면 그대로, 재풀이면 새 판). */
export async function openProblemWork(params: {
  sessionId: string;
  studentId: string;
  problemId: string;
  newAttempt?: boolean;
}): Promise<ProblemWorkBoard> {
  const { user, supabase } = await requireUser();

  // 풀이판을 여는 주체는 학생 본인 또는 그 수업의 담당 교사뿐이다. 교사는
  // 읽기 위해 열 뿐이고, 쓰기 권한은 DB의 범위별 정책이 따로 판단한다.
  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("teacher_id, subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(child_id)")
    .eq("id", params.sessionId)
    .maybeSingle();
  const enrollment = Array.isArray(session?.subject_enrollment)
    ? session?.subject_enrollment[0]
    : session?.subject_enrollment;
  const childId = (enrollment as { child_id?: string } | null)?.child_id;
  if (!session || childId !== params.studentId) {
    throw new Error("이 수업의 풀이판이 아닙니다.");
  }
  const isOwner = user.id === params.studentId;
  const isTeacher = user.id === session.teacher_id;
  if (!isOwner && !isTeacher) {
    // 보호자는 연결된 자녀의 풀이를 읽기 전용으로 본다(2026-09-12 정책).
    // 연결 판단은 DB에 맡긴다 — 여기서 가족 관계를 다시 계산하지 않는다.
    const { data: guardianOk } = await supabase.rpc("is_session_guardian_v3", {
      p_session_id: params.sessionId,
    });
    if (!guardianOk) throw new Error("이 풀이판을 열 권한이 없습니다.");
  }
  // 재풀이는 학생 본인만 시작한다 — 교사가 학생의 풀이 회차를 늘리지 않는다.
  const newAttempt = Boolean(params.newAttempt) && isOwner;

  // 교사가 풀이판을 "보려고" 열었을 뿐인데 학생의 풀이 기록이 생기면, 학생
  // 화면에 아직 손대지도 않은 문제가 "푸는 중"으로 보인다. 교사는 이미 있는
  // 판만 연다 — 없으면 빈 판을 돌려주고 아무것도 만들지 않는다.
  if (!isOwner) {
    const { data: existing } = await supabase
      .from("session_problem_work")
      .select(WORK_COLUMNS)
      .eq("session_id", params.sessionId)
      .eq("student_id", params.studentId)
      .eq("problem_id", params.problemId)
      .order("attempt_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!existing) return EMPTY_BOARD;
    const row = existing as unknown as WorkRow;
    return {
      ...boardMeta(row, isTeacher),
      ...(await loadBoardStrokes(supabase, row.id, row.submitted_stroke_seq ?? null)),
    };
  }

  const { data: workId, error } = await admin.rpc("start_problem_work", {
    p_session_id: params.sessionId,
    p_student_id: params.studentId,
    p_problem_id: params.problemId,
    p_new_attempt: newAttempt,
  });
  if (error) throw new Error(error.message);

  const { data: work } = await supabase
    .from("session_problem_work")
    .select(WORK_COLUMNS)
    .eq("id", workId as string)
    .maybeSingle();

  const row = (work as unknown as WorkRow | null) ?? null;
  const boundary = row?.submitted_stroke_seq ?? null;
  return {
    ...(row
      ? boardMeta(row, false)
      : { ...EMPTY_BOARD, workId: workId as string, attemptNo: 1 }),
    workId: workId as string,
    ...(await loadBoardStrokes(supabase, workId as string, boundary)),
  };
}

async function loadBoardStrokes(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workId: string,
  submittedStrokeSeq: string | null
): Promise<{
  studentStrokes: StrokePayload[];
  strokesAfterSubmit: StrokePayload[];
  feedbackStrokes: StrokePayload[];
}> {
  // RLS가 실질적인 게이트다 — 볼 자격이 없으면 빈 배열이 나온다.
  const { data } = await supabase
    .from("session_annotation_events")
    .select("payload, scope, seq")
    .eq("problem_work_id", workId)
    .eq("event_type", "stroke")
    .order("seq", { ascending: true });

  const studentStrokes: StrokePayload[] = [];
  const strokesAfterSubmit: StrokePayload[] = [];
  const feedbackStrokes: StrokePayload[] = [];
  const boundary = submittedStrokeSeq ? BigInt(submittedStrokeSeq) : null;

  for (const row of data ?? []) {
    if (row.scope === "problem_teacher_feedback") {
      feedbackStrokes.push(row.payload as StrokePayload);
      continue;
    }
    const isAfterSubmit = boundary !== null && BigInt(row.seq as string) > boundary;
    (isAfterSubmit ? strokesAfterSubmit : studentStrokes).push(row.payload as StrokePayload);
  }
  return { studentStrokes, strokesAfterSubmit, feedbackStrokes };
}

/** 이 수업에서 이 학생이 지금까지 푼 회차 목록(복습 화면에서 과거 풀이를 연다). */
export async function listProblemAttempts(params: {
  sessionId: string;
  studentId: string;
  problemId: string;
}): Promise<{ workId: string; attemptNo: number; submitted: boolean }[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("session_problem_work")
    .select("id, attempt_no, submitted_at")
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId)
    .eq("problem_id", params.problemId)
    .order("attempt_no", { ascending: true });
  return (data ?? []).map((w) => ({
    workId: w.id as string,
    attemptNo: w.attempt_no as number,
    submitted: Boolean(w.submitted_at),
  }));
}

export async function loadProblemWorkBoard(workId: string): Promise<ProblemWorkBoard | null> {
  const { user, supabase } = await requireUser();
  const { data: work } = await supabase
    .from("session_problem_work")
    .select(`${WORK_COLUMNS}, student_id`)
    .eq("id", workId)
    .maybeSingle();
  if (!work) return null;
  const row = work as unknown as WorkRow & { student_id: string };
  // 학생 본인이 아니면(교사·관리자 조회) 자동 채점 결과를 보여도 된다.
  return {
    ...boardMeta(row, row.student_id !== user.id),
    ...(await loadBoardStrokes(supabase, workId, row.submitted_stroke_seq ?? null)),
  };
}

/** 풀이판에 필기를 남긴다. 범위는 쓰는 사람이 누구냐로 갈린다. */
export async function appendProblemWorkStrokes(params: {
  sessionId: string;
  problemId: string;
  workId: string;
  segments: StrokePayload[];
  asFeedback: boolean;
}): Promise<void> {
  if (params.segments.length === 0) return;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("append_scoped_stroke_events", {
    p_session_id: params.sessionId,
    p_segments: params.segments,
    p_scope: params.asFeedback ? "problem_teacher_feedback" : "problem_student",
    p_curriculum_doc_id: null,
    p_problem_id: params.problemId,
    p_problem_work_id: params.workId,
  });
  if (error) throw new Error(error.message);
}

/**
 * 학생이 이 시도의 답안을 제출한다. 답안과 "제출 시점까지의 필기"가 함께
 * 고정되므로, 나중에 AI 채점을 붙여도 무엇을 보고 채점했는지 되짚을 수 있다.
 * 교사 피드백은 제출 뒤에도 계속 추가할 수 있다.
 */
export async function submitProblemWork(
  workId: string,
  answer?: { choiceIndex?: number | null; text?: string | null }
): Promise<void> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_problem_attempt", {
    p_work_id: workId,
    p_actor_id: user.id,
    p_choice_index: answer?.choiceIndex ?? null,
    p_text: answer?.text ?? null,
  });
  if (error) throw new Error(error.message);
}

// -------------------------------------------------------------------------
// 2026-09-14 UAT — 객관식은 클릭이 곧 답, 채점은 교사가
// -------------------------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * 객관식 답을 고른다(학생 본인). 풀이판을 열 필요 없이 선택 즉시 저장되고, 서버가 고정 버전의
 * 정답과 비교해 자동 채점한다. 채점 전이면 다른 선택지로 바꿀 수 있다. 결과(정답 여부)는
 * 돌려주지 않는다 — 교사가 채점을 끝내기 전엔 학생이 알 수 없어야 한다.
 */
export async function answerMcChoice(params: {
  sessionId: string;
  studentId: string;
  problemId: string;
  choiceIndex: number;
}): Promise<ActionResult> {
  const { user } = await requireUser();
  if (user.id !== params.studentId) return { ok: false, error: "본인 문제만 답할 수 있습니다." };
  if (!Number.isInteger(params.choiceIndex) || params.choiceIndex < 0) {
    return { ok: false, error: "선택지가 올바르지 않습니다." };
  }
  const admin = createAdminClient();
  // 이 수업의 학생인지 — 풀이판 열기와 같은 검사.
  const { data: session } = await admin
    .from("sessions")
    .select("subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(child_id)")
    .eq("id", params.sessionId)
    .maybeSingle();
  const enrollment = Array.isArray(session?.subject_enrollment)
    ? session?.subject_enrollment[0]
    : session?.subject_enrollment;
  if ((enrollment as { child_id?: string } | null)?.child_id !== params.studentId) {
    return { ok: false, error: "이 수업의 문제가 아닙니다." };
  }
  const { data: workId, error } = await admin.rpc("start_problem_work", {
    p_session_id: params.sessionId,
    p_student_id: params.studentId,
    p_problem_id: params.problemId,
    p_new_attempt: false,
  });
  if (error) return { ok: false, error: readable(error.message) };
  const { error: submitError } = await admin.rpc("submit_problem_attempt", {
    p_work_id: workId as string,
    p_actor_id: user.id,
    p_choice_index: params.choiceIndex,
    p_text: null,
  });
  if (submitError) return { ok: false, error: readable(submitError.message) };
  return { ok: true };
}

/** 교사 채점. grade 를 비우면 객관식 자동 채점 결과를 그대로 확정한다. */
export async function gradeProblemAttempt(params: {
  workId: string;
  grade: ProblemGrade | null;
  comment?: string | null;
}): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("grade_problem_attempt", {
    p_work_id: params.workId,
    p_grade: params.grade,
    p_comment: params.comment ?? null,
  });
  if (error) return { ok: false, error: readable(error.message) };
  return { ok: true };
}

/** 문제 목록을 지금 보는 사람 기준으로 다시 읽는다(채점 알림을 받은 학생 화면이 쓴다). */
export async function refreshSessionProblems(sessionId: string): Promise<SessionProblem[]> {
  const { user, supabase } = await requireUser();
  const admin = createAdminClient();
  const [{ data: session }, { data: profile }] = await Promise.all([
    admin
      .from("sessions")
      .select("subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(child_id)")
      .eq("id", sessionId)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  const enrollment = Array.isArray(session?.subject_enrollment)
    ? session?.subject_enrollment[0]
    : session?.subject_enrollment;
  const studentId = (enrollment as { child_id?: string } | null)?.child_id ?? null;
  const role = (profile?.role as string | undefined) ?? "";
  return loadSessionProblems(supabase, sessionId, {
    canSeeAnswers: role === "teacher" || role === "admin",
    studentId,
  });
}

function readable(message: string): string {
  // Postgres 예외 메시지는 이미 한국어 문장이다 — 앞의 코드 접두만 뗀다.
  return message.replace(/^[A-Z0-9]{5}:\s*/, "");
}
