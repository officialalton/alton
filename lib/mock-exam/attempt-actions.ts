"use server";

// 고정형 SAT 모의고사 V1 — 학생 시작(공개 세트, 배정 없음) · 응시(진행·저장·제출) · 교사 채점 확정 서버 액션.
// 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3절(역할별 흐름)·5절(상태)·7절(답안·채점).
//
// 2026-09-21(P0 보안 차단) — 학생 쪽 쓰기(답 저장·표시·시간·제출)와 교사 채점 확정은 전부
// SECURITY DEFINER RPC(20261429000000_p0_lock_student_write_paths_mock_exam_homework.sql)로만
// 통과한다. 예전엔 학생에게 mock_exam_attempts UPDATE·mock_exam_answers ALL 정책이 열려 있어
// 학생이 REST API로 status='graded'·correct=true 를 직접 쓸 수 있었다. 정오(correct)는 RPC 안에서
// 서버가 계산하고, 클라이언트가 보낸 값은 받지 않는다. 여기서는 여전히 admin 클라이언트로 우회하지
// 않는다(요청자 세션 → RPC).

import { revalidatePath } from "next/cache";
import { requireStudentFeature } from "@/lib/feature-access";
import { loadMockExamAttemptDetail, type MockExamAttemptDetail } from "./attempt-data";
import { parseAnnotations, type MockExamAnnotations } from "./annotation-anchor";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

function toErr(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return msg.replace(/^[A-Z0-9]{5}:\s*/, "") || fallback;
}

/** 학생이 공개된 시험을 '시작'한다 — 응시(attempt)가 이때 생성된다(배정 없음, 2026-10-01).
 * 서버 정의자 RPC 가 활성 학생 본인·공개·구성 완료 세트만 허용하고, 같은 시험은 응시 하나(멱등 —
 * 이미 있으면 그 응시를 돌려준다). 학생이 attempt 를 직접 INSERT 할 RLS 는 없다. */
export async function startMockExamAction(examSetId: string): Promise<ActionResult<{ attemptId: string }>> {
  try {
    const { supabase } = await requireStudentFeature("mock_exam");
    const { data, error } = await supabase.rpc("mock_exam_open_start", { p_exam_set_id: examSetId });
    if (error) return { ok: false, error: toErr(error, "Could not start the exam.") };
    revalidatePath("/student");
    return { ok: true, value: { attemptId: data as string } };
  } catch (e) {
    return { ok: false, error: toErr(e, "Could not start the exam.") };
  }
}

async function callRpc(fn: string, args: Record<string, unknown>, fallback: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireStudentFeature("mock_exam");
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
    "Could not save your answer.",
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
    "Could not save the time.",
  );
}

/** 2026-09-22(사용자 지시) — 응시 화면에 들어올 때마다 기록한다(나갔다 다시 들어오는
 * 시간 어뷰징 의심 신호를 교사가 통계로 볼 수 있게). 채점·시험 진행에는 영향 없다. */
export async function recordMockExamEntryAction(attemptId: string): Promise<ActionResult> {
  return callRpc("mock_exam_record_entry", { p_attempt_id: attemptId }, "Could not record entry.");
}

/** 학생이 문항에 "표시"만 남긴다(정답 변경 없음) — 사양 3절 "문항 이동·표시". */
export async function toggleMockExamFlagAction(attemptId: string, setItemId: string, flagged: boolean): Promise<ActionResult> {
  return callRpc("mock_exam_toggle_flag", { p_attempt_id: attemptId, p_set_item_id: setItemId, p_flagged: flagged }, "Could not save the mark.");
}

/** 2026-10-02(오너 UAT A8) — 학생이 답을 모르고 찍었을 때 스스로 남기는 "찍음" 표시(토글).
 * mock_exam_toggle_flag 와 같은 가드(제출·잠긴 모듈 후 변경 불가). 결과 화면에 🎲 로 보인다. */
export async function toggleMockExamGuessedAction(attemptId: string, setItemId: string, guessed: boolean): Promise<ActionResult> {
  return callRpc("mock_exam_toggle_guessed", { p_attempt_id: attemptId, p_set_item_id: setItemId, p_guessed: guessed }, "Could not save the guess mark.");
}

/** 2026-09-21(사용자 지시) — 문항을 학생 포털 Practice 탭(문제 기록)에 저장/해제한다.
 * 단어장의 "내 단어장"처럼 원하는 문항만 골라 담는 구조 — 표시(flagged)와 달리 시험을
 * 벗어나도(제출·채점 뒤에도) 계속 남아 나중에 다시 볼 수 있다. */
export async function toggleMockExamSavedToPracticeAction(attemptId: string, setItemId: string, saved: boolean): Promise<ActionResult> {
  const r = await callRpc(
    "mock_exam_toggle_saved_to_practice",
    { p_attempt_id: attemptId, p_set_item_id: setItemId, p_saved: saved },
    "Could not save.",
  );
  if (r.ok) revalidatePath("/student");
  return r;
}

