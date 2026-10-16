import { describe, expect, it } from "vitest";
import { resolveIntendedSkill } from "./intended-skill";

describe("resolveIntendedSkill", () => {
  it("override 된 문학 유형은 questionType 으로 inferences 복원", () => {
    expect(resolveIntendedSkill({ quality: { questionType: "symbolism" }, skillCode: "central_ideas_details" })).toEqual({ skill: "inferences", source: "quality.questionType" });
  });
  it("저장된 intendedSkill 이 최우선, 그다음 채택 파일 planSkill", () => {
    expect(resolveIntendedSkill({ quality: { questionType: "symbolism", mockExamGeneration: { intendedSkill: "words_in_context" } }, planSkillFromFile: "inferences" }).skill).toBe("words_in_context");
    expect(resolveIntendedSkill({ quality: { questionType: "narrator_attitude" }, planSkillFromFile: "inferences" })).toEqual({ skill: "inferences", source: "adopted.planSkill" });
  });
  it("문학 외 문항은 skill_code 그대로, 모르면 null", () => {
    expect(resolveIntendedSkill({ quality: {}, skillCode: "boundaries" })).toEqual({ skill: "boundaries", source: "skill_code" });
    expect(resolveIntendedSkill({ quality: { questionType: "x" }, skillCode: "nope" })).toEqual({ skill: null, source: null });
  });
});
