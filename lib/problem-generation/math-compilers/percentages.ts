// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 두 번째 세부 기술:
// "Percentages". percent_of(p%의 n), find_whole(p%가 n이면 전체 x), percent_change
// (A에서 B로의 증감률) 세 문항 종류. AI를 전혀 부르지 않는다.
// 2026-09-17(제품 오너 medium 우선순위 2건 추가) — find_percent(퍼센트 역산: 부분·전체가
// 주어졌을 때 몇 %인지 역으로 구하기), compound_change(복합 퍼센트 변화: 두 번의 연속
// 증감을 합성한 전체 변화율/최종값). 둘 다 결정적 계산이며 AI를 호출하지 않는다.
import type { DistractorRationale, DistractorKind } from "../review";

export type PercentagesQuestionKind =
  | "percent_of"
  | "find_whole"
  | "percent_change"
  | "find_percent"
  | "compound_change";
export type PercentagesDifficulty = "easy" | "medium" | "hard";
export type CompoundChangeAskMode = "percent" | "value";

export type PercentagesModel = {
  skillCode: "percentages";
  difficulty: PercentagesDifficulty;
  questionKind: PercentagesQuestionKind;
  percent: number;
  base: number;
  original?: number;
  changed?: number;
  // find_percent 전용
  part?: number;
  whole?: number;
  // compound_change 전용
  sign1?: 1 | -1;
  percent1?: number;
  sign2?: 1 | -1;
  percent2?: number;
  askMode?: CompoundChangeAskMode;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const PERCENT_POOL_BY_DIFFICULTY: Record<PercentagesDifficulty, number[]> = {
  easy: [10, 20, 25, 50, 5],
  medium: [15, 30, 40, 60, 75, 8],
  hard: [12, 35, 45, 65, 85, 18],
};
const BASE_RANGE_BY_DIFFICULTY: Record<PercentagesDifficulty, number> = { easy: 20, medium: 15, hard: 25 };

function pickUnique(
  cands: { value: number; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    if (!Number.isFinite(c.value)) continue;
    const text = fmt(c.value);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ value: text, kind: c.kind, reason: c.reason });
  }
  return out;
}

