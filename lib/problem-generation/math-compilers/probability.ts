// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 다섯 번째 세부 기술:
// "Probability and conditional probability". 2×2 분할표에서 단순확률·조건부확률을
// 묻거나, 비복원추출 2회 연속 사건의 확률을 묻는다. AI를 전혀 부르지 않는다.
import type { DistractorRationale, DistractorKind } from "../review";

export type ProbabilityQuestionKind = "simple" | "conditional" | "sequential_without_replacement";
export type ProbabilityDifficulty = "easy" | "medium" | "hard";

export type ProbabilityModel = {
  skillCode: "probability";
  difficulty: ProbabilityDifficulty;
  questionKind: ProbabilityQuestionKind;
  // simple/conditional: 2×2 표.
  rowLabels?: [string, string];
  colLabels?: [string, string];
  table?: [[number, number], [number, number]];
  targetRow?: 0 | 1;
  targetCol?: 0 | 1;
  // sequential_without_replacement: 항아리에서 성공 s개, 전체 n개, 연속 2회 뽑기.
  success?: number;
  total?: number;
  correctAnswer: string; // 기약분수 "a/b" 문자열.
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function frac(num: number, den: number): string {
  if (num === 0) return "0";
  const g = gcd(Math.abs(num), Math.abs(den));
  return `${num / g}/${den / g}`;
}

const CELL_RANGE_BY_DIFFICULTY: Record<ProbabilityDifficulty, [number, number]> = {
  easy: [4, 12], medium: [6, 16], hard: [8, 20],
};

const CONTEXTS: { rowLabels: [string, string]; colLabels: [string, string] }[] = [
  { rowLabels: ["Freshman", "Senior"], colLabels: ["Owns a bike", "Does not own a bike"] },
  { rowLabels: ["Left-handed", "Right-handed"], colLabels: ["Plays piano", "Does not play piano"] },
];

function rowTotal(table: [[number, number], [number, number]], r: 0 | 1): number {
  return table[r][0] + table[r][1];
}
function grandTotal(table: [[number, number], [number, number]]): number {
  return table[0][0] + table[0][1] + table[1][0] + table[1][1];
}
function renderTable(rowLabels: [string, string], colLabels: [string, string], table: [[number, number], [number, number]]): string {
  return [
    `| | ${colLabels[0]} | ${colLabels[1]} | Total |`,
    `| ${rowLabels[0]} | ${table[0][0]} | ${table[0][1]} | ${rowTotal(table, 0)} |`,
    `| ${rowLabels[1]} | ${table[1][0]} | ${table[1][1]} | ${rowTotal(table, 1)} |`,
    `| Total | ${table[0][0] + table[1][0]} | ${table[0][1] + table[1][1]} | ${grandTotal(table)} |`,
  ].join("\n");
}

function pickUniqueFrac(
  cands: { num: number; den: number; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    if (!Number.isFinite(c.num) || !Number.isFinite(c.den) || c.den === 0) continue;
    const text = frac(c.num, c.den);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ value: text, kind: c.kind, reason: c.reason });
  }
  return out;
}

