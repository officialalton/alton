import { describe, expect, it } from "vitest";
import { topWeaknesses, type MockExamWeaknessSummary } from "./weakness";

const row = (key: string, section: "rw" | "math", correct: number, total: number) => ({ key, label: key, section, correct, total });

describe("topWeaknesses", () => {
  it("세부기술(2문항 이상·60% 미만)을 낮은 순으로, 모자라면 영역으로 보충해 최대 N개", () => {
    const summary: MockExamWeaknessSummary = {
      attemptCount: 2,
      gradedAttemptCount: 2,
      bySkill: [row("CS-WIC", "rw", 0, 2), row("ALG-LIN", "math", 3, 4), row("ONE", "rw", 0, 1)],
      byDomain: [row("rw_craft_structure", "rw", 1, 3), row("algebra", "math", 3, 4)],
    };
    expect(topWeaknesses(summary, 3).map((r) => r.key)).toEqual(["CS-WIC", "rw_craft_structure"]);
    expect(topWeaknesses(summary, 1).map((r) => r.key)).toEqual(["CS-WIC"]);
  });
  it("채점 응시가 없으면 빈 배열", () => {
    expect(topWeaknesses({ attemptCount: 0, gradedAttemptCount: 0, bySkill: [], byDomain: [] })).toEqual([]);
  });
});
