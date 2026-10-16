import { describe, expect, it } from "vitest";
import { loadRecipesV3, loadRecipesAll, validateRecipesV4, recipePromptBlock, findRecipe, RECIPES_V4_FILE, LITERARY_QUESTION_TYPES } from "./recipe-v3";
import { buildLiteraryPlan, QTYPES } from "./batch-plan";
import { expandBatch } from "./candidate-pipeline";
import { UsageLedger } from "./usage-caps";
import { buildHardPilotPlan } from "./hard-pilot-plan";
import { SKILL_BY_CODE } from "../../lib/problem-taxonomy";

const v4 = loadRecipesV3(RECIPES_V4_FILE);
const all4 = Object.values(v4).flat();

describe("레시피 v4 문학 hard", () => {
  it("검증기를 통과하고 skill 코드가 알려진 값이다", () => {
    expect(validateRecipesV4(v4, [...SKILL_BY_CODE.keys()])).toEqual([]);
  });
  it("문학 11유형 모두 hard 레시피가 있고 skill 이 계획 매핑(QTYPES)과 같다", () => {
    expect(all4.map((r) => r.questionType).sort()).toEqual([...LITERARY_QUESTION_TYPES].sort());
    for (const [skill, list] of Object.entries(v4)) for (const r of list) expect(QTYPES.find((q) => q.type === r.questionType)!.skill).toBe(skill);
  });
  it("오답 3개는 서로 다른 오독 경로이고 근거는 2곳 이상·간격 2문장 이상", () => {
    for (const r of all4) {
      expect(new Set(r.distractorPlan.map((d) => d.kind)).size).toBe(3);
      expect(r.evidenceSpread.minSpans).toBeGreaterThanOrEqual(2);
      expect(r.evidenceSpread.minSentenceGap).toBeGreaterThanOrEqual(2);
    }
  });
  it("검증기가 결함을 잡는다(오답 kind 중복·selfCheck 부족·유형 누락)", () => {
    const bad = JSON.parse(JSON.stringify(v4));
    bad.inferences[0].distractorPlan[1].kind = bad.inferences[0].distractorPlan[0].kind;
    bad.inferences[0].selfCheck = ["하나"];
    delete bad.words_in_context;
    const errs = validateRecipesV4(bad).join("\n");
    expect(errs).toMatch(/서로 다른 오독 경로/);
    expect(errs).toMatch(/selfCheck/);
    expect(errs).toMatch(/word_in_context: v4 hard 레시피 없음/);
  });
  it("word_in_context 레시피는 선택지 2~3단어 구와 빈칸 뒤 정의 금지를 명시한다(코드 게이트 대응)", () => {
    const r = all4.find((x) => x.questionType === "word_in_context")!;
    expect(r.instruction).toMatch(/2~3단어/);
    expect(r.passageDesign!.directStatementBan).toMatch(/동격/);
  });
  it("프롬프트 블록에 지문 설계·정답 설계·자기 점검이 들어간다", () => {
    for (const r of all4) {
      const b = recipePromptBlock(r);
      expect(b).toMatch(/지문 설계/);
      expect(b).toMatch(/정답 설계/);
      expect(b).toMatch(/자기 점검/);
    }
  });
});

describe("레시피 합치기·배정", () => {
  const recipes = loadRecipesAll();
  it("같은 skill·유형·hard 에서 v4 가 v3 보다 우선하고 medium 은 v3 를 쓴다", () => {
    expect(findRecipe(recipes, "inferences", "character_motivation", "hard")!.id).toBe("inferences_lit_character_motivation_hard_v4");
    expect(findRecipe(recipes, "inferences", "character_motivation", "medium")!.id).toBe("inferences_lit_character_motivation_medium");
  });
  it("계획: 모든 hard 셀이 v4 레시피를 가지고 recipeSource 가 v4 다", () => {
    const plan = buildLiteraryPlan();
    const hard = plan.cells.filter((c) => c.difficulty === "hard");
    expect(hard.length).toBeGreaterThan(0);
    for (const c of hard) { expect(c.recipeSource).toBe("v4"); expect(c.recipeId).toMatch(/_hard_v4$/); }
  });
  it("레시피 없는 hard 후보는 만들 수 없다(계획·후보 확장 모두 오류)", () => {
    const noHard = loadRecipesV3(); // v3 만: 비약한 유형 hard 레시피 없음
    expect(() => buildLiteraryPlan({ recipes: noHard })).toThrow(/hard 후보에 레시피가 없습니다/);
    const pilot = buildHardPilotPlan(1, recipes).batches[0];
    expect(() => expandBatch(pilot, { ledger: new UsageLedger(), recipes: noHard })).toThrow(/hard 후보에 레시피가 없습니다/);
  });
  it("hard 시험 계획: 11유형 x 3 = 33 후보가 모두 v4 레시피로 배정되고 결정론적이다", () => {
    const batch = buildHardPilotPlan(3, recipes).batches[0];
    expect(batch.candidates).toBe(33);
    const a = expandBatch(batch, { ledger: new UsageLedger(), recipes });
    const b = expandBatch(batch, { ledger: new UsageLedger(), recipes });
    expect(a.specs).toHaveLength(33);
    expect(a.specs.map((s) => s.recipeId)).toEqual(b.specs.map((s) => s.recipeId));
    for (const s of a.specs) expect(s.recipeId).toMatch(/_hard_v4$/);
    expect(new Set(a.specs.map((s) => s.questionType)).size).toBe(11);
    for (const s of a.specs) {
      const r = findRecipe(recipes, s.skill, s.questionType, "hard")!;
      expect(r.genres).toContain(s.genre);
      expect(s.words.min).toBeGreaterThanOrEqual(Math.max(60, r.passageWords.min));
    }
  });
});
