// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 네 번째 세부 기술:
// "Two-variable data: two-way frequency tables". 2×2 분할표에서 특정 칸·행/열 합·
// 조건부 비율을 읽는다. AI를 전혀 부르지 않는다 — 표 값·정답·오답을 전부 코드로 계산한다.
import type { DistractorRationale, DistractorKind } from "../review";
import type { DataSpec } from "@/lib/problem-figures/templates/data";

export type TwoVarDataQuestionKind = "cell" | "row_total" | "conditional_share";
export type TwoVarDataDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — 2×2 표: rows=[R1,R2], cols=[C1,C2]. table[row][col]. */
export type TwoVarDataModel = {
  skillCode: "two_variable_data";
  difficulty: TwoVarDataDifficulty;
  questionKind: TwoVarDataQuestionKind;
  rowLabels: [string, string];
  colLabels: [string, string];
  table: [[number, number], [number, number]];
  targetRow: 0 | 1;
  targetCol: 0 | 1;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const CELL_RANGE_BY_DIFFICULTY: Record<TwoVarDataDifficulty, [number, number]> = {
  easy: [10, 30],
  medium: [15, 45],
  hard: [20, 60],
};

const CONTEXTS: { rowLabels: [string, string]; colLabels: [string, string] }[] = [
  { rowLabels: ["Grade 11", "Grade 12"], colLabels: ["Plays a sport", "Does not play a sport"] },
  { rowLabels: ["Male", "Female"], colLabels: ["Prefers tea", "Prefers coffee"] },
  { rowLabels: ["Owns a car", "Does not own a car"], colLabels: ["Lives in the city", "Lives outside the city"] },
];

function rowTotal(table: [[number, number], [number, number]], r: 0 | 1): number {
  return table[r][0] + table[r][1];
}
function colTotal(table: [[number, number], [number, number]], c: 0 | 1): number {
  return table[0][c] + table[1][c];
}
function grandTotal(table: [[number, number], [number, number]]): number {
  return table[0][0] + table[0][1] + table[1][0] + table[1][1];
}

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

export function generateTwoVarDataModel(params: {
  difficulty: TwoVarDataDifficulty;
  questionKind?: TwoVarDataQuestionKind;
}): TwoVarDataModel {
  const kinds: TwoVarDataQuestionKind[] = ["cell", "row_total", "conditional_share"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  const [min, max] = CELL_RANGE_BY_DIFFICULTY[params.difficulty];
  const { rowLabels, colLabels } = CONTEXTS[randInt(0, CONTEXTS.length - 1)];

  for (let attempt = 0; attempt < 50; attempt++) {
    const table: [[number, number], [number, number]] = [
      [randInt(min, max), randInt(min, max)],
      [randInt(min, max), randInt(min, max)],
    ];
    const targetRow: 0 | 1 = randInt(0, 1) as 0 | 1;
    const targetCol: 0 | 1 = randInt(0, 1) as 0 | 1;

    if (questionKind === "cell") {
      const correct = table[targetRow][targetCol];
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: table[1 - targetRow][targetCol], kind: "axis_misread", reason: "행을 잘못 읽어 다른 행의 값을 답했다." },
        { value: table[targetRow][1 - targetCol], kind: "axis_misread", reason: "열을 잘못 읽어 다른 열의 값을 답했다." },
        { value: rowTotal(table, targetRow), kind: "condition_ignored", reason: "칸 값이 아니라 그 행의 합계를 답했다." },
      ];
      const distractors = pickUnique(cands, fmt(correct));
      if (distractors.length < 3) continue;
      return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, rowLabels, colLabels, table, targetRow, targetCol, correctAnswer: fmt(correct), distractors };
    }

    if (questionKind === "row_total") {
      const correct = rowTotal(table, targetRow);
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: rowTotal(table, (1 - targetRow) as 0 | 1), kind: "axis_misread", reason: "다른 행의 합계를 답했다." },
        { value: colTotal(table, 0), kind: "condition_ignored", reason: "행 합계가 아니라 열 합계를 답했다." },
        { value: grandTotal(table), kind: "condition_ignored", reason: "행 합계가 아니라 표 전체 합계를 답했다." },
      ];
      const distractors = pickUnique(cands, fmt(correct));
      if (distractors.length < 3) continue;
      return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, rowLabels, colLabels, table, targetRow, targetCol, correctAnswer: fmt(correct), distractors };
    }

    // conditional_share: targetRow 안에서 targetCol이 차지하는 비율(%, 정수). 임의
    // 표 값에서 필터링하면 정수 % 조건을 거의 만족하지 못해 후보가 고갈된다 — 대신
    // 원하는 정수 % 를 먼저 고르고 그 행의 두 칸을 역산해 항상 정수가 되게 만든다.
    const percentPool = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];
    const percent = percentPool[randInt(0, percentPool.length - 1)];
    const rTotal = randInt(4, 10) * 20; // 20의 배수 — 어떤 percentPool 값과 곱해도 정수.
    const targetCellCount = (rTotal * percent) / 100;
    table[targetRow][targetCol] = targetCellCount;
    table[targetRow][1 - targetCol] = rTotal - targetCellCount;
    if (targetCellCount === 0 || rTotal - targetCellCount === 0) continue;
    const shareRaw = percent;
    const gTotal = grandTotal(table);
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: (table[targetRow][targetCol] / gTotal) * 100, kind: "condition_ignored", reason: "해당 행 안에서의 비율이 아니라 표 전체를 기준으로 비율을 계산했다." },
      { value: Number.isInteger((table[targetRow][1 - targetCol] / rTotal) * 100) ? (table[targetRow][1 - targetCol] / rTotal) * 100 : NaN, kind: "axis_misread", reason: "같은 행에서 반대 열의 비율을 답했다." },
      { value: (table[targetRow][targetCol] / colTotal(table, targetCol)) * 100, kind: "axis_misread", reason: "행 기준이 아니라 열 기준으로 비율을 계산했다." },
      { value: ((rTotal - table[targetRow][targetCol]) / rTotal) * 100, kind: "formula_misuse", reason: "해당 열의 비율이 아니라 반대 열(1-비율)의 값을 답했다." },
    ];
    const distractors = pickUnique(cands, fmt(shareRaw));
    if (distractors.length < 3) continue;
    return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, rowLabels, colLabels, table, targetRow, targetCol, correctAnswer: fmt(shareRaw), distractors };
  }
  throw new Error("two_variable_data: 오답 후보 생성에 실패했습니다.");
}

