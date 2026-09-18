// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 첫 세부 기술:
// "Ratios, rates, proportional relationships, and units". a:b = c:x 형태의 비례식을
// 풀어 x를 구한다. AI를 전혀 부르지 않는다 — 값·정답·오답을 전부 코드로 계산한다.
//
// 2026-09-17(제품 오너 지시, 중간 우선순위 항목) — 같은 스킬 코드에 "연쇄 단위환산"
// (2단계 이상 순차 단위환산, 예: inches→feet→yards, mph→ft/s) 세부 유형을 추가한다.
// 전부 결정적 코드 계산 — AI 호출 없음.
import type { DistractorRationale, DistractorKind } from "../review";

export type RatiosRatesDifficulty = "easy" | "medium" | "hard";
export type RatiosRatesQuestionKind = "proportion" | "chained_conversion";

/** 불변 정답 모델 — a/b = c/x, x = c*b/a. 넷 다 항상 양의 정수이고 x도 정수가 되도록 고른다. */
export type ProportionModel = {
  skillCode: "ratios_rates_units";
  difficulty: RatiosRatesDifficulty;
  questionKind: "proportion";
  a: number; b: number; c: number; x: number;
  itemA: string; itemB: string;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

/** 불변 정답 모델 — 2단계 이상 순차 단위환산. linear: 단위 A→B→C(예: 인치→피트→야드).
 * rate: 비율 단위(예: mph→ft/s) — 분자·분모를 각각 다른 배율로 환산해야 한다. */
export type ChainedConversionModel = {
  skillCode: "ratios_rates_units";
  difficulty: RatiosRatesDifficulty;
  questionKind: "chained_conversion";
  mode: "linear" | "rate";
  rawValue: number;
  unit0: string; unit1: string; unit2: string;
  f1: number; f2: number; // linear: 곱수. rate: f1=분자 배율, f2=분모 배율(결과 = rawValue*f1/f2).
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

export type RatiosRatesModel = ProportionModel | ChainedConversionModel;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
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

function generateProportionModel(params: { difficulty: RatiosRatesDifficulty }): ProportionModel {
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
    return { skillCode: "ratios_rates_units", difficulty: params.difficulty, questionKind: "proportion", a, b, c, x, itemA, itemB, correctAnswer: fmt(x), distractors: distractors.slice(0, 3) };
  }
  throw new Error("ratios_rates: 오답 후보 생성에 실패했습니다.");
}

/** linear 체인 — 단위 A→B→C. f1: A 1개당 B의 양, f2: B 1개당 C의 양(둘 다 분수, 0<f<1). */
const LINEAR_CHAINS: { unit0: string; unit1: string; unit2: string; f1: number; f2: number }[] = [
  { unit0: "inches", unit1: "feet", unit2: "yards", f1: 1 / 12, f2: 1 / 3 },
  { unit0: "feet", unit1: "yards", unit2: "miles", f1: 1 / 3, f2: 1 / 1760 },
  { unit0: "ounces", unit1: "pounds", unit2: "tons", f1: 1 / 16, f2: 1 / 2000 },
  { unit0: "minutes", unit1: "hours", unit2: "days", f1: 1 / 60, f2: 1 / 24 },
  { unit0: "seconds", unit1: "minutes", unit2: "hours", f1: 1 / 60, f2: 1 / 60 },
  { unit0: "cups", unit1: "pints", unit2: "quarts", f1: 1 / 2, f2: 1 / 2 },
  { unit0: "pints", unit1: "quarts", unit2: "gallons", f1: 1 / 2, f2: 1 / 4 },
];

/** rate 체인 — 분자·분모를 각각 다른 배율로 환산해야 하는 비율 단위. numerFactor: unit1 분자가
 * unit0 분자보다 몇 배 큰가(예: 1마일=5280피트 → 5280). denomFactor: 분모 쪽도 동일 개념. */
const RATE_CHAINS: { unit0: string; unit1: string; unit2: string; numerFactor: number; denomFactor: number }[] = [
  { unit0: "miles per hour", unit1: "feet", unit2: "feet per second", numerFactor: 5280, denomFactor: 3600 },
  { unit0: "feet per second", unit1: "miles", unit2: "miles per hour", numerFactor: 1 / 5280, denomFactor: 1 / 3600 },
  { unit0: "kilometers per hour", unit1: "meters", unit2: "meters per second", numerFactor: 1000, denomFactor: 3600 },
  { unit0: "meters per second", unit1: "kilometers", unit2: "kilometers per hour", numerFactor: 1 / 1000, denomFactor: 1 / 3600 },
];

const CHAIN_VALUE_RANGE_BY_DIFFICULTY: Record<RatiosRatesDifficulty, [number, number]> = {
  easy: [2, 8],
  medium: [3, 15],
  hard: [4, 25],
};

function generateChainedConversionModel(params: { difficulty: RatiosRatesDifficulty }): ChainedConversionModel {
  const [kMin, kMax] = CHAIN_VALUE_RANGE_BY_DIFFICULTY[params.difficulty];
  // hard 난이도에서만 rate(비율 단위) 체인을 섞는다 — 분자·분모를 동시에 바꿔야 해서 더 어렵다.
  const useRate = params.difficulty === "hard" && randInt(0, 1) === 1;

  for (let attempt = 0; attempt < 100; attempt++) {
    if (!useRate) {
      const chain = LINEAR_CHAINS[randInt(0, LINEAR_CHAINS.length - 1)];
      const combined = chain.f1 * chain.f2; // unit0 1개 = combined개의 unit2.
      // combined = 1/d (d = 분모 정수). rawValue를 d의 배수로 골라 정답이 항상 정수가 되게 한다.
      const d = Math.round(1 / combined);
      const k = randInt(kMin, kMax);
      const rawValue = k * d;
      const correct = k; // rawValue * combined = k.
      if (!Number.isInteger(correct) || correct <= 0) continue;

      const onlyFirst = rawValue * chain.f1; // 두 번째 환산을 빠뜨림(중간 단위에서 멈춤).
      const onlySecond = rawValue * chain.f2; // 첫 번째 환산을 건너뛰고 두 번째 배율만 적용.
      const invertOneStep = rawValue * (1 / chain.f1) * chain.f2; // 한 단계에서 나누기 대신 곱하기(역수 사용).
      const wrongFactor = rawValue * chain.f1 * (chain.f2 * 0.9); // 두 번째 환산 계수를 부정확한(반올림된) 값으로 사용.
      const rawCandidates: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: onlyFirst, kind: "step_missing", reason: `${chain.unit0}에서 ${chain.unit2}까지 두 단계를 다 거치지 않고 첫 단계(${chain.unit0}→${chain.unit1})만 환산하고 멈췄다.` },
        { value: onlySecond, kind: "step_missing", reason: `첫 단계(${chain.unit0}→${chain.unit1}) 환산을 건너뛰고 두 번째 배율만 원래 값에 곱했다.` },
        { value: invertOneStep, kind: "formula_misuse", reason: `한 단계에서 나누어야 할 것을 반대로 곱해(역수를 사용해) 계산했다.` },
        { value: wrongFactor, kind: "unit_error", reason: `${chain.unit1}→${chain.unit2} 환산 계수를 정확한 값이 아니라 부정확하게(반올림해서) 사용했다.` },
      ];
      const candidates = rawCandidates.filter((c) => Number.isFinite(c.value) && c.value > 0);
      const seen = new Set<string>([fmt(correct)]);
      const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
      for (const cand of candidates) {
        if (distractors.length >= 3) break;
        const text = fmt(cand.value);
        if (seen.has(text)) continue;
        seen.add(text);
        distractors.push({ value: text, kind: cand.kind, reason: cand.reason });
      }
      if (distractors.length < 3) continue;
      return {
        skillCode: "ratios_rates_units", difficulty: params.difficulty, questionKind: "chained_conversion", mode: "linear",
        rawValue, unit0: chain.unit0, unit1: chain.unit1, unit2: chain.unit2, f1: chain.f1, f2: chain.f2,
        correctAnswer: fmt(correct), distractors,
      };
    }

    // rate 체인 — result = rawValue * numerFactor / denomFactor. reduce to 정수 답이 되도록
    // 기약분수 num/den을 구해 rawValue = k*den, correct = k*num.
    const chain = RATE_CHAINS[randInt(0, RATE_CHAINS.length - 1)];
    const scaleUp = 1000; // 소수 배율(1/5280 등)을 정수 분수로 바꾸기 위한 공통 배율.
    let num = Math.round(chain.numerFactor * scaleUp);
    let den = Math.round(chain.denomFactor * scaleUp);
    const g = gcd(num, den);
    num = num / g; den = den / g;
    const k = randInt(kMin, kMax);
    const rawValue = k * den;
    const correct = k * num;
    if (!Number.isInteger(correct) || correct <= 0 || !Number.isInteger(rawValue) || rawValue <= 0) continue;

    const onlyNumerator = rawValue * chain.numerFactor; // 분모(시간 등) 환산을 빠뜨림.
    const onlyDenominator = rawValue / chain.denomFactor; // 분자 환산을 빠뜨림.
    const multipliedBoth = rawValue * chain.numerFactor * chain.denomFactor; // 나눠야 할 곳도 곱함.
    const invertedDirection = rawValue * chain.denomFactor / chain.numerFactor; // 분자·분모 배율을 서로 바꿔(방향을 반대로) 적용.
    const rawCandidates: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: onlyNumerator, kind: "step_missing", reason: `분자 단위(${chain.unit1} 등) 환산만 적용하고 분모(시간) 단위 환산을 빠뜨렸다.` },
      { value: onlyDenominator, kind: "step_missing", reason: `분모(시간) 단위 환산만 적용하고 분자 단위 환산을 빠뜨렸다.` },
      { value: multipliedBoth, kind: "formula_misuse", reason: `분모 환산에서는 나누어야 하는데 분자와 마찬가지로 곱해버렸다.` },
      { value: invertedDirection, kind: "sign_error", reason: `분자·분모에 적용해야 할 배율을 서로 바꿔(환산 방향을 반대로) 적용했다.` },
    ];
    const candidates = rawCandidates.filter((c) => Number.isFinite(c.value) && c.value > 0);
    const seen = new Set<string>([fmt(correct)]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const cand of candidates) {
      if (distractors.length >= 3) break;
      const text = fmt(cand.value);
      if (seen.has(text)) continue;
      seen.add(text);
      distractors.push({ value: text, kind: cand.kind, reason: cand.reason });
    }
    if (distractors.length < 3) continue;
    return {
      skillCode: "ratios_rates_units", difficulty: params.difficulty, questionKind: "chained_conversion", mode: "rate",
      rawValue, unit0: chain.unit0, unit1: chain.unit1, unit2: chain.unit2, f1: chain.numerFactor, f2: chain.denomFactor,
      correctAnswer: fmt(correct), distractors,
    };
  }
  throw new Error("ratios_rates_units(chained_conversion): 오답 후보 생성에 실패했습니다.");
}

