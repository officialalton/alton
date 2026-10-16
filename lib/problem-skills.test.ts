import { describe, expect, it } from "vitest";
import { PROBLEM_SKILLS, findProblemSkill } from "./problem-skills";
import { splitLearningContent } from "./render-learning-content";

describe("문제 유형 코드(2026-09-14 ⑤)", () => {
  it("코드·라벨로 찾고, 기본 형식이 붙어 있다", () => {
    expect(findProblemSkill("rw.words_in_context")?.label).toBe("Words in Context");
    expect(findProblemSkill("words in context")?.defaultFormat).toBe("mc");
    expect(findProblemSkill("Student-Produced Response (숫자 입력)")?.defaultFormat).toBe("spr");
    expect(findProblemSkill("없는 유형")).toBeNull();
    expect(new Set(PROBLEM_SKILLS.map((s) => s.code)).size).toBe(PROBLEM_SKILLS.length);
  });
  it("__밑줄__ 은 밑줄 조각이 되고 수식과 섞여도 된다", () => {
    expect(splitLearningContent("A __key sentence__ and $x$.").map((p) => p.kind)).toEqual(["text", "underline", "text", "math", "text"]);
  });
});