export function validateTwoVarDataModel(model: TwoVarDataModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "cell" && fmt(model.table[model.targetRow][model.targetCol]) !== model.correctAnswer) return { ok: false, reason: "칸 값이 일치하지 않습니다." };
  if (model.questionKind === "row_total" && fmt(rowTotal(model.table, model.targetRow)) !== model.correctAnswer) return { ok: false, reason: "행 합계가 일치하지 않습니다." };
  if (model.questionKind === "conditional_share") {
    const expected = (model.table[model.targetRow][model.targetCol] / rowTotal(model.table, model.targetRow)) * 100;
    if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "조건부 비율이 일치하지 않습니다." };
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
  figure: DataSpec;
  distractorRationales: DistractorRationale[];
};

export function renderTwoVarDataProblem(model: TwoVarDataModel): CompiledMathProblem {
  // 2026-09-17 버그 수정 — 이 유형은 양방향표가 필수인데 표를 지문 안에 마크다운(ascii)으로만
  // 박아 넣고 실제 figure(표준 렌더링) 는 만들지 않았다. checkFigure는 지문에 "as shown" 류
  // 문구가 없으면 figure 누락을 통과시켜, 관리자 화면엔 마크다운 텍스트만 노출됐다.
  const passage = `As shown in the table below, a survey was conducted.`;
  const figure: DataSpec = {
    type: "data", kind: "two_way",
    rowLabels: model.rowLabels, colLabels: model.colLabels, cells: model.table, totals: true,
  };
  const rowLabel = model.rowLabels[model.targetRow];
  const colLabel = model.colLabels[model.targetCol];
  const otherCol = model.colLabels[1 - model.targetCol];

  let question: string;
  let explanation: string;
  let explanationEn: string;
  if (model.questionKind === "cell") {
    question = `Based on the table shown, how many people are in the category "${rowLabel}" and "${colLabel}"?`;
    explanation = `표에서 "${rowLabel}" 행과 "${colLabel}" 열이 만나는 칸의 값을 그대로 읽으면 ${model.correctAnswer}이다.`;
    explanationEn = `Reading the cell where row "${rowLabel}" meets column "${colLabel}" in the table gives ${model.correctAnswer}.`;
  } else if (model.questionKind === "row_total") {
    question = `Based on the table shown, what is the total number of people in the category "${rowLabel}"?`;
    explanation = `"${rowLabel}" 행의 두 칸(${model.colLabels[0]}, ${model.colLabels[1]})을 더하면 ${model.table[model.targetRow][0]} + ${model.table[model.targetRow][1]} = ${model.correctAnswer}이다.`;
    explanationEn = `Adding the two cells in row "${rowLabel}" (${model.colLabels[0]}, ${model.colLabels[1]}) gives ${model.table[model.targetRow][0]} + ${model.table[model.targetRow][1]} = ${model.correctAnswer}.`;
  } else {
    question = `Of the people in the category "${rowLabel}", what percent are also in the category "${colLabel}"?`;
    const rTotal = rowTotal(model.table, model.targetRow);
    explanation = `"${rowLabel}"인 사람은 총 ${rTotal}명이고, 그중 "${colLabel}"인 사람은 ${model.table[model.targetRow][model.targetCol]}명이다(비교 대상은 "${otherCol}"이 아니라 이 행 전체다). 따라서 ${model.table[model.targetRow][model.targetCol]}÷${rTotal}×100 = ${model.correctAnswer}%이다.`;
    explanationEn = `There are ${rTotal} people in "${rowLabel}", and ${model.table[model.targetRow][model.targetCol]} of them are also in "${colLabel}" (the base is that whole row, not "${otherCol}"). So ${model.table[model.targetRow][model.targetCol]}÷${rTotal}×100 = ${model.correctAnswer}%.`;
  }

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 표에서 나올 수 있는 실제 행/열 오독이다.",
    matches: "같은 표 값으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}
