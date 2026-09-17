// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 첫 세부 기술:
// "Ratios, rates, proportional relationships, and units". a:b = c:x 형태의 비례식을
// 풀어 x를 구한다. AI를 전혀 부르지 않는다 — 값·정답·오답을 전부 코드로 계산한다.
import type { DistractorRationale, DistractorKind } from "../review";

export type RatiosRatesDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — a/b = c/x, x = c*b/a. 넷 다 항상 양의 정수이고 x도 정수가 되도록 고른다. */
export type RatiosRatesModel = {
  skillCode: "ratios_rates_units";
  difficulty: RatiosRatesDifficulty;
  a: number; b: number; c: number; x: number;
  itemA: string; itemB: string;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const RANGE_BY_DIFFICULTY: Record<RatiosRatesDifficulty, { ratio: number; scale: number }> = {
  easy: { ratio: 6, scale: 5 },
  medium: { ratio: 9, scale: 8 },
  hard: { ratio: 12, scale: 12 },
};

const ITEM_PAIRS: [string, string][] = [
  ["cups of flour", "cups of sugar"],
  ["miles", "gallons of gas"],
  ["red marbles", "blue marbles"],
  ["liters of paint", "square meters"],
  ["dollars", "hours worked"],
];

export function generateRatiosRatesModel(params: { difficulty: RatiosRatesDifficulty }): RatiosRatesModel {
  const { ratio, scale } = RANGE_BY_DIFFICULTY[params.difficulty];
  const [itemA, itemB] = ITEM_PAIRS[randInt(0, ITEM_PAIRS.length - 1)];
  for (let attempt = 0; attempt < 50; attempt++) {
    let a = randInt(2, ratio);
    let b = randInt(2, ratio);
    if (a === b) b = a + 1;
    const k = randInt(2, scale);
    const c = a * k;
    const x = b * k;
    if (x <= 0 || !Number.isInteger(x)) continue;

    // 2026-09-17(제품 오너 지시) — 실제 오류 경로만: 비율을 뒤집어 곱함(itemA/itemB
    // 순서 혼동), 곱셈 대신 덧셈으로 스케일링(가산적 추론), 교차곱을 반대쌍으로 계산.
    const invertedRatio = a !== 0 ? (c * a) / b : NaN;
    const additive = x + (a - b);
    const wrongCrossPair = c !== 0 ? (a * b) / c : NaN;
    const rawCandidates: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: invertedRatio, kind: "sign_error", reason: `${itemA}와 ${itemB}의 비율을 뒤집어서 계산했다.` },
      { value: additive, kind: "formula_misuse", reason: "비례식을 곱셈이 아니라 덧셈(가산적 추론)으로 풀었다." },
      { value: wrongCrossPair, kind: "formula_misuse", reason: "교차곱을 반대 쌍(a×b를 c로 나눔)으로 계산했다." },
      { value: c - a, kind: "formula_misuse", reason: "비례식을 풀지 않고 c에서 a를 뺀 값을 그대로 답했다." },
    ];
    const candidates = rawCandidates.filter((cand) => Number.isInteger(cand.value) && cand.value > 0);
    const seen = new Set<number>([x]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const cand of candidates) {
      if (distractors.length >= 3) break;
      if (seen.has(cand.value)) continue;
      seen.add(cand.value);
      distractors.push({ value: fmt(cand.value), kind: cand.kind, reason: cand.reason });
    }
    if (distractors.length < 3) continue;
    return { skillCode: "ratios_rates_units", difficulty: params.difficulty, a, b, c, x, itemA, itemB, correctAnswer: fmt(x), distractors: distractors.slice(0, 3) };
  }
  throw new Error("ratios_rates: 오답 후보 생성에 실패했습니다.");
}

export function validateRatiosRatesModel(model: RatiosRatesModel): { ok: true } | { ok: false; reason: string } {
  if (model.a * model.x !== model.b * model.c) return { ok: false, reason: "비례식이 실제로 성립하지 않습니다." };
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  return { ok: true };
}

export type CompiledMathProblem = {
  passage: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  explanationEn: string;
  figure: null;
  distractorRationales: DistractorRationale[];
};

export function renderRatiosRatesProblem(model: RatiosRatesModel): CompiledMathProblem {
  const passage = `The ratio of ${model.itemA} to ${model.itemB} is ${fmt(model.a)} to ${fmt(model.b)}. A recipe or plan uses ${fmt(model.c)} ${model.itemA} that follows this same ratio.`;
  const question = `Based on the ratio shown, how many ${model.itemB} are needed?`;
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const explanation = `비율 ${fmt(model.a)}:${fmt(model.b)} = ${fmt(model.c)}:x가 성립해야 하므로 x = ${fmt(model.c)}×${fmt(model.b)}÷${fmt(model.a)} = ${model.correctAnswer}이다.`;
  const explanationEn = `The proportion ${fmt(model.a)}:${fmt(model.b)} = ${fmt(model.c)}:x must hold, so x = ${fmt(model.c)}×${fmt(model.b)}÷${fmt(model.a)} = ${model.correctAnswer}.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 비례식에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 비율 값으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
