// 문학 40% 기준 배치 계획 생성기(2026-10-01): 30세트 필요량 -> skill x 난이도 x 문항 유형 x 장르 후보 수 -> 100건 단위 배치와 예상 비용.
// easy 는 저작권 자유 원문 발췌(route=excerpt), hard·medium 은 AI 지문+문항 동시 생성(route=ai_passage). 순수 계산 — API·DB 호출 없음.
import { allocateCounts } from "../../lib/mock-exam/assemble";
import { GENRE_WEIGHTS, GENRES_LIT, type LitGenre } from "./seed-bank";
import { loadRecipesAll, findRecipe, type RecipesV3 } from "./recipe-v3";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

/** 30세트 R&W 2,430문항 중 발췌 가능 skill 7개(중심내용·추론·증거·구조·어휘·교차·전환) 1,429문항의 난이도 구성(pilot 문서 12절). */
export const PASSAGE_BASE: Record<Difficulty, number> = { easy: 317, medium: 948, hard: 164 };
/** 문학 비중(오너 확정 40%). */
export const LITERARY_SHARE = 0.4;
/** 문학 문항이 나올 수 있는 skill 의 30세트 총량(thirty-need 표): 이 비율로 난이도별 문학 필요량을 skill 에 나눈다. */
export const SKILL_WEIGHT: Record<string, number> = { central_ideas_details: 190, inferences: 158, words_in_context: 306, text_structure_purpose: 238 };

export type QType = { type: string; skill: string; weak: boolean; weight: number };
/** 문항 유형 11종(파일럿 v4 와 같은 skill 매핑). weak = 파일럿 수율 0 이라 레시피 v3 를 쓰는 유형. */
export const QTYPES: QType[] = [
  { type: "narrator_attitude", skill: "central_ideas_details", weak: false, weight: 50 },
  { type: "main_idea_or_purpose", skill: "central_ideas_details", weak: true, weight: 50 },
  { type: "character_motivation", skill: "inferences", weak: true, weight: 28 },
  { type: "tone_or_mood", skill: "inferences", weak: true, weight: 24 },
  { type: "relationship_between_characters", skill: "inferences", weak: true, weight: 24 },
  { type: "symbolism", skill: "inferences", weak: false, weight: 24 },
  { type: "figurative_language", skill: "words_in_context", weak: false, weight: 50 },
  { type: "word_in_context", skill: "words_in_context", weak: false, weight: 50 },
  { type: "tone_shift", skill: "text_structure_purpose", weak: false, weight: 40 },
  { type: "text_structure", skill: "text_structure_purpose", weak: false, weight: 30 },
  { type: "underlined_portion_function", skill: "text_structure_purpose", weak: false, weight: 30 },
];

/**
 * 앱 저장·렌더 규칙(lib/rw-stimulus.ts checkRwStructure)은 skill 'inferences' 를 '빈칸 하나 + Which choice most logically completes the text?' 형태로만 허용한다.
 * 파일럿이 inferences 로 묶은 문학 유형(인물 동기·어조/분위기·인물 관계·상징)은 빈칸 없는 문항이라 그대로 저장하면 거부된다.
 * 그래서 앱에 저장·검사할 skill 코드를 따로 둔다(빈 객체로 바꾸면 파일럿 매핑 그대로). 총괄 결정 사항 — 완료 보고서 '결정 필요' 참조.
 */
export const APP_SKILL_OVERRIDE: Record<string, string> = {
  character_motivation: "central_ideas_details",
  tone_or_mood: "central_ideas_details",
  relationship_between_characters: "central_ideas_details",
  symbolism: "central_ideas_details",
};
export const appSkillOf = (questionType: string, planSkill: string) => APP_SKILL_OVERRIDE[questionType] ?? planSkill;