export function generateRatiosRatesModel(params: {
  difficulty: RatiosRatesDifficulty;
  questionKind?: RatiosRatesQuestionKind;
}): RatiosRatesModel {
  const kinds: RatiosRatesQuestionKind[] = ["proportion", "chained_conversion"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  if (questionKind === "chained_conversion") return generateChainedConversionModel({ difficulty: params.difficulty });
  return generateProportionModel({ difficulty: params.difficulty });
}

export function validateRatiosRatesModel(model: RatiosRatesModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };

  if (model.questionKind === "chained_conversion") {
    const expected = model.mode === "linear" ? model.rawValue * model.f1 * model.f2 : (model.rawValue * model.f1) / model.f2;
    if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "연쇄 단위환산 계산이 일치하지 않습니다." };
    return { ok: true };
  }

  if (model.a * model.x !== model.b * model.c) return { ok: false, reason: "비례식이 실제로 성립하지 않습니다." };
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

function shuffleOptions(correctAnswer: string, distractors: { value: string; kind: DistractorKind; reason: string }[]) {
  const options = [correctAnswer, ...distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 환산·비례식에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 값으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));
  return { shuffled, correctIndex, distractorRationales };
}

function renderChainedConversionProblem(model: ChainedConversionModel): CompiledMathProblem {
  let passage: string;
  let question: string;
  let explanation: string;
  let explanationEn: string;

  if (model.mode === "linear") {
    passage = `A length or amount is given below in ${model.unit0}.`;
    question = `${fmt(model.rawValue)} ${model.unit0} is equal to how many ${model.unit2}? (Shown as a chained unit conversion: ${model.unit0} → ${model.unit1} → ${model.unit2}.)`;
    const step1 = model.rawValue * model.f1;
    explanation = `먼저 ${model.unit0}를 ${model.unit1}로 바꾸면 ${fmt(model.rawValue)} × ${fmt(model.f1)} = ${fmt(step1)} ${model.unit1}이다. 이어서 ${model.unit1}를 ${model.unit2}로 바꾸면 ${fmt(step1)} × ${fmt(model.f2)} = ${model.correctAnswer} ${model.unit2}이다. 따라서 정답은 ${model.correctAnswer}이다.`;
    explanationEn = `First convert ${model.unit0} to ${model.unit1}: ${fmt(model.rawValue)} × ${fmt(model.f1)} = ${fmt(step1)} ${model.unit1}. Then convert ${model.unit1} to ${model.unit2}: ${fmt(step1)} × ${fmt(model.f2)} = ${model.correctAnswer} ${model.unit2}. So the answer is ${model.correctAnswer}.`;
  } else {
    passage = `A rate is given below in ${model.unit0}.`;
    question = `A speed of ${fmt(model.rawValue)} ${model.unit0} is equal to how many ${model.unit2}? (Convert both the numerator unit and the time unit.)`;
    const numerStep = model.rawValue * model.f1;
    explanation = `분자 단위를 먼저 바꾸면 ${fmt(model.rawValue)} × ${fmt(model.f1)} = ${fmt(numerStep)} ${model.unit1}/시간(원래 시간 단위)이다. 이어서 분모(시간) 단위를 바꾸면 ${fmt(numerStep)} ÷ ${fmt(model.f2)} = ${model.correctAnswer} ${model.unit2}이다. 분자·분모를 각각 다른 배율로 바꿔야 하므로 두 환산을 모두 거쳐야 한다. 따라서 정답은 ${model.correctAnswer}이다.`;
    explanationEn = `First convert the numerator unit: ${fmt(model.rawValue)} × ${fmt(model.f1)} = ${fmt(numerStep)} ${model.unit1} per original time unit. Then convert the time (denominator) unit: ${fmt(numerStep)} ÷ ${fmt(model.f2)} = ${model.correctAnswer} ${model.unit2}. Because the numerator and denominator units convert by different factors, both conversions are needed. So the answer is ${model.correctAnswer}.`;
  }

  const { shuffled, correctIndex, distractorRationales } = shuffleOptions(model.correctAnswer, model.distractors);
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}

function renderProportionProblem(model: ProportionModel): CompiledMathProblem {
  const passage = `The ratio of ${model.itemA} to ${model.itemB} is ${fmt(model.a)} to ${fmt(model.b)}. A recipe or plan uses ${fmt(model.c)} ${model.itemA} that follows this same ratio.`;
  const question = `Based on the ratio shown, how many ${model.itemB} are needed?`;

  const explanation = `비율 ${fmt(model.a)}:${fmt(model.b)} = ${fmt(model.c)}:x가 성립해야 하므로 x = ${fmt(model.c)}×${fmt(model.b)}÷${fmt(model.a)} = ${model.correctAnswer}이다.`;
  const explanationEn = `The proportion ${fmt(model.a)}:${fmt(model.b)} = ${fmt(model.c)}:x must hold, so x = ${fmt(model.c)}×${fmt(model.b)}÷${fmt(model.a)} = ${model.correctAnswer}.`;

  const { shuffled, correctIndex, distractorRationales } = shuffleOptions(model.correctAnswer, model.distractors);
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}

export function renderRatiosRatesProblem(model: RatiosRatesModel): CompiledMathProblem {
  if (model.questionKind === "chained_conversion") return renderChainedConversionProblem(model);
  return renderProportionProblem(model);
}
