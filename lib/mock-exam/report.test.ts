import { describe, expect, it } from "vitest";
import { computeMockExamReport } from "./report";
import type { MockExamAttemptItem } from "./attempt-data";

function item(overrides: Partial<MockExamAttemptItem>): MockExamAttemptItem {
  return {
    setItemId: "i1",
    section: "rw",
    position: 1,
    problemId: "p1",
    satDomain: "rw_craft_structure",
    skillCode: "skill_a",
    difficulty: "medium",
    format: "mc",
    passage: null,
    question: null,
    options: null,
    correctIndex: null,
    answers: null,
    explanation: null,
    figure: null,
    response: "0",
    correct: null,
    flagged: false,
    savedToPractice: false,
    timeSpentSeconds: null,
    ...overrides,
  };
}

describe("computeMockExamReport", () => {
  it("채점 확정 전(correct 가 전부 null)이면 정답률은 null이다", () => {
    const report = computeMockExamReport([item({}), item({ setItemId: "i2" })]);
    expect(report.correctCount).toBeNull();
    expect(report.bySection.find((s) => s.section === "rw")?.correct).toBeNull();
  });

  it("섹션·영역·세부기술별로 정답 수를 집계한다", () => {
    const items = [
      item({ setItemId: "i1", section: "rw", satDomain: "rw_craft_structure", skillCode: "skill_a", correct: true, timeSpentSeconds: 30 }),
      item({ setItemId: "i2", section: "rw", satDomain: "rw_craft_structure", skillCode: "skill_a", correct: false, timeSpentSeconds: 40 }),
      item({ setItemId: "i3", section: "math", satDomain: "algebra", skillCode: "skill_b", correct: true, timeSpentSeconds: 50 }),
    ];
    const report = computeMockExamReport(items);
    expect(report.correctCount).toBe(2);
    expect(report.totalCount).toBe(3);
    expect(report.totalTimeSpentSeconds).toBe(120);
    expect(report.bySection).toEqual([
      { section: "rw", total: 2, correct: 1, timeSpentSeconds: 70 },
      { section: "math", total: 1, correct: 1, timeSpentSeconds: 50 },
    ]);
    expect(report.byDomain.find((d) => d.key === "rw_craft_structure")).toEqual({ key: "rw_craft_structure", label: "rw_craft_structure", total: 2, correct: 1 });
    expect(report.bySkill.find((s) => s.key === "skill_a")).toEqual({ key: "skill_a", label: "skill_a", total: 2, correct: 1 });
    expect(report.missedItems).toEqual([{ setItemId: "i2", section: "rw", position: 1, satDomain: "rw_craft_structure", skillCode: "skill_a" }]);
  });

  it("응답 수(answeredCount)는 response 가 있는 문항만 센다", () => {
    const items = [item({ setItemId: "i1", response: "1" }), item({ setItemId: "i2", response: null })];
    expect(computeMockExamReport(items).answeredCount).toBe(1);
  });
});