export function generateProbabilityModel(params: {
  difficulty: ProbabilityDifficulty;
  questionKind?: ProbabilityQuestionKind;
}): ProbabilityModel {
  const kinds: ProbabilityQuestionKind[] = ["simple", "conditional", "sequential_without_replacement"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  const [min, max] = CELL_RANGE_BY_DIFFICULTY[params.difficulty];

  if (questionKind === "sequential_without_replacement") {
    for (let attempt = 0; attempt < 50; attempt++) {
      const total = randInt(min + 3, max + 6);
      const success = randInt(2, total - 2);
      const num = success * (success - 1);
      const den = total * (total - 1);
      if (num === 0) continue;
      const cands: { num: number; den: number; kind: DistractorKind; reason: string }[] = [
        { num: success * success, den: total * total, kind: "condition_ignored", reason: "비복원추출인데 복원추출(독립사건)처럼 두 번 다 같은 분모를 썼다." },
        { num: success, den: total, kind: "formula_misuse", reason: "두 번 연속 뽑을 확률이 아니라 한 번 뽑을 확률만 계산했다." },
        { num: success * (success - 1), den: total * total, kind: "condition_ignored", reason: "분자는 비복원(두 번째 시행에서 하나 줄임)으로 계산했지만 분모는 줄이지 않았다." },
      ];
      const distractors = pickUniqueFrac(cands, frac(num, den));
      if (distractors.length < 3) continue;
      return { skillCode: "probability", difficulty: params.difficulty, questionKind, success, total, correctAnswer: frac(num, den), distractors };
    }
    throw new Error("probability(sequential_without_replacement): 생성 실패");
  }

  const { rowLabels, colLabels } = CONTEXTS[randInt(0, CONTEXTS.length - 1)];
  for (let attempt = 0; attempt < 50; attempt++) {
    const table: [[number, number], [number, number]] = [
      [randInt(min, max), randInt(min, max)],
      [randInt(min, max), randInt(min, max)],
    ];
    const targetRow: 0 | 1 = randInt(0, 1) as 0 | 1;
    const targetCol: 0 | 1 = randInt(0, 1) as 0 | 1;

    if (questionKind === "simple") {
      const num = table[targetRow][targetCol];
      const den = grandTotal(table);
      const cands: { num: number; den: number; kind: DistractorKind; reason: string }[] = [
        { num, den: rowTotal(table, targetRow), kind: "condition_ignored", reason: "표 전체가 아니라 해당 행만을 분모로 써서 조건부확률과 혼동했다." },
        { num: table[targetRow][1 - targetCol], den: grandTotal(table), kind: "axis_misread", reason: "같은 행의 반대 열 값을 분자로 썼다." },
        { num: rowTotal(table, targetRow), den: grandTotal(table), kind: "condition_ignored", reason: "칸 값이 아니라 행 전체 값을 분자로 썼다." },
      ];
      const distractors = pickUniqueFrac(cands, frac(num, den));
      if (distractors.length < 3) continue;
      return { skillCode: "probability", difficulty: params.difficulty, questionKind, rowLabels, colLabels, table, targetRow, targetCol, correctAnswer: frac(num, den), distractors };
    }

    // conditional: P(targetCol | targetRow)
    const rTotal = rowTotal(table, targetRow);
    if (rTotal === 0) continue;
    const num = table[targetRow][targetCol];
    const den = rTotal;
    const cands: { num: number; den: number; kind: DistractorKind; reason: string }[] = [
      { num, den: grandTotal(table), kind: "condition_ignored", reason: "조건부확률인데 조건(해당 행)이 아니라 표 전체를 분모로 썼다." },
      { num: table[targetRow][1 - targetCol], den: rTotal, kind: "axis_misread", reason: "같은 행에서 반대 열의 확률을 답했다." },
      { num, den: table[0][targetCol] + table[1][targetCol], kind: "axis_misread", reason: "행 기준이 아니라 열 기준(해당 열의 합)을 분모로 썼다." },
    ];
    const distractors = pickUniqueFrac(cands, frac(num, den));
    if (distractors.length < 3) continue;
    return { skillCode: "probability", difficulty: params.difficulty, questionKind, rowLabels, colLabels, table, targetRow, targetCol, correctAnswer: frac(num, den), distractors };
  }
  throw new Error("probability: 오답 후보 생성에 실패했습니다.");
}

export function validateProbabilityModel(model: ProbabilityModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "sequential_without_replacement") {
    if (model.success === undefined || model.total === undefined) return { ok: false, reason: "성공/전체 개수가 없습니다." };
    const expected = frac(model.success * (model.success - 1), model.total * (model.total - 1));
    if (expected !== model.correctAnswer) return { ok: false, reason: "비복원추출 확률 계산이 일치하지 않습니다." };
    return { ok: true };
  }
  if (!model.table || model.targetRow === undefined || model.targetCol === undefined) return { ok: false, reason: "표 데이터가 없습니다." };
  if (model.questionKind === "simple") {
    const expected = frac(model.table[model.targetRow][model.targetCol], grandTotal(model.table));
    if (expected !== model.correctAnswer) return { ok: false, reason: "단순확률 계산이 일치하지 않습니다." };
  } else {
    const expected = frac(model.table[model.targetRow][model.targetCol], rowTotal(model.table, model.targetRow));
    if (expected !== model.correctAnswer) return { ok: false, reason: "조건부확률 계산이 일치하지 않습니다." };
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

export function renderProbabilityProblem(model: ProbabilityModel): CompiledMathProblem {
  let passage: string;
  let question: string;
  let explanation: string;
  let explanationEn: string;

  if (model.questionKind === "sequential_without_replacement") {
    passage = `A bag contains ${model.total} marbles, of which ${model.success} are red. Two marbles are drawn at random, one after another, without putting the first one back.`;
    question = "What is the probability that both marbles drawn are red?";
    explanation = `첫 번째로 빨간 구슬을 뽑을 확률은 ${model.success}/${model.total}이다. 첫 번째 구슬을 다시 넣지 않으므로(비복원), 두 번째로 빨간 구슬을 뽑을 확률은 ${model.success! - 1}/${model.total! - 1}이 된다. 두 확률을 곱하면 (${model.success}/${model.total})×(${model.success! - 1}/${model.total! - 1}) = ${model.correctAnswer}이다.`;
    explanationEn = `The probability the first marble is red is ${model.success}/${model.total}. Since the first marble is not replaced, the probability the second is also red becomes ${model.success! - 1}/${model.total! - 1}. Multiplying gives (${model.success}/${model.total})×(${model.success! - 1}/${model.total! - 1}) = ${model.correctAnswer}.`;
  } else {
    const table = model.table!;
    const rowLabels = model.rowLabels!;
    const colLabels = model.colLabels!;
    const targetRow = model.targetRow!;
    const targetCol = model.targetCol!;
    passage = `The two-way table shows the results of a survey.\n\n${renderTable(rowLabels, colLabels, table)}`;
    if (model.questionKind === "simple") {
      question = `If one person is selected at random from those surveyed, what is the probability that the person is "${rowLabels[targetRow]}" and "${colLabels[targetCol]}"?`;
      const num = table[targetRow][targetCol];
      const den = grandTotal(table);
      explanation = `전체 인원은 ${den}명이고, 그중 "${rowLabels[targetRow]}"이면서 "${colLabels[targetCol]}"인 사람은 ${num}명이다. 따라서 확률은 ${num}/${den} = ${model.correctAnswer}이다.`;
      explanationEn = `There are ${den} people total, and ${num} of them are both "${rowLabels[targetRow]}" and "${colLabels[targetCol]}". So the probability is ${num}/${den} = ${model.correctAnswer}.`;
    } else {
      question = `If one person is selected at random from those who are "${rowLabels[targetRow]}", what is the probability that the person is also "${colLabels[targetCol]}"?`;
      const num = table[targetRow][targetCol];
      const den = rowTotal(table, targetRow);
      explanation = `조건부확률이므로 분모는 표 전체가 아니라 "${rowLabels[targetRow]}"인 사람 수(${den}명)이고, 그중 "${colLabels[targetCol]}"인 사람은 ${num}명이다. 따라서 확률은 ${num}/${den} = ${model.correctAnswer}이다.`;
      explanationEn = `Since this is a conditional probability, the base is not the whole table but only the "${rowLabels[targetRow]}" group (${den} people), of whom ${num} are also "${colLabels[targetCol]}". So the probability is ${num}/${den} = ${model.correctAnswer}.`;
    }
  }

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 상황에서 나올 수 있는 실제 확률 계산 오류다.",
    matches: "같은 수치로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
