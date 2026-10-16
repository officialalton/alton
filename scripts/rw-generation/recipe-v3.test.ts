import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadRecipesV3, validateRecipesV3, recipePromptBlock, type RecipesV3 } from "./recipe-v3";
import { SKILL_BY_CODE } from "../../lib/problem-taxonomy";

const recipes = loadRecipesV3();
const all = Object.values(recipes).flat();

describe("레시피 v3(문학 약한 유형)", () => {
  it("검증기를 통과하고 알려진 skill 코드만 쓴다", () => {
    expect(validateRecipesV3(recipes, [...SKILL_BY_CODE.keys()])).toEqual([]);
  });
  it("약한 4유형 x hard·medium = 8개가 모두 있다", () => {
    const keys = all.map((r) => `${r.questionType}/${r.difficulty}`).sort();
    expect(keys).toEqual(
      ["character_motivation", "main_idea_or_purpose", "relationship_between_characters", "tone_or_mood"].flatMap((t) => [`${t}/hard`, `${t}/medium`]).sort(),
    );
  });
  it("v2 레시피와 구조 호환: 기존 파이프라인이 읽는 필드(id·instruction·beyondMedium·checklist·minMet)가 있다", () => {
    const v2 = JSON.parse(readFileSync("data/mock-exam-generation/recipes.json", "utf-8")) as Record<string, Record<string, unknown>[]>;
    const v2Keys = Object.keys(v2.inferences[0]);
    for (const r of all) for (const k of v2Keys) expect(k in r).toBe(true);
  });
  it("근거는 2곳 이상 흩어지고 마지막 문장 재진술 금지·오답 3개·분위기 정반대 금지가 모든 레시피에 있다", () => {
    for (const r of all) {
      expect(r.evidenceSpread.minSpans).toBeGreaterThanOrEqual(2);
      expect(r.evidenceSpread.finalSentenceMustNotStateAnswer).toBe(true);
      expect(r.distractorPlan).toHaveLength(3);
      expect(r.bannedPatterns.join(" ")).toMatch(/마지막 문장/);
      expect(r.bannedPatterns.join(" ")).toMatch(/정반대/);
    }
  });
  it("hard 는 medium 보다 근거 간격·체크리스트 기준이 엄격하다", () => {
    for (const t of ["character_motivation", "main_idea_or_purpose", "relationship_between_characters", "tone_or_mood"]) {
      const h = all.find((r) => r.questionType === t && r.difficulty === "hard")!;
      const m = all.find((r) => r.questionType === t && r.difficulty === "medium")!;
      expect(h.evidenceSpread.minSentenceGap).toBeGreaterThanOrEqual(m.evidenceSpread.minSentenceGap);
      expect(h.minMet).toBeGreaterThanOrEqual(m.minMet);
      expect(h.passageWords.max).toBeGreaterThanOrEqual(m.passageWords.max);
    }
  });
  it("프롬프트 블록에 근거 분산·오답 설계·금지·단어 범위가 들어간다", () => {
    const b = recipePromptBlock(all[0]);
    for (const k of ["근거 분산", "오답 설계", "금지", "단어"]) expect(b).toContain(k);
  });
  it("검증기가 위반을 잡는다(근거 1곳·오답 2개·minMet 초과·중복 id)", () => {
    const bad = structuredClone(recipes) as RecipesV3;
    const r = bad.inferences[0];
    r.evidenceSpread.minSpans = 1;
    r.distractorPlan = r.distractorPlan.slice(0, 2);
    r.minMet = 99;
    bad.inferences.push({ ...bad.inferences[1] });
    const errs = validateRecipesV3(bad).join("\n");
    expect(errs).toMatch(/2곳 이상/);
    expect(errs).toMatch(/정확히 3개/);
    expect(errs).toMatch(/minMet/);
    expect(errs).toMatch(/id 중복/);
  });
  it("마지막 문장 금지 항목이 없는 레시피는 거부", () => {
    const bad = structuredClone(recipes) as RecipesV3;
    bad.inferences[0].bannedPatterns = ["아무거나"];
    expect(validateRecipesV3(bad).join("\n")).toMatch(/bannedPatterns/);
  });
});
