import { describe, expect, it } from "vitest";
import { INSUFFICIENT_RESPONSES_TEXT, MIN_RESPONSE_RATIO, estimateScoreWithPolicy, hasEnoughResponses } from "./score-estimate";
import { estimateAttempt, type AttemptFacts } from "./score-aggregate";
import { computeMockExamReport } from "./report";
import type { MockExamAttemptItem } from "./attempt-data";

// 예상 점수 범위 정책(초기 운영 임계값 80%): 각 섹션에서 출제 문항의 80% 이상에 유효 응답(null·공백 제외, 정답 여부 무관). 정확도 보장이 아님 — 응답이 너무 적은 응시에서 추정이 나가는 것을 막는 기준.
const routes = { rw: "lower", math: "lower" } as const;
describe("응답 비율 임계값(80%)", () => {
  it("상수와 문구", () => { expect(MIN_RESPONSE_RATIO).toBe(0.8); expect(INSUFFICIENT_RESPONSES_TEXT).toBe("Not enough responses to estimate a score range."); });
  it("R&W 54문항: 40개(74%)는 부족, 44개(81.5%)는 충분, 43.2 경계: 43개(79.6%)는 부족·44개 충분", () => {
    expect(hasEnoughResponses(40, 54)).toBe(false);
    expect(hasEnoughResponses(43, 54)).toBe(false);
    expect(hasEnoughResponses(44, 54)).toBe(true);
    expect(hasEnoughResponses(54, 54)).toBe(true);
    expect(hasEnoughResponses(4, 5)).toBe(true); // 정확히 80%
    expect(hasEnoughResponses(null, 54)).toBe(false); expect(hasEnoughResponses(undefined, 54)).toBe(false); expect(hasEnoughResponses(5, 0)).toBe(false);
  });
  it("두 섹션 모두 충족해야 범위가 나온다(한 섹션만 부족하면 없음, 응답 부족 사유)", () => {
    const ok = estimateScoreWithPolicy([{ section: "rw", total: 54, correct: 10, answered: 44 }, { section: "math", total: 44, correct: 9, answered: 36 }], routes);
    expect(ok.estimate).not.toBeNull(); expect(ok.reason).toBeNull();
    const rwLow = estimateScoreWithPolicy([{ section: "rw", total: 54, correct: 10, answered: 40 }, { section: "math", total: 44, correct: 9, answered: 44 }], routes);
    expect(rwLow).toEqual({ estimate: null, reason: "insufficient_responses" });
    const mathLow = estimateScoreWithPolicy([{ section: "rw", total: 54, correct: 10, answered: 54 }, { section: "math", total: 44, correct: 9, answered: 35 }], routes);
    expect(mathLow.reason).toBe("insufficient_responses");
  });
  it("정답 수가 아니라 응답 수를 센다: 전부 틀려도 응답이 충분하면 범위가 나오고, 전부 맞아도 응답이 적으면 안 나온다", () => {
    expect(estimateScoreWithPolicy([{ section: "rw", total: 10, correct: 0, answered: 10 }, { section: "math", total: 10, correct: 0, answered: 10 }], routes).estimate).not.toBeNull();
    expect(estimateScoreWithPolicy([{ section: "rw", total: 10, correct: 7, answered: 7 }, { section: "math", total: 10, correct: 10, answered: 10 }], routes).reason).toBe("insufficient_responses");
  });
  it("한 섹션에 채점된 문항이 하나도 없으면(응답 0) 응답 부족, 경로가 없으면 incomplete", () => {
    expect(estimateScoreWithPolicy([{ section: "rw", total: 4, correct: 2, answered: 4 }, { section: "math", total: 2, correct: null, answered: 0 }], routes).reason).toBe("insufficient_responses");
    expect(estimateScoreWithPolicy([{ section: "rw", total: 4, correct: 2, answered: 4 }, { section: "math", total: 2, correct: 1, answered: 2 }], { rw: "lower", math: null }).reason).toBe("incomplete");
  });
  it("보고서 집계: 공백 응답은 응답으로 세지 않는다(섹션별 answered)", () => {
    const it = (section: "rw" | "math", n: number, response: string | null): MockExamAttemptItem => ({ setItemId: `${section}${n}`, section, position: n, problemId: "p", satDomain: "x", skillCode: null, difficulty: null, format: "mc", passage: null, question: "q", options: [], correctIndex: null, answers: null, explanation: null, figure: null, response, correct: response ? true : null, flagged: false, savedToPractice: false, timeSpentSeconds: null } as unknown as MockExamAttemptItem);
    const r = computeMockExamReport([it("rw", 1, "0"), it("rw", 2, "  "), it("rw", 3, null), it("rw", 4, ""), it("math", 1, "1")]);
    expect(r.bySection.map((s) => [s.section, s.answered, s.total])).toEqual([["rw", 1, 4], ["math", 1, 1]]);
  });
});

describe("집계 경로(통계 추이·관리자 점수): 같은 기준", () => {
  const facts = (rwAns: number | undefined, mathAns: number | undefined, over: Partial<AttemptFacts> = {}): AttemptFacts => ({
    attemptId: "a", examName: "e", track: "sat", apSubject: null, format: "mst", status: "graded", startedAt: null, gradedAt: "2026-10-09T00:00:00Z", attemptSeq: 1,
    sections: { rw: { total: 54, correct: 20, complete: true, route: "lower", answered: rwAns }, math: { total: 44, correct: 15, complete: true, route: "lower", answered: mathAns } }, ...over,
  });
  it("충분하면 범위, 부족하면 insufficient_responses, 모르면(undefined) 범위 없음", () => {
    expect(estimateAttempt(facts(44, 36)).total).not.toBeNull();
    expect(estimateAttempt(facts(40, 44))).toMatchObject({ total: null, reason: "insufficient_responses" });
    expect(estimateAttempt(facts(undefined, undefined))).toMatchObject({ total: null, reason: "insufficient_responses" });
  });
  it("고정형·AP·미채점은 이 정책의 영향을 받지 않는다(기존 사유 그대로)", () => {
    expect(estimateAttempt(facts(54, 44, { format: "fixed" })).reason).toBe("no_estimate_fixed");
    expect(estimateAttempt(facts(54, 44, { track: "ap", apSubject: "ap_calculus_ab" })).reason).toBe("no_estimate_ap");
    expect(estimateAttempt(facts(54, 44, { status: "in_progress" })).reason).toBe("not_graded");
  });
});
