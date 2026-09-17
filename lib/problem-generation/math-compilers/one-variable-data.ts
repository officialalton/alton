// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 세 번째 세부 기술:
// "One-variable data: distributions and measures of center and spread". 정수 목록에서
// mean/median/range를 묻는다. AI를 전혀 부르지 않는다.
import type { DistractorRationale, DistractorKind } from "../review";

export type OneVarDataQuestionKind = "mean" | "median" | "range";
export type OneVarDataDifficulty = "easy" | "medium" | "hard";

export type OneVarDataModel = {
  skillCode: "one_variable_data";
  difficulty: OneVarDataDifficulty;
  questionKind: OneVarDataQuestionKind;
  values: number[];
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const SIZE_BY_DIFFICULTY: Record<OneVarDataDifficulty, number> = { easy: 5, medium: 7, hard: 9 };
const RANGE_BY_DIFFICULTY: Record<OneVarDataDifficulty, number> = { easy: 20, medium: 40, hard: 60 };

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

export function generateOneVarDataModel(params: {
  difficulty: OneVarDataDifficulty;
  questionKind?: OneVarDataQuestionKind;
}): OneVarDataModel {
  const kinds: OneVarDataQuestionKind[] = ["mean", "median", "range"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  const size = SIZE_BY_DIFFICULTY[params.difficulty]; // 항상 홀수 — 중앙값이 목록 값 하나로 딱 떨어지게.
  const range = RANGE_BY_DIFFICULTY[params.difficulty];

  for (let attempt = 0; attempt < 50; attempt++) {
    const values: number[] = [];
    for (let i = 0; i < size; i++) values.push(randInt(0, range));
    const sorted = [...values].sort((x, y) => x - y);
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / size;
    const median = sorted[(size - 1) / 2];
    const rangeVal = sorted[size - 1] - sorted[0];

    if (questionKind === "mean") {
      if (!Number.isInteger(mean)) continue;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: median, kind: "condition_ignored", reason: "평균이 아니라 중앙값을 답으로 썼다(평균·중앙값 혼동)." },
        { value: sum / (size - 1), kind: "formula_misuse", reason: "합을 개수보다 하나 적은 값으로 나누었다." },
        { value: sum, kind: "unit_error", reason: "합계를 개수로 나누는 것을 잊고 총합을 그대로 답했다." },
        { value: sorted[size - 1], kind: "condition_ignored", reason: "평균 대신 데이터의 최댓값을 답으로 썼다." },
      ];
      const distractors = pickUnique(cands, fmt(mean));
      if (distractors.length < 3) continue;
      return { skillCode: "one_variable_data", difficulty: params.difficulty, questionKind, values, correctAnswer: fmt(mean), distractors };
    }

    if (questionKind === "median") {
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: Math.round(mean), kind: "condition_ignored", reason: "중앙값이 아니라 평균을 답으로 썼다(평균·중앙값 혼동)." },
        { value: values[Math.floor(size / 2)], kind: "step_missing", reason: "정렬하지 않은 원래 순서에서 가운데 위치의 값을 그대로 답했다." },
        { value: sorted[size - 2], kind: "step_missing", reason: "가운데 값이 아니라 그 옆 값을 답했다." },
        { value: sorted[1], kind: "step_missing", reason: "가운데 값이 아니라 앞쪽의 다른 값을 답했다." },
      ];
      const distractors = pickUnique(cands, fmt(median));
      if (distractors.length < 3) continue;
      return { skillCode: "one_variable_data", difficulty: params.difficulty, questionKind, values, correctAnswer: fmt(median), distractors };
    }

    // range
    if (rangeVal === 0) continue;
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: sorted[0] - sorted[size - 1], kind: "sign_error", reason: "최댓값에서 최솟값을 빼지 않고 반대로 빼서 부호가 반대가 됐다." },
      { value: sorted[size - 1], kind: "condition_ignored", reason: "범위가 아니라 최댓값 자체를 답으로 썼다." },
      { value: mean, kind: "condition_ignored", reason: "범위가 아니라 평균을 답으로 썼다." },
      { value: sorted[size - 1] + sorted[0], kind: "formula_misuse", reason: "최댓값과 최솟값을 빼지 않고 더했다." },
    ];
    const distractors = pickUnique(cands, fmt(rangeVal));
    if (distractors.length < 3) continue;
    return { skillCode: "one_variable_data", difficulty: params.difficulty, questionKind, values, correctAnswer: fmt(rangeVal), distractors };
  }
  throw new Error("one_variable_data: 오답 후보 생성에 실패했습니다.");
}

export function validateOneVarDataModel(model: OneVarDataModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  const sorted = [...model.values].sort((x, y) => x - y);
  const sum = model.values.reduce((s, v) => s + v, 0);
  if (model.questionKind === "mean" && fmt(sum / model.values.length) !== model.correctAnswer) return { ok: false, reason: "평균 계산이 일치하지 않습니다." };
  if (model.questionKind === "median" && fmt(sorted[(sorted.length - 1) / 2]) !== model.correctAnswer) return { ok: false, reason: "중앙값 계산이 일치하지 않습니다." };
  if (model.questionKind === "range" && fmt(sorted[sorted.length - 1] - sorted[0]) !== model.correctAnswer) return { ok: false, reason: "범위 계산이 일치하지 않습니다." };
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

const QUESTION_TEXT: Record<OneVarDataQuestionKind, string> = {
  mean: "What is the mean of the data set shown?",
  median: "What is the median of the data set shown?",
  range: "What is the range of the data set shown?",
};

export function renderOneVarDataProblem(model: OneVarDataModel): CompiledMathProblem {
  const passage = `A data set contains the following values.\n\n${model.values.join(", ")}`;
  const question = QUESTION_TEXT[model.questionKind];
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const sorted = [...model.values].sort((x, y) => x - y);
  const sum = model.values.reduce((s, v) => s + v, 0);
  let explanation: string;
  let explanationEn: string;
  if (model.questionKind === "mean") {
    explanation = `모든 값의 합은 ${sum}이고 값의 개수는 ${model.values.length}개이므로, 평균은 ${sum}÷${model.values.length} = ${model.correctAnswer}이다.`;
    explanationEn = `The sum of all values is ${sum} and there are ${model.values.length} values, so the mean is ${sum}÷${model.values.length} = ${model.correctAnswer}.`;
  } else if (model.questionKind === "median") {
    explanation = `값을 크기순으로 정렬하면 ${sorted.join(", ")}이고, 개수가 ${model.values.length}개(홀수)이므로 정가운데 값이 중앙값이다. 따라서 중앙값은 ${model.correctAnswer}이다.`;
    explanationEn = `Sorting the values gives ${sorted.join(", ")}. Since there are ${model.values.length} values (odd), the median is the middle value: ${model.correctAnswer}.`;
  } else {
    explanation = `최댓값은 ${sorted[sorted.length - 1]}이고 최솟값은 ${sorted[0]}이므로, 범위는 ${sorted[sorted.length - 1]} - ${sorted[0]} = ${model.correctAnswer}이다.`;
    explanationEn = `The maximum is ${sorted[sorted.length - 1]} and the minimum is ${sorted[0]}, so the range is ${sorted[sorted.length - 1]} - ${sorted[0]} = ${model.correctAnswer}.`;
  }

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 데이터에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 데이터 집합으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
