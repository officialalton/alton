import { beforeEach, describe, expect, it, vi } from "vitest";

// 모듈 타이머는 서버가 RPC 시각(now())으로 찍는다. 그 뒤 로그인 확인·캐시 갱신 같은 서버 작업이 끼면
// 그만큼이 학생 시간에서 빠진다(2026-10-02 UAT: 시작 직후 31:57). 그래서 RPC 직후 같은 클라이언트로
// 상태를 바로 조회하고, 캐시 갱신은 그 뒤에 한다 — 호출 순서를 고정하는 테스트.
const calls: string[] = [];
const rpc = vi.fn(async (name: string) => {
  calls.push(`rpc:${name}`);
  return { data: name === "mock_exam_mst_state" ? { attemptId: "a1", status: "in_progress", modules: [], items: [] } : null, error: null };
});
const requireUser = vi.fn(async () => {
  calls.push("requireUser");
  return { supabase: { rpc } };
});

vi.mock("@/lib/auth", () => ({ requireUser: () => requireUser() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => { calls.push(`revalidate:${p}`); } }));

import { startMstAttemptAction, submitMstModuleAction } from "./mst-actions";

beforeEach(() => {
  calls.length = 0;
  rpc.mockClear();
  requireUser.mockClear();
});

describe("MST 타이머 시작 지연 최소화", () => {
  it("시험 시작: 로그인 확인은 한 번, RPC 직후 상태 조회, 캐시 갱신은 그 뒤", async () => {
    const r = await startMstAttemptAction("a1");
    expect(r.ok).toBe(true);
    expect(calls).toEqual(["requireUser", "rpc:mock_exam_start_mst", "rpc:mock_exam_mst_state", "revalidate:/student"]);
    expect(requireUser).toHaveBeenCalledTimes(1);
  });

  it("모듈 제출(다음 모듈 타이머 시작): 같은 순서를 지킨다", async () => {
    const r = await submitMstModuleAction("a1", "rw_m1");
    expect(r.ok).toBe(true);
    expect(calls.slice(0, 3)).toEqual(["requireUser", "rpc:mock_exam_submit_module", "rpc:mock_exam_mst_state"]);
    expect(calls.slice(3).sort()).toEqual(["revalidate:/parent", "revalidate:/student", "revalidate:/teacher"]);
    expect(requireUser).toHaveBeenCalledTimes(1);
  });
});
