"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { StrokePayload } from "./annotation-events-types";

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
      .select("id, attempt_no, submitted_at, submitted_choice_index, submitted_text, submitted_stroke_seq")
      .eq("session_id", params.sessionId)
      .eq("student_id", params.studentId)
      .eq("problem_id", params.problemId)
      .order("attempt_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!existing) {
      return {
        workId: "",
        attemptNo: 0,
        submitted: false,
        submittedChoiceIndex: null,
        submittedText: null,
        submittedStrokeSeq: null,
        studentStrokes: [],
        strokesAfterSubmit: [],
        feedbackStrokes: [],
      };
    }
    return {
      workId: existing.id as string,
      attemptNo: existing.attempt_no as number,
      submitted: Boolean(existing.submitted_at),
      submittedChoiceIndex: (existing.submitted_choice_index as number | null) ?? null,
      submittedText: (existing.submitted_text as string | null) ?? null,
      submittedStrokeSeq: (existing.submitted_stroke_seq as string | null) ?? null,
      ...(await loadBoardStrokes(
        supabase,
        existing.id as string,
        (existing.submitted_stroke_seq as string | null) ?? null
      )),
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
    .select("id, attempt_no, submitted_at, submitted_choice_index, submitted_text, submitted_stroke_seq")
    .eq("id", workId as string)
    .maybeSingle();

  const boundary = (work?.submitted_stroke_seq as string | null) ?? null;
  return {
    workId: workId as string,
    attemptNo: (work?.attempt_no as number) ?? 1,
    submitted: Boolean(work?.submitted_at),
    submittedChoiceIndex: (work?.submitted_choice_index as number | null) ?? null,
    submittedText: (work?.submitted_text as string | null) ?? null,
    submittedStrokeSeq: boundary,
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
  const { supabase } = await requireUser();
  const { data: work } = await supabase
    .from("session_problem_work")
    .select("id, attempt_no, submitted_at, submitted_choice_index, submitted_text, submitted_stroke_seq")
    .eq("id", workId)
    .maybeSingle();
  if (!work) return null;
  const boundary = (work.submitted_stroke_seq as string | null) ?? null;
  return {
    workId: work.id as string,
    attemptNo: work.attempt_no as number,
    submitted: Boolean(work.submitted_at),
    submittedChoiceIndex: (work.submitted_choice_index as number | null) ?? null,
    submittedText: (work.submitted_text as string | null) ?? null,
    submittedStrokeSeq: boundary,
    ...(await loadBoardStrokes(supabase, workId, boundary)),
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
