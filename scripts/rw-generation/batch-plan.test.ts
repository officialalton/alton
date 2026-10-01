import { describe, expect, it } from "vitest";
import { buildLiteraryPlan, QTYPES, GENRE_ALLOWED, ADOPT_RATE } from "./batch-plan";
import { expandBatch, evaluateGenerated, injectedPromptBlock, type Generated, type CandidateSpec } from "./candidate-pipeline";
import { loadRecipesAll as loadRecipesV3 } from "./recipe-v3";
import { UsageLedger } from "./usage-caps";
import { positionSpread } from "./answer-position";

const plan = buildLiteraryPlan();

describe("문학 40% 배치 계획", () => {
  it("필요량: 문학 40% = 572건(easy 127·medium 379·hard 66), 모든 셀 합이 필요량과 같다", () => {
    expect(plan.totals.needAdopt).toBe(572);
    for (const d of ["easy", "medium", "hard"] as const) expect(plan.cells.filter((c) => c.difficulty === d).reduce((a, c) => a + c.needAdopt, 0)).toBe(plan.totals.needAdoptByDifficulty[d]);
  });
  it("라우팅: easy 는 발췌, hard·medium 은 AI 지문 동시 생성", () => {
    for (const c of plan.cells) expect(c.route).toBe(c.difficulty === "easy" ? "excerpt" : "ai_passage");
    for (const b of plan.batches) expect(b.route).toBe(b.difficulty === "easy" ? "excerpt" : "ai_passage");
  });
  it("후보 수 = 채택 필요량 / 채택률(셀별 올림) 이상이고, 총 후보는 pilot 추정(약 1,949) 안팎", () => {
    for (const c of plan.cells.filter((x) => x.route === "ai_passage")) expect(c.candidates).toBe(Math.ceil(c.needAdopt / ADOPT_RATE[c.difficulty]));
    expect(plan.totals.candidatesByRoute.ai_passage).toBeGreaterThan(1450);
    expect(plan.totals.candidatesByRoute.ai_passage).toBeLessThan(1650);
  });
  it("배치는 100건 이하, 배치 후보 합 = 전체 후보 합, 비용은 후보 수에 비례하며 배치 가격은 절반", () => {
    expect(plan.batches.every((b) => b.candidates <= 100)).toBe(true);
    expect(plan.batches.reduce((a, b) => a + b.candidates, 0)).toBe(plan.totals.candidates);
    for (const b of plan.batches) expect(b.estCostBatchUsd).toBeCloseTo(b.estCostSyncUsd / 2, 1);
    for (const b of plan.batches) expect(b.cells.reduce((a, c) => a + c.count, 0)).toBe(b.candidates);
  });
  it("장르 제약: 일기·시·희곡·편지는 허용된 문항 유형에만 배정", () => {
    for (const c of plan.cells) { const allow = GENRE_ALLOWED[c.genre as keyof typeof GENRE_ALLOWED]; if (allow) expect(allow).toContain(c.questionType); }
  });
  it("hard 셀은 모두 v4 레시피, 약한 4유형 medium 셀은 v3 레시피, 그 외 medium 은 난이도 지시문, easy 는 레시피 없음", () => {
    const weak = new Set(QTYPES.filter((t) => t.weak).map((t) => t.type));
    for (const c of plan.cells) {
      if (c.difficulty === "easy") expect(c.recipeSource).toBe("none");
      else if (c.difficulty === "hard") { expect(c.recipeSource).toBe("v4"); expect(c.recipeId).toContain(c.questionType); }
      else if (weak.has(c.questionType)) { expect(c.recipeSource).toBe("v3"); expect(c.recipeId).toContain(c.questionType); }
      else expect(c.recipeSource).toBe("difficulty_tip");
    }
  });
  it("문학 비중을 바꾸면 필요량이 비례한다(결정론)", () => {
    expect(buildLiteraryPlan({ literaryShare: 0.25 }).totals.needAdopt).toBeLessThan(plan.totals.needAdopt);
    expect(JSON.stringify(buildLiteraryPlan())).toBe(JSON.stringify(plan));
  });
  it("장르·유형이 한 배치 안에 섞인다(첫 hard 배치)", () => {
    const b = plan.batches.find((x) => x.difficulty === "medium")!;
    expect(new Set(b.cells.map((c) => c.genre)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(b.cells.map((c) => c.questionType)).size).toBeGreaterThanOrEqual(8);
  });
});

describe("배치 전개·생성 후 검사", () => {
  const recipes = loadRecipesV3();
  const batch = plan.batches.find((b) => b.difficulty === "hard")!;
  it("전개는 결정론이고 정답 위치가 skill x 난이도로 누적 균등", () => {
    const a = expandBatch(batch, { ledger: new UsageLedger(), recipes });
    const b = expandBatch(batch, { ledger: new UsageLedger(), recipes });
    expect(a.specs.map((s) => [s.candidateId, s.targetLetter, s.seed.topicSeed])).toEqual(b.specs.map((s) => [s.candidateId, s.targetLetter, s.seed.topicSeed]));
    expect(Math.max(...Object.values(positionSpread(a.positions)))).toBeLessThanOrEqual(1);
    expect(a.specs).toHaveLength(batch.candidates);
    expect(a.specs.every((s) => s.words.min >= 60 && s.words.max <= 220)).toBe(true);
    const motivation = a.specs.find((s) => s.questionType === "character_motivation")!;
    expect(motivation.recipeId).toContain("character_motivation_hard_v4");
    expect(motivation.words).toEqual({ min: 120, max: 180 });
  });
  const spec = (): CandidateSpec => expandBatch(batch, { ledger: new UsageLedger(), recipes }).specs.find((s) => s.questionType === "character_motivation")!;
  const passage = (n: number) => `Mara folded the apron twice and set the keys beside the register. ` + Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
  const good = (s: CandidateSpec, n = 130): Generated => ({
    passage: passage(n), question: "Which choice best explains why Mara sets down the keys?",
    options: ["She tests whether anyone will object to her leaving", "She resents the delivery driver for arriving late", "She plans to take the register money tonight", "She is bored with folding the apron again"],
    correct_letter: "A", explanation: "정답은 A 이다.",
  });
  it("정상 후보는 review 로 가고, 어긋난 정답 위치는 보정된다", () => {
    const s = spec();
    const v = evaluateGenerated(s, good(s), { ledger: new UsageLedger() });
    expect(v.action).toBe("review");
    if (v.action === "review") expect(v.g.correct_letter).toBe(s.targetLetter);
  });
  it("단어 수 초과는 재요청, 재요청 뒤에도 초과면 탈락", () => {
    const s = spec();
    expect(evaluateGenerated(s, good(s, 260), { ledger: new UsageLedger() }).action).toBe("retry_words");
    const r = evaluateGenerated(s, good(s, 260), { ledger: new UsageLedger(), wordAttempt: 1 });
    expect(r).toMatchObject({ action: "reject", stage: "words" });
  });
  it("정답이 가장 긴 선택지면 distractor 단계 탈락, 금지 이름은 diversity 탈락", () => {
    const s = spec();
    const g = good(s);
    g.options = ["Mara is sad", "Mara is glad", "Mara is mad", "Mara quietly tests whether anyone in the room will object to her leaving"];
    g.correct_letter = "D";
    expect(evaluateGenerated(s, g, { ledger: new UsageLedger() })).toMatchObject({ action: "reject", stage: "distractor" });
    const h = good(s);
    h.passage = h.passage + " Tobias nodded.";
    expect(evaluateGenerated(s, h, { ledger: new UsageLedger() })).toMatchObject({ action: "reject", stage: "diversity" });
  });
  it("첫 단어 상한: 같은 배치에서 같은 첫 단어가 상한을 넘으면 탈락", () => {
    const s = spec();
    const led = new UsageLedger(undefined, { batchSize: 10, globalSize: 2000 });
    const g = { ...good(s), passage: "Mara folded the apron twice. " + good(s).passage };
    expect(evaluateGenerated(s, g, { ledger: led }).action).toBe("review");
    expect(evaluateGenerated(s, g, { ledger: led }).action).toBe("review");
    expect(evaluateGenerated(s, g, { ledger: led })).toMatchObject({ action: "reject", stage: "diversity" });
  });
  it("프롬프트 주입 블록: 씨앗·이름·목표 위치·단어 범위·레시피", () => {
    const s = spec();
    const r = recipes.inferences.find((x) => x.id === s.recipeId)!;
    const p = injectedPromptBlock(s, r);
    for (const k of [s.seed.topicSeed, s.seed.names[0], `정답 위치: 정답 선택지는 반드시 ${s.targetLetter}`, "120~180", "근거 분산", "자기 점검"]) expect(p).toContain(k);
  });
});