/** 파일럿 약한 장르(일기 0/3, 시 1/6)는 잘 되는 유형으로 제한한다. */
export const GENRE_ALLOWED: Partial<Record<LitGenre, string[]>> = {
  diary: ["narrator_attitude", "tone_shift", "tone_or_mood", "character_motivation"],
  poetry: ["narrator_attitude", "tone_shift", "figurative_language", "symbolism", "tone_or_mood", "word_in_context"],
  drama: ["character_motivation", "relationship_between_characters", "tone_shift", "tone_or_mood", "main_idea_or_purpose"],
  letter: ["narrator_attitude", "character_motivation", "relationship_between_characters", "tone_or_mood", "main_idea_or_purpose", "tone_shift"],
};

/** 채택률(파일럿 v4 실측, 보수적). 레시피 v3 가 hard 를 올리면 'v3Hard' 시나리오로 비교한다. */
export const ADOPT_RATE = { easy: 0.3, medium: 0.35, hard: 0.15 } as const;
export const ADOPT_RATE_V3_HARD = 0.35; // pilot v2 레시피 설계 hard 문학 6/17
export const EXCERPT_EASY_RATE = 0.33; // pilot v3 발췌 easy 문학 채택 안팎
/** 후보 1건당 비용(동기 가격, pilot v4 실측): 배치 가격은 절반. */
export const COST_PER_CANDIDATE = { easy: 0.062, medium: 0.062, hard: 0.077 } as const;
/** '쉬움' 탈락에 한한 재작성 1회의 추가 비용 비율(hard 후보 중 '쉬움' 탈락 약 60% 가 1회 재작성). */
export const REWRITE_SHARE_HARD = 0.6;
export const BATCH_SIZE = 100;

export type Route = "excerpt" | "ai_passage";
export type Cell = {
  skill: string; difficulty: Difficulty; questionType: string; genre: LitGenre; route: Route;
  needAdopt: number; candidates: number; recipeId: string | null; recipeSource: "v3" | "v4" | "difficulty_tip" | "none";
};
export type PlanBatch = { batchId: string; route: Route; difficulty: Difficulty; candidates: number; cells: { skill: string; questionType: string; genre: string; count: number }[]; estCostSyncUsd: number; estCostBatchUsd: number };

const allocate = (weights: { key: string; w: number }[], total: number) => allocateCounts(weights.map((x) => ({ key: x.key, weightPct: x.w })), total);

export type PlanOptions = { literaryShare?: number; recipes?: RecipesV3; adoptRate?: Partial<Record<Difficulty, number>>; batchSize?: number; idPrefix?: string };

