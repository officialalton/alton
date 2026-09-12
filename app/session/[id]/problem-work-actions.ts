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
  /** 학생이 남긴 원본 풀이. */
  studentStrokes: StrokePayload[];
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
    throw new Error("이 풀이판을 열 권한이 없습니다.");
  }
  // 재풀이는 학생 본인만 시작한다 — 교사가 학생의 풀이 회차를 늘리지 않는다.
  const newAttempt = Boolean(params.newAttempt) && isOwner;

  const { data: workId, error } = await admin.rpc("start_problem_work", {
    p_session_id: params.sessionId,
    p_student_id: params.studentId,
    p_problem_id: params.problemId,
    p_new_attempt: newAttempt,
  });
  if (error) throw new Error(error.message);

  const { data: work } = await supabase
    .from("session_problem_work")
    .select("id, attempt_no, submitted_at")
    .eq("id", workId as string)
    .maybeSingle();

  return {
    workId: workId as string,
    attemptNo: (work?.attempt_no as number) ?? 1,
    submitted: Boolean(work?.submitted_at),
    ...(await loadBoardStrokes(supabase, workId as string)),
  };
}

async function loadBoardStrokes(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workId: string
): Promise<{ studentStrokes: StrokePayload[]; feedbackStrokes: StrokePayload[] }> {
  // RLS가 실질적인 게이트다 — 볼 자격이 없으면 빈 배열이 나온다.
  const { data } = await supabase
    .from("session_annotation_events")
    .select("payload, scope")
    .eq("problem_work_id", workId)
    .eq("event_type", "stroke")
    .order("seq", { ascending: true });

  const studentStrokes: StrokePayload[] = [];
  const feedbackStrokes: StrokePayload[] = [];
  for (const row of data ?? []) {
    (row.scope === "problem_teacher_feedback" ? feedbackStrokes : studentStrokes).push(
      row.payload as StrokePayload
    );
  }
  return { studentStrokes, feedbackStrokes };
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
    .select("id, attempt_no, submitted_at")
    .eq("id", workId)
    .maybeSingle();
  if (!work) return null;
  return {
    workId: work.id as string,
    attemptNo: work.attempt_no as number,
    submitted: Boolean(work.submitted_at),
    ...(await loadBoardStrokes(supabase, workId)),
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

/** 학생이 이 회차 풀이를 제출한다 — 제출 뒤에야 정답·해설이 열린다. */
export async function submitProblemWork(workId: string): Promise<void> {
  const { user, supabase } = await requireUser();
  const { data: work } = await supabase
    .from("session_problem_work")
    .select("id, student_id, submitted_at")
    .eq("id", workId)
    .maybeSingle();
  if (!work) throw new Error("풀이판을 찾을 수 없습니다.");
  if (work.student_id !== user.id) throw new Error("본인 풀이만 제출할 수 있습니다.");
  if (work.submitted_at) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("session_problem_work")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", workId);
  if (error) throw new Error(error.message);
}
