import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const requireAdmin = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { getDifficultyReviewDetailAction, listDifficultyReviewAction, reviewDifficultyAction } from "./difficulty-review-actions";

beforeEach(() => {
  rpc.mockReset();
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ adminUserId: "admin-1" });
});

describe("difficulty-review-actions", () => {
  it("관리자가 아니면 RPC 를 부르지 않고 던진다", async () => {
    requireAdmin.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    await expect(listDifficultyReviewAction()).rejects.toThrow("관리자만");
    await expect(reviewDifficultyAction({ problemIds: ["a"], to: "easy", reason: "x" })).rejects.toThrow("관리자만");
    await expect(getDifficultyReviewDetailAction("a")).rejects.toThrow("관리자만");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("목록은 RPC 1회, 페이지 크기 상한 100·offset 계산", async () => {
    rpc.mockResolvedValue({ data: { summary: { provisional: 0, confirmed: 0, changed: 0 }, total: 0, rows: [] }, error: null });
    await listDifficultyReviewAction({ status: "confirmed", satDomain: "algebra", page: 3, pageSize: 500, q: " 검색 " });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("problem_difficulty_review_list", { p_status: "confirmed", p_domain: "algebra", p_skill: null, p_q: "검색", p_limit: 100, p_offset: 300 });
  });

  it("변경은 중복 제거·행위자 전달, 잘못된 난이도·빈 선택·과다 선택은 RPC 전에 거절, 한국어 오류만 노출", async () => {
    rpc.mockResolvedValue({ data: { confirmed: 0, changed: 2, skipped: 0, needsSetReplacement: ["a"] }, error: null });
    const r = await reviewDifficultyAction({ problemIds: ["a", "b", "a"], to: "medium", reason: " 사유 " });
    expect(r).toEqual({ ok: true, confirmed: 0, changed: 2, skipped: 0, needsSetReplacement: ["a"] });
    expect(rpc).toHaveBeenCalledWith("review_problem_difficulty", { p_problem_ids: ["a", "b"], p_to: "medium", p_actor_id: "admin-1", p_reason: "사유" });
    expect(await reviewDifficultyAction({ problemIds: [], to: "easy" })).toMatchObject({ ok: false });
    expect(await reviewDifficultyAction({ problemIds: ["a"], to: "impossible" as never })).toMatchObject({ ok: false });
    expect(await reviewDifficultyAction({ problemIds: Array.from({ length: 501 }, (_, i) => String(i)), to: "easy" })).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "P0001: 난이도를 바꿀 때는 사유 메모가 필요합니다." } });
    expect(await reviewDifficultyAction({ problemIds: ["a"], to: "easy" })).toEqual({ ok: false, error: "난이도를 바꿀 때는 사유 메모가 필요합니다." });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'relation "x" does not exist' } });
    expect(await reviewDifficultyAction({ problemIds: ["a"], to: "easy", reason: "x" })).toEqual({ ok: false, error: "난이도를 저장하지 못했습니다." });
  });
});
