"use server";

// 고정형 SAT 모의고사 V1 — 교사 배정 · 학생 응시(진행·저장·제출) · 교사 채점 확정 서버 액션.
// 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3절(역할별 흐름)·5절(상태)·7절(답안·채점).
// 권한은 RLS(20261415000000_p7_mock_exam_v1_foundation.sql, 20261416000000_..._assignment_and_answers_rls.sql)가
// 강제한다 — 여기서는 requireUser()의 RLS가 걸린 클라이언트만 쓰고, admin 클라이언트로 우회하지 않는다.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { autoGrade, type GradableFormat } from "./grading";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

function toErr(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^[A-Z0-9]{5}:\s*/, "") || fallback;
}

export type AssignMockExamInput = {
  studentId: string;
  examSetId: string;
  dueAt?: string | null;
  startBy?: string | null;
  maxAttempts?: number;
  sessionId?: string | null;
};

/** 교사 흐름 1단계: 담당 학생에게 공개된 시험 세트를 배정한다(사양 3절 교사 1~2).
 * 학생당 시험(세트 계열) 당 응시 기록은 하나 — 이미 배정(assigned) 상태면 조건만 갱신하고,
 * 이미 시작·제출된 응시는 건드리지 않는다(사양 5절 "시작된 응시는 규칙을 고정"). */
export async function assignMockExamAction(input: AssignMockExamInput): Promise<ActionResult<{ attemptId: string }>> {
  const { supabase } = await requireUser();

  const { data: setRow, error: setErr } = await supabase.from("mock_exam_sets").select("set_group_id").eq("id", input.examSetId).maybeSingle();
  if (setErr) return { ok: false, error: toErr(setErr, "시험 세트를 확인하지 못했습니다.") };
  if (!setRow) return { ok: false, error: "존재하지 않는 시험 세트입니다." };

  const { data: existing, error: existingErr } = await supabase
    .from("mock_exam_attempts")
    .select("id, status, exam_set_id")
    .eq("student_id", input.studentId)
    .eq("exam_set_group_id", setRow.set_group_id)
    .maybeSingle();
  if (existingErr) return { ok: false, error: toErr(existingErr, "배정 정보를 확인하지 못했습니다.") };

  if (existing) {
    if (existing.status !== "assigned") {
      return { ok: false, error: "이미 시작했거나 제출한 시험은 다시 배정할 수 없습니다." };
    }
    const { error } = await supabase
      .from("mock_exam_attempts")
      .update({
        exam_set_id: input.examSetId,
        due_at: input.dueAt ?? null,
        start_by: input.startBy ?? null,
        max_attempts: input.maxAttempts ?? 1,
        assigning_session_id: input.sessionId ?? null,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: toErr(error, "배정을 갱신하지 못했습니다.") };
    revalidatePath("/teacher");
    return { ok: true, value: { attemptId: existing.id } };
  }

  const { data: inserted, error } = await supabase
    .from("mock_exam_attempts")
    .insert({
      student_id: input.studentId,
      exam_set_id: input.examSetId,
      due_at: input.dueAt ?? null,
      start_by: input.startBy ?? null,
      max_attempts: input.maxAttempts ?? 1,
      assigning_session_id: input.sessionId ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: toErr(error, "배정하지 못했습니다. 담당 학생인지 확인하세요.") };
  revalidatePath("/teacher");
  return { ok: true, value: { attemptId: inserted.id } };
}

async function loadOwnAttemptItem(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  attemptId: string,
  setItemId: string,
  userId: string,
) {
  const { data: attempt, error: attemptErr } = await supabase
    .from("mock_exam_attempts")
    .select("id, student_id, status")
    .eq("id", attemptId)
    .maybeSingle();
  if (attemptErr) throw new Error(toErr(attemptErr, "응시 기록을 찾을 수 없습니다."));
  if (!attempt || attempt.student_id !== userId) throw new Error("본인 응시만 진행할 수 있습니다.");
  if (attempt.status === "submitted" || attempt.status === "graded") throw new Error("이미 제출한 시험은 답을 바꿀 수 없습니다.");

  const { data: item, error: itemErr } = await supabase
    .from("mock_exam_set_items")
    .select(
      `id, problem_id,
       problem_version:problem_versions!mock_exam_set_items_problem_version_id_fkey(correct_index, answers),
       problem:problems!mock_exam_set_items_problem_id_fkey(format)`,
    )
    .eq("id", setItemId)
    .maybeSingle();
  if (itemErr) throw new Error(toErr(itemErr, "문항을 찾을 수 없습니다."));
  if (!item) throw new Error("문항을 찾을 수 없습니다.");
  return { attempt, item };
}

/** 학생 흐름: 문항 하나에 답하고 저장한다(중단 후 재개 가능 — 언제든 다시 저장). 첫 저장에서
 * assigned → in_progress 로 전환한다(사양 5절 상태 전이). */
export async function saveMockExamAnswerAction(
  attemptId: string,
  setItemId: string,
  response: string,
  timeSpentSeconds?: number,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireUser();
    const { attempt, item } = await loadOwnAttemptItem(supabase, attemptId, setItemId, user.id);

    const version = Array.isArray(item.problem_version) ? item.problem_version[0] : item.problem_version;
    const problem = Array.isArray(item.problem) ? item.problem[0] : item.problem;
    const format = (problem?.format ?? "mc") as GradableFormat;
    const correct = autoGrade(format, response, version?.correct_index ?? null, version?.answers ?? null);

    const { error: upsertErr } = await supabase.from("mock_exam_answers").upsert(
      {
        attempt_id: attemptId,
        set_item_id: setItemId,
        response,
        correct,
        time_spent_seconds: timeSpentSeconds ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,set_item_id" },
    );
    if (upsertErr) return { ok: false, error: toErr(upsertErr, "답을 저장하지 못했습니다.") };

    if (attempt.status === "assigned") {
      const { error: startErr } = await supabase
        .from("mock_exam_attempts")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", attemptId);
      if (startErr) return { ok: false, error: toErr(startErr, "시험 시작을 기록하지 못했습니다.") };
    }
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: toErr(e, "답을 저장하지 못했습니다.") };
  }
}

/** 섹션별 남은 시간을 스냅샷으로 저장한다(중단 후 재개 — 사양 5절 time_remaining_seconds,
 * 사양 6절 "섹션별 시간 제한"). 클라이언트가 주기적으로/문항 저장 때 같이 호출한다. */
export async function saveMockExamSectionTimeAction(
  attemptId: string,
  section: "rw" | "math",
  remainingSeconds: number,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireUser();
    const { data: attempt, error } = await supabase
      .from("mock_exam_attempts")
      .select("id, student_id, time_remaining_seconds")
      .eq("id", attemptId)
      .maybeSingle();
    if (error) return { ok: false, error: toErr(error, "시간을 저장하지 못했습니다.") };
    if (!attempt || attempt.student_id !== user.id) return { ok: false, error: "본인 응시만 진행할 수 있습니다." };
    const next = { ...(attempt.time_remaining_seconds as Record<string, number> | null), [section]: Math.max(0, Math.floor(remainingSeconds)) };
    const { error: updateErr } = await supabase.from("mock_exam_attempts").update({ time_remaining_seconds: next }).eq("id", attemptId);
    if (updateErr) return { ok: false, error: toErr(updateErr, "시간을 저장하지 못했습니다.") };
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: toErr(e, "시간을 저장하지 못했습니다.") };
  }
}

