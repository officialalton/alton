// POLICY-DECISIONS: 학습 이용 이벤트·하트비트 — 실패는 삼킨다
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/server", () => ({ createClient: async () => { throw new Error("boom"); } }));
import { logLearningEventAction, touchActivityAction } from "./activity-tracking";

describe("activity tracking swallows failures", () => {
  it("never rejects", async () => {
    await expect(touchActivityAction()).resolves.toBeUndefined();
    await expect(logLearningEventAction("mistake_review_opened")).resolves.toBeUndefined();
  });
});