export function generatePercentagesModel(params: {
  difficulty: PercentagesDifficulty;
  questionKind?: PercentagesQuestionKind;
}): PercentagesModel {
  const kinds: PercentagesQuestionKind[] = [
    "percent_of",
    "find_whole",
    "percent_change",
    "find_percent",
    "compound_change",
  ];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  const percentPool = PERCENT_POOL_BY_DIFFICULTY[params.difficulty];
  const baseRange = BASE_RANGE_BY_DIFFICULTY[params.difficulty];

  for (let attempt = 0; attempt < 50; attempt++) {
    const percent = percentPool[randInt(0, percentPool.length - 1)];

    if (questionKind === "percent_of") {
      const base = randInt(2, baseRange) * 20;
      const result = (percent * base) / 100;
      if (!Number.isInteger(result)) continue;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: percent * base, kind: "unit_error", reason: "%를 소수로 바꾸지 않고(÷100 생략) 그대로 곱했다." },
        { value: base - result, kind: "condition_ignored", reason: "p%에 해당하는 값이 아니라 (100-p)%에 해당하는 값을 답했다." },
        { value: (percent * base) / 1000, kind: "unit_error", reason: "%를 100이 아니라 1000으로 나누어 소수점 자리를 잘못 옮겼다." },
      ];
      const distractors = pickUnique(cands, fmt(result));
      if (distractors.length < 3) continue;
      return { skillCode: "percentages", difficulty: params.difficulty, questionKind, percent, base, correctAnswer: fmt(result), distractors };
    }

    if (questionKind === "find_whole") {
      const whole = randInt(2, baseRange) * 20;
      const part = (percent * whole) / 100;
      if (!Number.isInteger(part) || part === 0) continue;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: (part * 100) / percent / 100, kind: "unit_error", reason: "%를 소수로 바꾸는 과정에서 100을 한 번 더 나누었다." },
        { value: part + percent, kind: "formula_misuse", reason: "part÷percent 비율 계산 대신 part에 percent 값을 그대로 더했다." },
        { value: (part * (100 - percent)) / 100, kind: "condition_ignored", reason: "전체를 구하는 대신 나머지 (100-p)%에 해당하는 부분을 계산했다." },
      ];
      const distractors = pickUnique(cands, fmt(whole));
      if (distractors.length < 3) continue;
      return { skillCode: "percentages", difficulty: params.difficulty, questionKind, percent, base: part, original: whole, correctAnswer: fmt(whole), distractors };
    }

    if (questionKind === "percent_change") {
      const original = randInt(2, baseRange) * 20;
      const isIncrease = randInt(0, 1) === 1;
      const delta = (percent * original) / 100;
      if (!Number.isInteger(delta)) continue;
      const changed = isIncrease ? original + delta : original - delta;
      if (changed <= 0) continue;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: (delta / changed) * 100, kind: "condition_ignored", reason: "증감률을 원래 값이 아니라 바뀐 값을 기준(base)으로 계산했다." },
        { value: 100 - percent, kind: "formula_misuse", reason: "증감률 대신 (100-변화율)%를 답으로 썼다." },
        { value: isIncrease ? -percent : percent, kind: "sign_error", reason: "증가·감소 방향의 부호를 반대로 판단했다." },
      ];
      const distractors = pickUnique(cands, fmt(percent));
      if (distractors.length < 3) continue;
      return {
        skillCode: "percentages", difficulty: params.difficulty, questionKind, percent, base: original, original, changed,
        correctAnswer: fmt(percent), distractors,
      };
    }

    if (questionKind === "find_percent") {
      const whole = randInt(2, baseRange) * 20;
      const part = (percent * whole) / 100;
      if (!Number.isInteger(part) || part === 0 || whole - part === 0) continue;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: (whole / part) * 100, kind: "formula_misuse", reason: "부분÷전체 대신 전체÷부분으로 비율을 뒤집어 계산했다(part와 whole을 바꿔 나눴다)." },
        { value: part / whole, kind: "unit_error", reason: "비율을 퍼센트로 바꾸려면 100을 곱해야 하는데 곱하지 않고 소수값을 그대로 답했다." },
        { value: percent * 10, kind: "unit_error", reason: "100을 곱하는 과정에서 소수점 자리를 한 칸 더 옮겨(×10) 실제보다 10배 큰 값을 답했다." },
        { value: (part / (whole - part)) * 100, kind: "condition_ignored", reason: "전체(whole)가 아니라 '부분을 제외한 나머지(whole-part)'를 기준으로 비율을 계산했다(문맥상 잘못된 기준값 사용)." },
      ];
      const distractors = pickUnique(cands, fmt(percent));
      if (distractors.length < 3) continue;
      return {
        skillCode: "percentages", difficulty: params.difficulty, questionKind, percent, base: part, part, whole,
        correctAnswer: fmt(percent), distractors,
      };
    }

    // compound_change
    {
      const percentPoolSmall = params.difficulty === "easy" ? [4, 5, 8, 10] : params.difficulty === "medium" ? [4, 5, 8, 10, 12, 14] : [4, 6, 8, 12, 14, 16, 18];
      const percent1 = percentPoolSmall[randInt(0, percentPoolSmall.length - 1)];
      const percent2 = percentPoolSmall[randInt(0, percentPoolSmall.length - 1)];
      const sign1: 1 | -1 = randInt(0, 1) === 1 ? 1 : -1;
      const sign2: 1 | -1 = randInt(0, 1) === 1 ? 1 : -1;
      const askMode: CompoundChangeAskMode = randInt(0, 1) === 1 ? "value" : "percent";
      const original = randInt(2, baseRange) * 10000;

      const mult1 = 1 + (sign1 * percent1) / 100;
      const mult2 = 1 + (sign2 * percent2) / 100;
      const overallMultiplier = mult1 * mult2;
      const final = original * overallMultiplier;
      const overallPercent = (overallMultiplier - 1) * 100;
      if (!Number.isInteger(final)) continue;
      if (Math.abs(overallPercent) < 0.01) continue; // 순변화 0%는 문항으로 부적절

      const correctValue = askMode === "value" ? final : overallPercent;
      if (askMode === "percent" && fmt(overallPercent) === "0") continue;

      const additivePercent = sign1 * percent1 + sign2 * percent2;
      const additiveValue = original * (1 + additivePercent / 100);
      const multWrongSignFlip = mult1 * (1 + (-sign2 * percent2) / 100);
      const onlyFirstValue = original * mult1;
      const onlyFirstPercent = sign1 * percent1;
      const onlySecondValue = original * mult2;
      const onlySecondPercent = sign2 * percent2;

      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        {
          value: askMode === "value" ? additiveValue : additivePercent,
          kind: "formula_misuse",
          reason: "두 변화율을 곱해서 합성(복리처럼 연속 적용)하지 않고 단순히 더하거나 뺐다. 이는 두 변화를 원래 값에 각각 독립적으로 적용해 더한 것, 또는 두 번째 변화율을 첫 번째 변화 이후 값이 아니라 원래 값 기준으로 적용한 것과 같은 결과다.",
        },
        {
          value: askMode === "value" ? original * multWrongSignFlip : (multWrongSignFlip - 1) * 100,
          kind: "sign_error",
          reason: "두 번째 변화(감소 또는 증가)의 부호를 반대로 적용했다(감소를 증가로, 또는 증가를 감소로 착각했다).",
        },
        {
          value: askMode === "value" ? onlyFirstValue : onlyFirstPercent,
          kind: "step_missing",
          reason: "첫 번째 변화만 적용하고 두 번째 변화를 반영하지 않은 채 답했다(2단계 중 1단계 누락).",
        },
        {
          value: askMode === "value" ? onlySecondValue : onlySecondPercent,
          kind: "step_missing",
          reason: "두 번째 변화만 적용하고 첫 번째 변화를 반영하지 않은 채 답했다(2단계 중 1단계 누락).",
        },
      ];
      const distractors = pickUnique(cands, fmt(correctValue));
      if (distractors.length < 3) continue;
      return {
        skillCode: "percentages",
        difficulty: params.difficulty,
        questionKind,
        percent: percent1,
        base: original,
        original,
        changed: final,
        sign1,
        percent1,
        sign2,
        percent2,
        askMode,
        correctAnswer: fmt(correctValue),
        distractors,
      };
    }
  }
  throw new Error("percentages: 오답 후보 생성에 실패했습니다.");
}

