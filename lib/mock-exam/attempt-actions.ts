"use server";

// 고정형 SAT 모의고사 V1 — 교사 배정 · 학생 응시(진행·저장·제출) · 교사 채점 확정 서버 액션.
// 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3절(역할별 흐름)·5절(상태)·7절(답안·채점).
//
// 2026-09-21(P0 보안 차단) — 학생 쪽 쓰기(답 저장·표시·시간·제출)와 교사 채점 확정은 전부
// SECURITY DEFINER RPC(20261429000000_p0_lock_student_write_paths_mock_exam_homework.sql)로만
// 통과한다. 예전엔 학생에게 mock_exam_attempts UPDATE·mock_exam_answers ALL 정책이 열려 있어
// 학생이 REST API로 status='graded'·correct=true 를 직접 쓸 수 있었다. 정오(correct)는 RPC 안에서
// 서버가 계산하고, 클라이언트가 보낸 값은 받지 않는다. 여기서는 여전히 admin 클라이언트로 우회하지
// 않는다(요청자 세션 → RPC).

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { loadMockExamAttemptDetail, type MockExamAttemptDetail } from "./attempt-data";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

function toErr(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
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
 * 이미 시작·제출된 응시는 건드리지 않는다(사양 5절 "시작된 응시는 규칙을 고정").
 * 교사 배정 insert/update 는 기존 RLS(담당 교사만)가 그대로 강제한다. */
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

async function callRpc(fn: string, args: Record<string, unknown>, fallback: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, error: toErr(error, fallback) };
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: toErr(e, fallback) };
  }
}

/** 학생 흐름: 문항 하나에 답하고 저장한다(중단 후 재개 가능 — 언제든 다시 저장). 첫 저장에서
 * assigned → in_progress 로 전환한다(사양 5절 상태 전이). 정오 판정은 RPC 안에서 서버가 한다. */
export async function saveMockExamAnswerAction(
  attemptId: string,
  setItemId: string,
  response: string,
  timeSpentSeconds?: number,
): Promise<ActionResult> {
  return callRpc(
    "mock_exam_save_answer",
    { p_attempt_id: attemptId, p_set_item_id: setItemId, p_response: response, p_time_spent_seconds: timeSpentSeconds ?? null },
    "답을 저장하지 못했습니다.",
  );
}

/** 섹션별 남은 시간을 스냅샷으로 저장한다(중단 후 재개 — 사양 5절 time_remaining_seconds,
 * 사양 6절 "섹션별 시간 제한"). 클라이언트가 주기적으로/문항 저장 때 같이 호출한다. */
export async function saveMockExamSectionTimeAction(
  attemptId: string,
  section: "rw" | "math",
  remainingSeconds: number,
): Promise<ActionResult> {
  return callRpc(
    "mock_exam_save_section_time",
    { p_attempt_id: attemptId, p_section: section, p_remaining_seconds: Math.max(0, Math.floor(remainingSeconds)) },
    "시간을 저장하지 못했습니다.",
  );
}

/** 2026-09-22(사용자 지시) — 응시 화면에 들어올 때마다 기록한다(나갔다 다시 들어오는
 * 시간 어뷰징 의심 신호를 교사가 통계로 볼 수 있게). 채점·시험 진행에는 영향 없다. */
export async function recordMockExamEntryAction(attemptId: string): Promise<ActionResult> {
  return callRpc("mock_exam_record_entry", { p_attempt_id: attemptId }, "입장 기록에 실패했습니다.");
}

/** 학생이 문항에 "표시"만 남긴다(정답 변경 없음) — 사양 3절 "문항 이동·표시". */
export async function toggleMockExamFlagAction(attemptId: string, setItemId: string, flagged: boolean): Promise<ActionResult> {
  return callRpc("mock_exam_toggle_flag", { p_attempt_id: attemptId, p_set_item_id: setItemId, p_flagged: flagged }, "표시를 저장하지 못했습니다.");
}

/** 2026-09-21(사용자 지시) — 문항을 학생 포털 Practice 탭(문제 기록)에 저장/해제한다.
 * 단어장의 "내 단어장"처럼 원하는 문항만 골라 담는 구조 — 표시(flagged)와 달리 시험을
 * 벗어나도(제출·채점 뒤에도) 계속 남아 나중에 다시 볼 수 있다. */
export async function toggleMockExamSavedToPracticeAction(attemptId: string, setItemId: string, saved: boolean): Promise<ActionResult> {
  const r = await callRpc(
    "mock_exam_toggle_saved_to_practice",
    { p_attempt_id: attemptId, p_set_item_id: setItemId, p_saved: saved },
    "저장하지 못했습니다.",
  );
  if (r.ok) revalidatePath("/student");
  return r;
}

/** 학생 흐름 마지막: 시험을 제출한다. 자동 채점 문항(mc/spr)은 제출 즉시 채점 확정되어(2026-09-21
 * 제품 오너 지시로 교사 확인 단계 제거) 정답·해설이 바로 열린다 — 제출 직후 화면이 곧바로 결과
 * 화면으로 전환될 수 있게, 새로 채점된 상세를 같이 돌려준다(클라이언트가 갖고 있던 마스킹된 상태를
 * 그대로 쓰면 아무것도 안 바뀐 것처럼 보이는 문제가 있었다). */
export async function submitMockExamAttemptAction(attemptId: string): Promise<ActionResult<{ attempt: MockExamAttemptDetail | null }>> {
  const r = await callRpc("mock_exam_submit", { p_attempt_id: attemptId }, "제출하지 못했습니다.");
  if (!r.ok) return r;
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/parent");
  const { supabase } = await requireUser();
  const attempt = await loadMockExamAttemptDetail(supabase, attemptId);
  return { ok: true, value: { attempt } };
}

/** 교사 흐름 마지막: 자동 채점 결과를 확정한다(사양 7절 "자동 채점 가능한 문항은 서버가 계산하고,
 * 교사가 확정하는 기존 정책을 따른다" — homework_batches 의 gradeHomeworkBatchAction 과 같은 역할).
 * 확정 전까지 학생·학부모에게 정답·해설·정오는 보이지 않는다. */
export async function finalizeMockExamGradingAction(attemptId: string): Promise<ActionResult> {
  const r = await callRpc("mock_exam_finalize_grading", { p_attempt_id: attemptId }, "채점 확정에 실패했습니다.");
  if (r.ok) {
    revalidatePath("/teacher");
    revalidatePath("/student");
    revalidatePath("/parent");
  }
  return r;
}
