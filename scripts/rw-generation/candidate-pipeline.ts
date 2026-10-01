// 후보 전개·생성 후 검사(2026-10-01): 배치 계획 한 배치를 후보 명세(씨앗·목표 정답 위치·단어 범위·레시피)로 풀고,
// 생성 결과를 코드 게이트(단어 수·정답 위치·오답 품질·마지막 문장 재진술·소재 상한)로 판정한다. 모델 호출은 이 모듈 밖(웨이브 실행기)에서 한다.
import { planAnswerPositions, positionDirective, enforceAnswerPosition, type Letter, type PositionCounts, type PositionKey } from "./answer-position";
import { judgeWordCount, effectiveRange, type WordRange } from "./passage-words";
import { distractorGate, restatementGate } from "./distractor-gate";
import { composeSeeds, AVOID_FIRST_WORDS, type LiterarySeed } from "./seed-compose";
import { UsageLedger, extractUsage, type Violation } from "./usage-caps";
import { NAME_POOL, BANNED_NAMES } from "./name-pool";
import { recipePromptBlock, type RecipesV3, type RecipeV3 } from "./recipe-v3";
import type { PlanBatch, Route } from "./batch-plan";

export type CandidateSpec = {
  candidateId: string; batchId: string; route: Route; skill: string; difficulty: "easy" | "medium" | "hard"; questionType: string;
  genre: string; seed: LiterarySeed; targetLetter: Letter; words: WordRange; recipeId: string | null;
};

/** 배치 하나를 후보 명세로 푼다. ledger·priorPositions 는 이전 배치까지의 누적(웨이브 전체에서 하나를 이어 쓴다). 결정론. */
export function expandBatch(
  batch: PlanBatch,
  opts: { ledger: UsageLedger; recipes: RecipesV3; priorPositions?: Record<PositionKey, PositionCounts>; indexOffset?: number },
): { specs: CandidateSpec[]; positions: Record<PositionKey, PositionCounts> } {
  // 셀을 풀어 후보 순서를 고정(계획의 라운드로빈 순서와 같게 유형·장르가 섞이도록).
  const flat: { skill: string; questionType: string; genre: string }[] = [];
  const left = batch.cells.map((c) => ({ ...c }));
  while (left.some((c) => c.count > 0)) for (const c of left) if (c.count > 0) { flat.push({ skill: c.skill, questionType: c.questionType, genre: c.genre }); c.count--; }
  const seeds = composeSeeds({ n: flat.length, batchId: batch.batchId, ledger: opts.ledger, indexOffset: opts.indexOffset });
  const { letters, counts } = planAnswerPositions(flat.map((f) => ({ skill: f.skill, difficulty: batch.difficulty })), opts.priorPositions);
  const specs = flat.map((f, i): CandidateSpec => {
    const recipe = (opts.recipes[f.skill] ?? []).find((r) => r.questionType === f.questionType && r.difficulty === batch.difficulty) ?? null;
    // composeSeeds 는 장르를 자체 배분하지만 계획의 장르가 우선한다(유형별 허용 장르 제약을 계획이 이미 반영).
    const seed = { ...seeds[i], genre: f.genre as LiterarySeed["genre"] };
    return {
      candidateId: `${batch.batchId}-${String(i + 1).padStart(3, "0")}`, batchId: batch.batchId, route: batch.route, skill: f.skill, difficulty: batch.difficulty,
      questionType: f.questionType, genre: f.genre, seed, targetLetter: letters[i], words: effectiveRange(recipe?.passageWords), recipeId: recipe?.id ?? null,
    };
  });
  return { specs, positions: counts };
}

/** 생성 프롬프트의 코드 주입 부분(소재 씨앗·이름·정답 위치·단어 수·레시피). 질문 유형·난이도 지시문은 웨이브 실행기가 앞에 붙인다. */
export function injectedPromptBlock(spec: CandidateSpec, recipe?: RecipeV3 | null): string {
  const s = spec.seed;
  return [
    `소재 씨앗(문구를 그대로 쓰지 말고 장면으로 풀 것): ${s.topicSeed}`,
    `인물 이름: ${s.names.join(", ")} 만 사용한다(다른 이름·흔한 이름을 지어내지 않는다).`,
    `도입 방식: ${s.openingStyle}. 첫 단어를 ${AVOID_FIRST_WORDS.map((w) => `'${w[0].toUpperCase()}${w.slice(1)}'`).join("·")} 로 시작하지 않는다.`,
    `지문 길이: ${spec.words.min}~${spec.words.max}단어(코드가 검사해 벗어나면 재요청하거나 탈락시킨다).`,
    positionDirective(spec.targetLetter),
    recipe ? recipePromptBlock(recipe) : "",
  ].filter(Boolean).join("\n");
}

