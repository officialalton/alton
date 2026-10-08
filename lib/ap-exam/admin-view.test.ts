import { describe, expect, it } from "vitest";
import { filterApItems, purposeSummary, type ApItemRow } from "./admin-view";

const r = (k: string, o: Partial<ApItemRow> = {}): ApItemRow => ({ candidate_key: k, subject: "ap_biology", kind: "mc", review_state: "auto_passed", render_verified: true, screen_verified: true, review_env_ready: true, purpose: null, release_tier: "candidate", expert_status: "unreviewed", converted_at: null, ...o });
const rows = [r("a", { purpose: "mock_exam", release_tier: "review_env" }), r("b", { purpose: "lesson", release_tier: "review_env" }), r("c"), r("d", { purpose: "mock_exam", release_tier: "launch", subject: "ap_calculus_ab" }), r("e", { review_env_ready: false })];
describe("AP 관리자 목록 필터", () => {
  it("용도·단계·준비 상태 필터", () => {
    expect(filterApItems(rows, { purpose: "mock_exam" }).map((x) => x.candidate_key)).toEqual(["a", "d"]);
    expect(filterApItems(rows, { purpose: "lesson" }).map((x) => x.candidate_key)).toEqual(["b"]);
    expect(filterApItems(rows, { purpose: "none" }).map((x) => x.candidate_key)).toEqual(["c", "e"]);
    expect(filterApItems(rows, { tier: "launch" }).map((x) => x.candidate_key)).toEqual(["d"]);
    expect(filterApItems(rows, { ready: "no" }).map((x) => x.candidate_key)).toEqual(["e"]);
  });
  it("용도별 집계에는 변환된 문항만, 용도가 섞이지 않는다", () => {
    const s = purposeSummary(rows);
    expect(s.find((x) => x.purpose === "mock_exam" && x.subject === "ap_biology")?.total).toBe(1);
    expect(s.find((x) => x.purpose === "lesson")?.total).toBe(1);
    expect(s.reduce((a, x) => a + x.total, 0)).toBe(3);
  });
});