export function buildLiteraryPlan(opts: PlanOptions = {}) {
  const share = opts.literaryShare ?? LITERARY_SHARE;
  const rate = { ...ADOPT_RATE, ...opts.adoptRate };
  const recipes = opts.recipes ?? loadRecipesAll();
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const needByDiff: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const d of DIFFS) needByDiff[d] = Math.round(PASSAGE_BASE[d] * share);
  const cells: Cell[] = [];
  for (const d of DIFFS) {
    const route: Route = d === "easy" ? "excerpt" : "ai_passage";
    const effRate = d === "easy" && route === "excerpt" ? EXCERPT_EASY_RATE : rate[d];
    const skillNeed = allocate(Object.entries(SKILL_WEIGHT).map(([key, w]) => ({ key, w })), needByDiff[d]);
    for (const skill of Object.keys(SKILL_WEIGHT)) {
      const types = QTYPES.filter((t) => t.skill === skill);
      const typeNeed = allocate(types.map((t) => ({ key: t.type, w: t.weight })), skillNeed[skill] ?? 0);
      for (const t of types) {
        const nType = typeNeed[t.type] ?? 0;
        if (nType === 0) continue;
        const allowedGenres = GENRES_LIT.filter((g) => !GENRE_ALLOWED[g] || GENRE_ALLOWED[g]!.includes(t.type));
        const gNeed = allocate(allowedGenres.map((g) => ({ key: g, w: GENRE_WEIGHTS[g] })), nType);
        for (const g of allowedGenres) {
          const n = gNeed[g] ?? 0;
          if (n === 0) continue;
          const r = findRecipe(recipes, t.skill, t.type, d);
          // hard 문학 후보는 레시피 없이 만들지 않는다(웨이브 1: 레시피 없는 hard 채택률 낮음 + 난이도 지시문만으로는 hard 를 유지하지 못함).
          if (d === "hard" && !r) throw new Error(`hard 후보에 레시피가 없습니다: ${t.skill}/${t.type} — recipes-v4-literary-hard.json 에 추가하세요`);
          cells.push({
            skill: t.skill, difficulty: d, questionType: t.type, genre: g, route, needAdopt: n, candidates: Math.ceil(n / effRate),
            recipeId: r?.id ?? null, recipeSource: r ? (r.version === 4 ? "v4" : "v3") : d === "easy" ? "none" : "difficulty_tip",
          });
        }
      }
    }
  }
  // 배치 구성: (route, difficulty) 별로 셀을 라운드로빈(유형·장르가 한 배치에 섞이도록)으로 풀어 batchSize 단위로 자른다.
  const batches: PlanBatch[] = [];
  for (const d of DIFFS) {
    const route: Route = d === "easy" ? "excerpt" : "ai_passage";
    const pool = cells.filter((c) => c.difficulty === d).map((c) => ({ ...c, left: c.candidates }));
    const items: { skill: string; questionType: string; genre: string }[] = [];
    while (pool.some((c) => c.left > 0)) {
      for (const c of pool) if (c.left > 0) { items.push({ skill: c.skill, questionType: c.questionType, genre: c.genre }); c.left--; }
    }
    for (let i = 0, b = 0; i < items.length; i += batchSize, b++) {
      const slice = items.slice(i, i + batchSize);
      const agg = new Map<string, { skill: string; questionType: string; genre: string; count: number }>();
      for (const it of slice) { const k = `${it.skill}|${it.questionType}|${it.genre}`; const a = agg.get(k) ?? { ...it, count: 0 }; a.count++; agg.set(k, a); }
      const rewrite = d === "hard" ? 1 + REWRITE_SHARE_HARD : 1;
      const sync = slice.length * COST_PER_CANDIDATE[d] * (d === "hard" ? rewrite : 1);
      batches.push({ batchId: `${opts.idPrefix ?? "lit40"}-${d}-${String(b + 1).padStart(2, "0")}`, route, difficulty: d, candidates: slice.length, cells: [...agg.values()], estCostSyncUsd: Number(sync.toFixed(2)), estCostBatchUsd: Number((sync / 2).toFixed(2)) });
    }
  }
  const sum = (f: (c: Cell) => number, p: (c: Cell) => boolean = () => true) => cells.filter(p).reduce((a, c) => a + f(c), 0);
  const totals = {
    needAdopt: sum((c) => c.needAdopt),
    needAdoptByDifficulty: needByDiff,
    candidates: sum((c) => c.candidates),
    candidatesByRoute: { excerpt: sum((c) => c.candidates, (c) => c.route === "excerpt"), ai_passage: sum((c) => c.candidates, (c) => c.route === "ai_passage") },
    candidatesByDifficulty: Object.fromEntries(DIFFS.map((d) => [d, sum((c) => c.candidates, (c) => c.difficulty === d)])),
    batches: batches.length,
    estCostSyncUsd: Number(batches.reduce((a, b) => a + b.estCostSyncUsd, 0).toFixed(2)),
    estCostBatchUsd: Number(batches.reduce((a, b) => a + b.estCostBatchUsd, 0).toFixed(2)),
  };
  return { assumptions: { literaryShare: share, passageBase: PASSAGE_BASE, adoptRate: rate, excerptEasyRate: EXCERPT_EASY_RATE, costPerCandidateSyncUsd: COST_PER_CANDIDATE, rewriteShareHard: REWRITE_SHARE_HARD, batchSize }, cells, batches, totals };
}
export type LiteraryPlan = ReturnType<typeof buildLiteraryPlan>;