export type Generated = { passage: string; question: string; options: string[]; correct_letter: string; explanation: string };
export type Verdict =
  | { action: "review"; g: Generated; notes: string[] }
  | { action: "retry_words"; instruction: string; count: number }
  | { action: "reject"; stage: "format" | "words" | "position" | "distractor" | "restatement" | "diversity"; reasons: string[] };

/**
 * 생성 직후(AI 검수 전) 코드 게이트. 순서: 형식 -> 단어 수(1회 재요청) -> 정답 위치 보정/탈락 -> 오답 품질 -> 마지막 문장 재진술 -> 소재 상한.
 * 소재 상한은 통과해야 장부에 기록한다(탈락 후보가 장부를 소진하지 않게). 'review' 가 나온 후보만 AI 검수로 보낸다.
 */
export function evaluateGenerated(
  spec: CandidateSpec, g: Generated,
  ctx: { ledger: UsageLedger; wordAttempt?: number; maxWordRetries?: number; setId?: string; /** 발췌 지문(easy)은 지문 길이·소재 상한을 건너뛴다 */ excerpt?: boolean },
): Verdict {
  if (!g.passage || !g.question || !Array.isArray(g.options) || g.options.length !== 4 || !/^[ABCD]$/.test(g.correct_letter)) return { action: "reject", stage: "format", reasons: ["지문·질문·선택지 4개·정답 글자 형식 오류"] };
  const w = ctx.excerpt ? ({ action: "ok", count: 0 } as const) : judgeWordCount(g.passage, spec.words, ctx.wordAttempt ?? 0, ctx.maxWordRetries ?? 1);
  if (w.action === "retry") return { action: "retry_words", instruction: w.instruction, count: w.count };
  if (w.action === "reject") return { action: "reject", stage: "words", reasons: [w.reason] };
  const pos = enforceAnswerPosition(g, spec.targetLetter);
  if (pos.status === "rejected") return { action: "reject", stage: "position", reasons: [pos.reason] };
  const fixed = pos.g;
  const notes = pos.status === "permuted" ? [`정답 위치 보정 ${g.correct_letter}->${spec.targetLetter}`] : [];
  const dg = distractorGate({ options: fixed.options, correct_letter: fixed.correct_letter });
  if (!dg.ok) return { action: "reject", stage: "distractor", reasons: dg.reasons };
  const rg = restatementGate(fixed.passage, fixed.options, fixed.correct_letter);
  if (!rg.ok) return { action: "reject", stage: "restatement", reasons: [rg.reason!] };
  if (ctx.excerpt) return { action: "review", g: fixed, notes };
  const known = NAME_POOL.map((n) => n.name).concat(BANNED_NAMES.map((b) => b[0].toUpperCase() + b.slice(1)));
  const used = extractUsage(fixed.passage, known);
  const banned = used.names.filter((n) => BANNED_NAMES.includes(n.toLowerCase()));
  if (banned.length) return { action: "reject", stage: "diversity", reasons: [`금지 이름 사용: ${banned.join(", ")}`] };
  const usage = { names: used.names, firstWord: used.firstWord, locale: spec.seed.locale, setting: spec.seed.setting, conflict: spec.seed.conflict, relationship: spec.seed.relationship, pov: spec.seed.pov };
  // 씨앗 단계에서 이미 장소·갈등·관계·이름이 기록됐으므로 여기서는 '본문 이름'과 첫 단어만 새로 검사한다.
  const v: Violation[] = ctx.ledger.check({ names: used.names.filter((n) => !spec.seed.names.includes(n)), firstWord: usage.firstWord }, { batchId: spec.batchId, setId: ctx.setId });
  if (v.length) return { action: "reject", stage: "diversity", reasons: v.map((x) => `${x.kind} '${x.value}' ${x.scope} ${x.count}>${x.cap}`) };
  ctx.ledger.commit({ names: used.names.filter((n) => !spec.seed.names.includes(n)), firstWord: usage.firstWord }, { batchId: spec.batchId, setId: ctx.setId });
  return { action: "review", g: fixed, notes };
}
