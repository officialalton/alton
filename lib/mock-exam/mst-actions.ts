"use server";

// MST(4모듈) 응시 서버 액션 — 시작·상태 복구·모듈 제출. 전부 요청자 세션 → SECURITY DEFINER RPC.
// 만료·잠금·자동 제출은 RPC가 서버 시각으로 처리하므로 여기서는 결과를 그대로 돌려주기만 한다.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { MockExamAttemptItem } from "./attempt-data";
import type { MstModuleKey } from "./mst";

export type MstModuleState = {
  moduleKey: MstModuleKey;
  position: number;
  timeLimitSeconds: number;
  itemCount: number;
  startedAt: string | null;
  endsAt: string | null;
  locked: boolean;
  remainingSeconds: number | null;
};

export type MstItem = MockExamAttemptItem & { moduleKey: MstModuleKey; moduleSeq: number };

export type MstAttemptState = {
  attemptId: string;
  status: "assigned" | "in_progress" | "submitted" | "graded";
  currentModule: MstModuleKey | null;
  serverNow: string;
  modules: MstModuleState[];
  items: MstItem[];
};

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

function toErr(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return msg.replace(/^[A-Z0-9]{5}:\s*/, "") || fallback;
}

function normalize(data: unknown): MstAttemptState {
  const d = data as MstAttemptState & { modules: MstModuleState[] | null; items: MstItem[] | null };
  return { ...d, modules: Array.isArray(d.modules) ? d.modules : [], items: Array.isArray(d.items) ? d.items : [] };
}

export async function loadMstAttemptStateAction(attemptId: string): Promise<ActionResult<MstAttemptState>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("mock_exam_mst_state", { p_attempt_id: attemptId });
    if (error) return { ok: false, error: toErr(error, "응시 상태를 불러오지 못했습니다.") };
    return { ok: true, value: normalize(data) };
  } catch (e) {
    return { ok: false, error: toErr(e, "응시 상태를 불러오지 못했습니다.") };
  }
}

/** 시작 화면 "시험 시작": assigned → in_progress, 모듈 생성, R&W Module 1 타이머 시작. 멱등. */
export async function startMstAttemptAction(attemptId: string): Promise<ActionResult<MstAttemptState>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("mock_exam_start_mst", { p_attempt_id: attemptId });
    if (error) return { ok: false, error: toErr(error, "시험을 시작하지 못했습니다.") };
    revalidatePath("/student");
    return loadMstAttemptStateAction(attemptId);
  } catch (e) {
    return { ok: false, error: toErr(e, "시험을 시작하지 못했습니다.") };
  }
}

/** 현재 모듈 제출(시간 종료 자동 제출·휴식 조기 종료 포함). expectedModule이 현재 모듈이 아니면
 * 서버가 no-op으로 처리하므로 중복 호출이 안전하다. 최신 상태를 함께 돌려준다. */
export async function submitMstModuleAction(attemptId: string, expectedModule: MstModuleKey): Promise<ActionResult<MstAttemptState>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("mock_exam_submit_module", { p_attempt_id: attemptId, p_expected_module: expectedModule });
    if (error) return { ok: false, error: toErr(error, "모듈을 제출하지 못했습니다.") };
    revalidatePath("/student");
    revalidatePath("/teacher");
    revalidatePath("/parent");
    return loadMstAttemptStateAction(attemptId);
  } catch (e) {
    return { ok: false, error: toErr(e, "모듈을 제출하지 못했습니다.") };
  }
}