/** 학생 흐름 마지막: 시험을 제출한다. 자동 채점 문항(mc/spr)은 제출 즉시 채점 확정되어(2026-09-21
 * 제품 오너 지시로 교사 확인 단계 제거) 정답·해설이 바로 열린다 — 제출 직후 화면이 곧바로 결과
 * 화면으로 전환될 수 있게, 새로 채점된 상세를 같이 돌려준다(클라이언트가 갖고 있던 마스킹된 상태를
 * 그대로 쓰면 아무것도 안 바뀐 것처럼 보이는 문제가 있었다). */
export async function submitMockExamAttemptAction(attemptId: string): Promise<ActionResult<{ attempt: MockExamAttemptDetail | null }>> {
  const r = await callRpc("mock_exam_submit", { p_attempt_id: attemptId }, "Could not submit.");
  if (!r.ok) return r;
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/parent");
  const { supabase } = await requireStudentFeature("mock_exam");
  const attempt = await loadMockExamAttemptDetail(supabase, attemptId);
  return { ok: true, value: { attempt } };
}

/** AP: 섹션 시계 시작/재동기화 — 서버가 정한 남은 시간(초)을 섹션별로 돌려준다(서버 기준 시계, 마이그레이션 406). */
export async function enterApSectionAction(attemptId: string, section: string): Promise<ActionResult<{ remaining: Record<string, number> }>> {
  try {
    const { supabase } = await requireStudentFeature("mock_exam");
    const { data, error } = await supabase.rpc("mock_exam_ap_enter_section", { p_attempt_id: attemptId, p_section: section });
    if (error) return { ok: false, error: toErr(error, "Could not start the section timer.") };
    return { ok: true, value: { remaining: (data ?? {}) as Record<string, number> } };
  } catch (e) {
    return { ok: false, error: toErr(e, "Could not start the section timer.") };
  }
}

/** AP: 마지막 섹션이 서버 시계로 만료됐으면 마감(채점 완료)한다. 멱등 — 반환은 응시 상태. */
export async function settleApAttemptAction(attemptId: string): Promise<ActionResult<{ status: string; attempt: MockExamAttemptDetail | null }>> {
  try {
    const { supabase } = await requireStudentFeature("mock_exam");
    const { data, error } = await supabase.rpc("mock_exam_ap_settle", { p_attempt_id: attemptId });
    if (error) return { ok: false, error: toErr(error, "Could not check the exam time.") };
    const status = String(data ?? "");
    if (status === "graded") { revalidatePath("/student"); revalidatePath("/teacher"); revalidatePath("/parent"); }
    const attempt = status === "graded" ? await loadMockExamAttemptDetail(supabase, attemptId) : null;
    return { ok: true, value: { status, attempt } };
  } catch (e) {
    return { ok: false, error: toErr(e, "Could not check the exam time.") };
  }
}

/** 교사 흐름 마지막: 자동 채점 결과를 확정한다(사양 7절 "자동 채점 가능한 문항은 서버가 계산하고,
 * 교사가 확정하는 기존 정책을 따른다" — homework_batches 의 gradeHomeworkBatchAction 과 같은 역할).
 * 확정 전까지 학생·학부모에게 정답·해설·정오는 보이지 않는다. */
export async function finalizeMockExamGradingAction(attemptId: string): Promise<ActionResult> {
  const r = await callRpc("mock_exam_finalize_grading", { p_attempt_id: attemptId }, "Could not finalize grading.");
  if (r.ok) {
    revalidatePath("/teacher");
    revalidatePath("/student");
    revalidatePath("/parent");
  }
  return r;
}

/** 2026-10-02(오너 요청) — 응시 중 하이라이트·한 줄 메모·답 소거 저장(문항당 전체 상태 덮어쓰기). 가드는 toggle_guessed 와 같다. */
export async function saveMockExamAnnotationsAction(attemptId: string, setItemId: string, state: MockExamAnnotations): Promise<ActionResult> {
  return callRpc(
    "save_mock_exam_annotations",
    { p_attempt_id: attemptId, p_set_item_id: setItemId, p_highlights: state.highlights, p_eliminated: state.eliminated },
    "Could not save your highlights.",
  );
}

/** 본인(응시 중·결과)·담당 교사·관리자·보호자 읽기. 읽기 전용 열람 용도로도 쓴다. */
export async function loadMockExamAnnotationsAction(attemptId: string, setItemId: string): Promise<MockExamAnnotations> {
  try {
    const { supabase } = await requireStudentFeature("mock_exam");
    const { data, error } = await supabase.rpc("load_mock_exam_annotations", { p_attempt_id: attemptId, p_set_item_id: setItemId });
    if (error) return { highlights: [], eliminated: [] };
    return parseAnnotations(data);
  } catch {
    return { highlights: [], eliminated: [] };
  }
}
