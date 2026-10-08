import { describe, expect, it } from "vitest";
import { buildKeyInsights, formatPace } from "./insights";
import { computeMockExamReport } from "./report";
import type { MockExamAttemptItem } from "./attempt-data";

const item = (id: string, section: "rw" | "math", domain: string, correct: boolean, over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: id, section, position: 1, problemId: id, satDomain: domain, skillCode: null, difficulty: "", format: "mc", passage: null, question: "q",
  options: ["a", "b"], correctIndex: 0, answers: null, explanation: null, figure: null, response: "0", correct, flagged: false, savedToPractice: false,
  timeSpentSeconds: null, ...over,
});

describe("buildKeyInsights", () => {
  const items = [
    item("1", "rw", "rw_craft_structure", true), item("2", "rw", "rw_craft_structure", true),
    item("3", "math", "advanced_math", false), item("4", "math", "advanced_math", true, { guessed: true }),
    item("5", "math", "advanced_math", false, { response: null }),
  ];
  const report = computeMockExamReport(items);

  it("가장 강한 영역·집중할 영역·찍음·미응답 카드를 만든다", () => {
    const keys = buildKeyInsights(report, items).map((c) => c.key);
    expect(keys).toEqual(["strongest", "focus", "guessed", "unanswered"]);
  });

  it("이전 회차가 있으면 정답 수 차이를 보여준다", () => {
    const c = buildKeyInsights(report, items, { previous: { attemptNo: 1, correctCount: 1, totalCount: 5 }, correctCount: 3 }).find((x) => x.key === "progress");
    expect(c?.title).toBe("Compared with Attempt 1");
    expect(c?.body).toContain("+2");
    expect(c?.tone).toBe("good");
  });

  it("영역이 하나뿐이면 강약 비교 카드는 만들지 않는다", () => {
    const one = [item("1", "rw", "rw_craft_structure", true), item("2", "rw", "rw_craft_structure", false)];
    expect(buildKeyInsights(computeMockExamReport(one), one).map((c) => c.key)).not.toContain("strongest");
  });

  it("문항당 시간 형식", () => {
    expect(formatPace(45)).toBe("45s");
    expect(formatPace(80)).toBe("1m 20s");
    expect(formatPace(120)).toBe("2m");
  });
});