/** 학생이 문항에 "표시"만 남긴다(정답 변경 없음) — 사양 3절 "문항 이동·표시". */
export async function toggleMockExamFlagAction(attemptId: string, setItemId: string, flagged: boolean): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireUser();
    const { attempt } = await loadOwnAttemptItem(supabase, attemptId, setItemId, user.id);
    void attempt;
    const { error } = await supabase.from("mock_exam_answers").upsert(
      { attempt_id: attemptId, set_item_id: setItemId, flagged, updated_at: new Date().toISOString() },
      { onConflict: "attempt_id,set_item_id" },
    );
    if (error) return { ok: false, error: toErr(error, "표시를 저장하지 못했습니다.") };
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: toErr(e, "표시를 저장하지 못했습니다.") };
  }
}

/** 학생 흐름 마지막: 시험을 제출한다. 이후 문항 이동은 안 되고, 결과는 교사 확정(채점 완료) 뒤에만 보인다. */
export async function submitMockExamAttemptAction(attemptId: string): Promise<ActionResult> {
  const { user, supabase } = await requireUser();
  const { data: attempt, error } = await supabase
    .from("mock_exam_attempts")
    .select("id, student_id, status")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) return { ok: false, error: toErr(error, "응시 기록을 찾을 수 없습니다.") };
  if (!attempt || attempt.student_id !== user.id) return { ok: false, error: "본인 응시만 제출할 수 있습니다." };
  if (attempt.status !== "in_progress" && attempt.status !== "assigned") {
    return { ok: false, error: "이미 제출한 시험입니다." };
  }
  const { error: updateErr } = await supabase
    .from("mock_exam_attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), attempt_count: 1 })
    .eq("id", attemptId);
  if (updateErr) return { ok: false, error: toErr(updateErr, "제출하지 못했습니다.") };
  revalidatePath("/student");
  revalidatePath("/teacher");
  return { ok: true, value: undefined };
}

/** 교사 흐름 마지막: 자동 채점 결과를 확정한다(사양 7절 "자동 채점 가능한 문항은 서버가 계산하고,
 * 교사가 확정하는 기존 정책을 따른다" — homework_batches 의 gradeHomeworkBatchAction 과 같은 역할).
 * 확정 전까지 학생·학부모에게 정답·해설·정오는 보이지 않는다. */
export async function finalizeMockExamGradingAction(attemptId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: attempt, error } = await supabase.from("mock_exam_attempts").select("id, status").eq("id", attemptId).maybeSingle();
  if (error) return { ok: false, error: toErr(error, "응시 기록을 찾을 수 없습니다.") };
  if (!attempt) return { ok: false, error: "담당 학생의 응시만 채점할 수 있습니다." };
  if (attempt.status !== "submitted") return { ok: false, error: "제출된 시험만 채점 확정할 수 있습니다." };
  const { error: updateErr } = await supabase
    .from("mock_exam_attempts")
    .update({ status: "graded", graded_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (updateErr) return { ok: false, error: toErr(updateErr, "채점 확정에 실패했습니다.") };
  revalidatePath("/teacher");
  revalidatePath("/student");
  revalidatePath("/parent");
  return { ok: true, value: undefined };
}
