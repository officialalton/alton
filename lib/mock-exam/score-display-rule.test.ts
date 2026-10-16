import { describe, expect, it } from "vitest";
import { SCORE_VALIDATION_STATUS, estimateScore, type ScoreRoute } from "./score-estimate";
import { computeMockExamReport } from "./report";
import type { MockExamAttemptItem } from "./attempt-data";

// 예상 점수 범위 "표시 규칙" 문서화 테스트(표시만 — 모델 정확도는 미검증: SCORE_VALIDATION_STATUS).
// 표시 조건(전부 충족): ① MST 응시 ② 채점 완료 ③ 두 섹션 모두 "채점된 문항(correct !== null = 응답이 있는 문항)"이 1개 이상 ④ 두 섹션의 Module 2 경로 확정.
// 응답 총수 하한은 없다. 미응답 문항은 correct=null 이므로 한 섹션에 응답이 하나도 없으면 그 섹션 점수가 없어 범위가 나오지 않는다.
const item = (section: "rw" | "math", n: number, correct: boolean | null, response: string | null): MockExamAttemptItem => ({
  setItemId: `${section}${n}`, section, position: n, problemId: `p${section}${n}`, satDomain: "x", skillCode: null, difficulty: null, format: "mc", passage: null, question: "q", options: ["a", "b"], correctIndex: null,
  answers: null, explanation: null, figure: null, response, correct, flagged: false, savedToPractice: false, timeSpentSeconds: null,
} as unknown as MockExamAttemptItem);
const show = (items: MockExamAttemptItem[], routes: { rw: ScoreRoute | null; math: ScoreRoute | null }) => estimateScore(computeMockExamReport(items).bySection, routes);

describe(`예상 점수 범위 표시 규칙 [${SCORE_VALIDATION_STATUS}]`, () => {
  it("상태 표기", () => { expect(SCORE_VALIDATION_STATUS).toBe("display verified, accuracy NOT verified"); });
  it("두 섹션 모두 응답이 있고 경로가 있으면 표시(응답 수가 적어도)", () => {
    const r = show([item("rw", 1, true, "0"), item("rw", 2, null, null), item("math", 1, false, "1"), item("math", 2, null, null)], { rw: "lower", math: "lower" });
    expect(r).not.toBeNull();
    expect(r!.total.low).toBeGreaterThanOrEqual(400);
  });
  it("한 섹션에 응답이 하나도 없으면(전부 correct=null) 표시하지 않는다", () => {
    expect(show([item("rw", 1, true, "0"), item("rw", 2, false, "1"), item("math", 1, null, null), item("math", 2, null, null)], { rw: "lower", math: "lower" })).toBeNull();
  });
  it("경로가 하나라도 없으면 표시하지 않는다", () => {
    const items = [item("rw", 1, true, "0"), item("math", 1, true, "0")];
    expect(show(items, { rw: "lower", math: null })).toBeNull();
    expect(show(items, { rw: null, math: "higher" })).toBeNull();
  });
  it("모델 값 샘플(98문항 = R&W 54 + Math 44, lower 경로) — 14문항 정답 분포별 범위(표시 확인용, 정확도 아님)", () => {
    const f = (rwc: number, mc: number) => estimateScore([{ section: "rw", total: 54, correct: rwc }, { section: "math", total: 44, correct: mc }], { rw: "lower", math: "lower" });
    expect(f(7, 7)!.total).toEqual({ low: 450, high: 570 });
    expect(f(5, 9)).toMatchObject({ rw: { low: 210, high: 270 }, math: { low: 250, high: 310 } });
    expect(f(0, 0)!.total).toEqual({ low: 400, high: 460 }); // 하한은 항상 400 이상
  });
});