export function validatePercentagesModel(model: PercentagesModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "percent_of") {
    if (fmt((model.percent * model.base) / 100) !== model.correctAnswer) return { ok: false, reason: "percent_of 계산이 일치하지 않습니다." };
  } else if (model.questionKind === "find_whole") {
    if (model.original === undefined) return { ok: false, reason: "전체 값이 없습니다." };
    if (fmt((model.percent * model.original) / 100) !== fmt(model.base)) return { ok: false, reason: "find_whole 계산이 일치하지 않습니다." };
  } else if (model.questionKind === "percent_change") {
    if (model.original === undefined || model.changed === undefined) return { ok: false, reason: "원래/변화 값이 없습니다." };
    const expected = (Math.abs(model.changed - model.original) / model.original) * 100;
    if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "percent_change 계산이 일치하지 않습니다." };
  } else if (model.questionKind === "find_percent") {
    if (model.part === undefined || model.whole === undefined) return { ok: false, reason: "부분/전체 값이 없습니다." };
    if (fmt((model.part / model.whole) * 100) !== model.correctAnswer) return { ok: false, reason: "find_percent 계산이 일치하지 않습니다." };
  } else {
    // compound_change
    if (
      model.original === undefined ||
      model.changed === undefined ||
      model.sign1 === undefined ||
      model.percent1 === undefined ||
      model.sign2 === undefined ||
      model.percent2 === undefined ||
      model.askMode === undefined
    ) {
      return { ok: false, reason: "compound_change에 필요한 값이 없습니다." };
    }
    const mult1 = 1 + (model.sign1 * model.percent1) / 100;
    const mult2 = 1 + (model.sign2 * model.percent2) / 100;
    const overallMultiplier = mult1 * mult2;
    const expected = model.askMode === "value" ? model.original * overallMultiplier : (overallMultiplier - 1) * 100;
    if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "compound_change 계산이 일치하지 않습니다." };
    if (model.askMode === "value" && fmt(model.original * overallMultiplier) !== fmt(model.changed)) {
      return { ok: false, reason: "compound_change 최종값(changed)이 일치하지 않습니다." };
    }
  }
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

