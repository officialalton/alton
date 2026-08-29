import { describe, expect, it } from "vitest";
import { redactProblem } from "./redact";
import type { LibraryProblem } from "@/app/student/materials-data";

const baseProblem: LibraryProblem = {
  id: "p1",
  format: "mc",
  passage: "판별식이 0이면?",
  options: ["서로 다른 두 실근", "중근"],
  correctIndex: 1,
  explanation: "D=0이면 중근을 가집니다.",
  difficulty: "easy",
  skillType: "개념 문제",
  priorWrongCount: 0,
  correct: null,
  done: false,
  submittedResponse: null,
};

describe("redactProblem", () => {
  it("답을 볼 수 없는 뷰어에게는 correctIndex와 explanation을 제거한다", () => {
    const result = redactProblem(baseProblem, false);
    expect(result.correctIndex).toBeNull();
    expect(result.explanation).toBe("");
    // options는 그대로 유지되어야 학생이 선택지를 볼 수 있다
    expect(result.options).toEqual(baseProblem.options);
  });

  it("답을 볼 수 있는 뷰어에게는 필드를 그대로 통과시킨다", () => {
    const result = redactProblem(baseProblem, true);
    expect(result.correctIndex).toBe(1);
    expect(result.explanation).toBe("D=0이면 중근을 가집니다.");
    expect(result).toEqual(baseProblem);
  });
});