export function renderPercentagesProblem(model: PercentagesModel): CompiledMathProblem {
  let passage: string;
  let question: string;
  let explanation: string;
  let explanationEn: string;

  if (model.questionKind === "percent_of") {
    passage = `A store has ${fmt(model.base)} items in stock.`;
    question = `What is ${fmt(model.percent)}% of ${fmt(model.base)}?`;
    explanation = `${fmt(model.percent)}%는 소수로 ${fmt(model.percent)}÷100 = ${fmt(model.percent / 100)}이므로, ${fmt(model.base)}×${fmt(model.percent / 100)} = ${model.correctAnswer}이다.`;
    explanationEn = `${fmt(model.percent)}% as a decimal is ${fmt(model.percent)}÷100 = ${fmt(model.percent / 100)}, so ${fmt(model.base)}×${fmt(model.percent / 100)} = ${model.correctAnswer}.`;
  } else if (model.questionKind === "find_whole") {
    passage = `${fmt(model.percent)}% of a number is ${fmt(model.base)}.`;
    question = "What is the number?";
    explanation = `x×${fmt(model.percent)}÷100 = ${fmt(model.base)}이므로 x = ${fmt(model.base)}×100÷${fmt(model.percent)} = ${model.correctAnswer}이다.`;
    explanationEn = `x×${fmt(model.percent)}÷100 = ${fmt(model.base)}, so x = ${fmt(model.base)}×100÷${fmt(model.percent)} = ${model.correctAnswer}.`;
  } else if (model.questionKind === "percent_change") {
    const direction = model.changed! > model.original! ? "increased" : "decreased";
    passage = `A quantity ${direction} from ${fmt(model.original!)} to ${fmt(model.changed!)}.`;
    question = "By what percent did the quantity change (as a positive number)?";
    const delta = Math.abs(model.changed! - model.original!);
    explanation = `변화량은 |${fmt(model.changed!)} - ${fmt(model.original!)}| = ${fmt(delta)}이고, 변화율은 항상 원래 값을 기준으로 하므로 ${fmt(delta)}÷${fmt(model.original!)}×100 = ${model.correctAnswer}%이다.`;
    explanationEn = `The change is |${fmt(model.changed!)} - ${fmt(model.original!)}| = ${fmt(delta)}. Percent change is always relative to the original value, so ${fmt(delta)}÷${fmt(model.original!)}×100 = ${model.correctAnswer}%.`;
  } else if (model.questionKind === "find_percent") {
    const part = model.part!;
    const whole = model.whole!;
    passage = `Out of a total of ${fmt(whole)}, ${fmt(part)} belong to a certain group.`;
    question = `${fmt(part)} is what percent of ${fmt(whole)}?`;
    explanation = `구하는 값은 부분÷전체×100이므로 ${fmt(part)}÷${fmt(whole)}×100 = ${model.correctAnswer}%이다. 기준(전체)이 되는 값은 항상 whole이며, part가 아니다.`;
    explanationEn = `The value is part÷whole×100, so ${fmt(part)}÷${fmt(whole)}×100 = ${model.correctAnswer}%. The base (whole) is always the denominator, never the part.`;
  } else {
    // compound_change
    const sign1 = model.sign1!;
    const percent1 = model.percent1!;
    const sign2 = model.sign2!;
    const percent2 = model.percent2!;
    const original = model.original!;
    const dir1 = sign1 === 1 ? "increases" : "decreases";
    const dir2 = sign2 === 1 ? "increases" : "decreases";
    const mult1 = 1 + (sign1 * percent1) / 100;
    const changed1 = original * mult1;
    const final = model.changed!;
    passage = `A value of ${fmt(original)} first ${dir1} by ${fmt(percent1)}%, and then ${dir2} by ${fmt(percent2)}%.`;
    if (model.askMode === "value") {
      question = "What is the final value after both changes?";
    } else {
      question = "What is the overall percent change from the original value? (Use a positive number for an overall increase and a negative number for an overall decrease.)";
    }
    explanation =
      `두 변화는 독립적으로 더하는 것이 아니라 순서대로 곱해서 합성해야 한다. ` +
      `1단계: ${fmt(original)}×(1${sign1 === 1 ? "+" : "-"}${fmt(percent1)}÷100) = ${fmt(changed1)}. ` +
      `2단계: ${fmt(changed1)}×(1${sign2 === 1 ? "+" : "-"}${fmt(percent2)}÷100) = ${fmt(final)}. ` +
      (model.askMode === "value"
        ? `따라서 최종값은 ${model.correctAnswer}이다.`
        : `따라서 전체 변화율은 (${fmt(final)}÷${fmt(original)}-1)×100 = ${model.correctAnswer}%이다.`);
    explanationEn =
      `The two changes must be composed by multiplying in sequence, not added independently. ` +
      `Step 1: ${fmt(original)}×(1${sign1 === 1 ? "+" : "-"}${fmt(percent1)}÷100) = ${fmt(changed1)}. ` +
      `Step 2: ${fmt(changed1)}×(1${sign2 === 1 ? "+" : "-"}${fmt(percent2)}÷100) = ${fmt(final)}. ` +
      (model.askMode === "value"
        ? `So the final value is ${model.correctAnswer}.`
        : `So the overall percent change is (${fmt(final)}÷${fmt(original)}-1)×100 = ${model.correctAnswer}%.`);
  }

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 문제에서 나올 수 있는 실제 퍼센트 계산 오류다.",
    matches: "같은 수치로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
