// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 네 번째 세부 기술:
// "Two-variable data: two-way frequency tables". 2×2 분할표에서 특정 칸·행/열 합·
// 조건부 비율을 읽는다. AI를 전혀 부르지 않는다 — 표 값·정답·오답을 전부 코드로 계산한다.
//
// 2026-09-17(제품 오너 지시, Step 4 항목 5) — 같은 스킬 코드 안에 "산점도·최적합선"
// 세부 유형을 추가한다. CollegeBoard 실기출 840문항 매핑에서 가장 빈번한(8회) 갭:
// 산점도 위 점들과 추세선을 보고 (a) 추세선의 식, (b) 추세선을 이용한 예측값,
// (c) 기울기의 맥락적 의미, (d) 추세선 위/아래 점 개수를 묻는다. 표 문항과 마찬가지로
// 전부 결정적 코드 계산 — AI 호출 없음. figure는 이미 존재하는 표준 좌표평면
// 렌더러(coordinate-plane.ts)의 "scatter" 객체 kind를 그대로 재사용한다(새 렌더러 불필요).
import type { DistractorRationale, DistractorKind } from "../review";
import type { DataSpec } from "@/lib/problem-figures/templates/data";
import type { PlaneSpec } from "@/lib/problem-figures/templates/coordinate-plane";

export type TableQuestionKind = "cell" | "row_total" | "conditional_share";
export type ScatterQuestionKind = "scatter_equation" | "scatter_predict" | "scatter_slope_context" | "scatter_count_above";
export type TwoVarDataQuestionKind = TableQuestionKind | ScatterQuestionKind;
export type TwoVarDataDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — 2×2 표: rows=[R1,R2], cols=[C1,C2]. table[row][col]. */
export type TwoWayTableModel = {
  skillCode: "two_variable_data";
  difficulty: TwoVarDataDifficulty;
  questionKind: TableQuestionKind;
  rowLabels: [string, string];
  colLabels: [string, string];
  table: [[number, number], [number, number]];
  targetRow: 0 | 1;
  targetCol: 0 | 1;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

/** 불변 정답 모델 — 산점도: 점들 + 최적합선(추세선). 점은 slope*x+intercept 위에 정수 잡음(noise)이 더해진 값이다. */
export type ScatterModel = {
  skillCode: "two_variable_data";
  difficulty: TwoVarDataDifficulty;
  questionKind: ScatterQuestionKind;
  xLabel: string;
  yLabel: string;
  points: [number, number][];
  slope: number;
  intercept: number;
  predictX?: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

export type TwoVarDataModel = TwoWayTableModel | ScatterModel;

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

/** pickUnique 의 문자열 버전 — 산점도 식/문장형 정답은 fmt(숫자)로 정규화할 수 없다. */
function pickUniqueText(
  cands: { value: string; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    if (seen.has(c.value)) continue;
    seen.add(c.value);
    out.push(c);
  }
  return out;
}

function generateTwoWayTableModel(params: {
  difficulty: TwoVarDataDifficulty;
  questionKind?: TableQuestionKind;
}): TwoWayTableModel {
  const kinds: TableQuestionKind[] = ["cell", "row_total", "conditional_share"];
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

// 지문·해설의 $는 KaTeX 수식 모드 구분자로 예약돼 있어(다른 컴파일러와 동일 규칙) 그대로
// 쓰면 화면에 반쪽짜리 수식이 남는다 — 맥락 라벨에 달러 기호를 넣지 않는다.
const SCATTER_CONTEXTS: { xLabel: string; yLabel: string }[] = [
  { xLabel: "hours studied per week", yLabel: "test score" },
  { xLabel: "advertising spending (in thousands of dollars)", yLabel: "monthly sales (in thousands of dollars)" },
  { xLabel: "age of a car (in years)", yLabel: "resale value (in thousands of dollars)" },
];
const SCATTER_SLOPES = [1, 2, 3, -1, -2, -3, 0.5, 1.5, -0.5, -1.5];

/** 사람이 읽는 직선 식 — "y = 2x + 3" 형태. 계산형 컴파일러라 KaTeX 없이 일반 텍스트로만 쓴다(그림 라벨과 같은 규칙). */
function eqStr(m: number, b: number): string {
  const sign1 = m < 0 ? "-" : "";
  const sign2 = b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${fmt(Math.abs(b))}`;
  return `y = ${sign1}${fmt(Math.abs(m))}x${sign2}`;
}

function generateScatterModel(params: {
  difficulty: TwoVarDataDifficulty;
  questionKind?: ScatterQuestionKind;
}): ScatterModel {
  const kinds: ScatterQuestionKind[] = ["scatter_equation", "scatter_predict", "scatter_slope_context", "scatter_count_above"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  const { xLabel, yLabel } = SCATTER_CONTEXTS[randInt(0, SCATTER_CONTEXTS.length - 1)];
  const noiseMagnitude = params.difficulty === "hard" ? 2 : 1;

  for (let attempt = 0; attempt < 50; attempt++) {
    const slope = SCATTER_SLOPES[randInt(0, SCATTER_SLOPES.length - 1)];
    const intercept = randInt(-5, 15);
    const n = randInt(6, 8);
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    // 실기출처럼 "눈으로 읽는" 추세선 문제로 만들려고 점을 추세선에서 살짝 흩뿌린다(정수 잡음).
    // 추세선 자체(slope/intercept)는 그림에 그려진 그대로가 정답 기준이라 학생이 실제
    // 최소제곱 회귀를 계산할 필요가 없다 — 그래프를 읽기만 하면 되는 중간~상 난이도 문항과 같다.
    const noises = xs.map(() => randInt(-noiseMagnitude, noiseMagnitude));
    // "선 위/아래 점 개수" 문항이 자명해지지 않게 양쪽에 최소 1개씩 있어야 한다.
    if (!noises.some((v) => v > 0) || !noises.some((v) => v < 0)) continue;
    const points: [number, number][] = xs.map((x, i) => [x, slope * x + intercept + noises[i]] as [number, number]);

    if (questionKind === "scatter_equation") {
      const twoPtSlope = (points[1][1] - points[0][1]) / (points[1][0] - points[0][0]);
      const correctAnswer = eqStr(slope, intercept);
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: eqStr(intercept, slope), kind: "formula_misuse", reason: "기울기와 y절편을 서로 바꿔 썼다." },
        { value: eqStr(-slope, intercept), kind: "sign_error", reason: "기울기의 부호를 반대로 읽었다." },
        { value: eqStr(Math.round(twoPtSlope * 100) / 100, intercept), kind: "condition_ignored", reason: "추세선 전체가 아니라 자료점 두 개만으로 기울기를 계산했다." },
        { value: eqStr(slope, intercept + (intercept >= 0 ? 1 : -1)), kind: "axis_misread", reason: "그래프에서 y절편을 한 칸 잘못 읽었다." },
      ];
      const distractors = pickUniqueText(cands, correctAnswer);
      if (distractors.length < 3) continue;
      return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, xLabel, yLabel, points, slope, intercept, correctAnswer, distractors };
    }

    if (questionKind === "scatter_predict") {
      const predictX = n + 2;
      const correct = slope * predictX + intercept;
      const nearestY = points[points.length - 1][1];
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: intercept * predictX + slope, kind: "formula_misuse", reason: "기울기와 y절편을 서로 바꿔서 대입했다." },
        { value: -slope * predictX + intercept, kind: "sign_error", reason: "기울기의 부호를 반대로 대입했다." },
        { value: nearestY, kind: "condition_ignored", reason: "추세선으로 예측하지 않고 가장 가까운 자료점의 값을 그대로 답했다." },
        { value: slope * (predictX - 1) + intercept, kind: "axis_misread", reason: "x값을 하나 잘못 읽고 대입했다." },
      ];
      const distractors = pickUnique(cands, fmt(correct));
      if (distractors.length < 3) continue;
      return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, xLabel, yLabel, points, slope, intercept, predictX, correctAnswer: fmt(correct), distractors };
    }

    if (questionKind === "scatter_slope_context") {
      const dir = slope > 0 ? "increases" : "decreases";
      const oppDir = slope > 0 ? "decreases" : "increases";
      const magStr = fmt(Math.abs(slope));
      const correctAnswer = `For each additional unit of ${xLabel}, the ${yLabel} ${dir} by about ${magStr} unit(s).`;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: `For each additional unit of ${xLabel}, the ${yLabel} ${oppDir} by about ${magStr} unit(s).`, kind: "sign_error", reason: "기울기의 부호(증가/감소 방향)를 반대로 해석했다." },
        { value: `For each additional unit of ${yLabel}, the ${xLabel} ${dir} by about ${magStr} unit(s).`, kind: "relation_distortion", reason: "설명변수와 반응변수를 서로 바꿔 말했다." },
        { value: `For each additional unit of ${xLabel}, the ${yLabel} ${dir} by about ${fmt(Math.abs(intercept))} unit(s).`, kind: "formula_misuse", reason: "기울기 대신 y절편 값을 변화율로 썼다." },
        { value: `When ${xLabel} is 0, the ${yLabel} is about ${magStr}.`, kind: "condition_ignored", reason: "기울기의 의미가 아니라 y절편의 의미를 답했다(다른 질문에 대한 답)." },
      ];
      const distractors = pickUniqueText(cands, correctAnswer);
      if (distractors.length < 3) continue;
      return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, xLabel, yLabel, points, slope, intercept, correctAnswer, distractors };
    }

    // scatter_count_above: 추세선(slope*x+intercept)보다 실제 y값이 큰(엄격히 위쪽) 점의 개수.
    const above = noises.filter((v) => v > 0).length;
    const below = noises.filter((v) => v < 0).length;
    const onLine = noises.filter((v) => v === 0).length;
    const correctAnswer = fmt(above);
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: below, kind: "condition_ignored", reason: "선 위쪽이 아니라 아래쪽에 있는 점의 개수를 세었다." },
      { value: above + onLine, kind: "condition_ignored", reason: "선 위에 정확히 있는 점까지 포함해서 세었다 — '위쪽'은 선보다 엄격히 큰 점만 센다." },
      { value: n - above, kind: "formula_misuse", reason: "위쪽 점의 개수가 아니라 전체 점 개수에서 위쪽 점 개수를 뺀 값을 답했다." },
      { value: n, kind: "other", reason: "위쪽 점만 세지 않고 전체 점의 개수를 답했다." },
    ];
    const distractors = pickUnique(cands, correctAnswer);
    if (distractors.length < 3) continue;
    return { skillCode: "two_variable_data", difficulty: params.difficulty, questionKind, xLabel, yLabel, points, slope, intercept, correctAnswer, distractors };
  }
  throw new Error("two_variable_data(scatter): 오답 후보 생성에 실패했습니다.");
}

export function generateTwoVarDataModel(params: {
  difficulty: TwoVarDataDifficulty;
  questionKind?: TwoVarDataQuestionKind;
}): TwoVarDataModel {
  const allKinds: TwoVarDataQuestionKind[] = ["cell", "row_total", "conditional_share", "scatter_equation", "scatter_predict", "scatter_slope_context", "scatter_count_above"];
  const questionKind = params.questionKind ?? allKinds[randInt(0, allKinds.length - 1)];
  if (questionKind === "scatter_equation" || questionKind === "scatter_predict" || questionKind === "scatter_slope_context" || questionKind === "scatter_count_above") {
    return generateScatterModel({ difficulty: params.difficulty, questionKind });
  }
  return generateTwoWayTableModel({ difficulty: params.difficulty, questionKind });
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
  if (model.questionKind === "scatter_equation" && eqStr(model.slope, model.intercept) !== model.correctAnswer) return { ok: false, reason: "추세선 식이 일치하지 않습니다." };
  if (model.questionKind === "scatter_predict") {
    if (model.predictX === undefined) return { ok: false, reason: "예측 문항에 predictX 가 없습니다." };
    if (fmt(model.slope * model.predictX + model.intercept) !== model.correctAnswer) return { ok: false, reason: "예측값이 일치하지 않습니다." };
  }
  if (model.questionKind === "scatter_count_above") {
    const above = model.points.filter(([x, y]) => y > model.slope * x + model.intercept).length;
    if (fmt(above) !== model.correctAnswer) return { ok: false, reason: "위쪽 점 개수가 일치하지 않습니다." };
  }
  if (model.questionKind === "scatter_slope_context" && !model.correctAnswer.includes(fmt(Math.abs(model.slope)))) {
    return { ok: false, reason: "기울기 해석 문항의 정답 문장에 기울기 크기가 반영되지 않았습니다." };
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
  figure: DataSpec | PlaneSpec;
  distractorRationales: DistractorRationale[];
};

function shuffleOptions(correctAnswer: string, distractors: { value: string; kind: DistractorKind; reason: string }[]) {
  const options = [correctAnswer, ...distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 자료에서 나올 수 있는 실제 오독·계산 실수다.",
    matches: "같은 자료 값으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));
  return { shuffled, correctIndex, distractorRationales };
}

function renderTableProblem(model: TwoWayTableModel): CompiledMathProblem {
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

  const { shuffled, correctIndex, distractorRationales } = shuffleOptions(model.correctAnswer, model.distractors);
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}

function renderScatterProblem(model: ScatterModel): CompiledMathProblem {
  const passage = `As shown in the scatterplot below, each point represents an observation of ${model.yLabel} versus ${model.xLabel}, and the line shown is the line of best fit.`;
  const figure: PlaneSpec = {
    type: "plane",
    axes: {
      x: { min: 0, max: model.points.length + 3, title: model.xLabel },
      y: (() => {
        const allY = model.points.map((p) => p[1]).concat([model.intercept, model.slope * (model.points.length + 3) + model.intercept]);
        const yMin = Math.floor(Math.min(...allY) - 2);
        const yMax = Math.ceil(Math.max(...allY) + 2);
        return { min: yMin, max: yMax, title: model.yLabel };
      })(),
    },
    objects: [
      // fitLine에 label을 주면 점들 사이 좁은 공간에서 라벨이 추세선과 겹치는 경우가 있어(렌더
      // 검증 실패) 라벨 없이 그린다 — 점과 선이 보이는 것만으로 문항에 필요한 정보는 충분하다.
      { id: "s1", kind: "scatter", points: model.points, fitLine: { slope: model.slope, intercept: model.intercept } },
    ],
  };

  let question: string;
  let explanation: string;
  let explanationEn: string;
  if (model.questionKind === "scatter_equation") {
    question = `Which of the following equations best represents the line of best fit shown in the scatterplot?`;
    explanation = `그래프의 추세선은 y절편이 ${model.intercept}이고 기울기가 ${model.slope}이다. 따라서 추세선의 식은 ${model.correctAnswer}이다.`;
    explanationEn = `The line of best fit has a y-intercept of ${model.intercept} and a slope of ${model.slope}, so its equation is ${model.correctAnswer}.`;
  } else if (model.questionKind === "scatter_predict") {
    question = `Based on the line of best fit, what is the predicted value of the ${model.yLabel} when the ${model.xLabel} is ${model.predictX}?`;
    explanation = `추세선의 식은 ${eqStr(model.slope, model.intercept)}이다. x = ${model.predictX}를 대입하면 y = ${model.slope}×${model.predictX} + ${model.intercept} = ${model.correctAnswer}이다.`;
    explanationEn = `The line of best fit is ${eqStr(model.slope, model.intercept)}. Substituting x = ${model.predictX} gives y = ${model.slope}×${model.predictX} + ${model.intercept} = ${model.correctAnswer}.`;
  } else if (model.questionKind === "scatter_slope_context") {
    question = `What does the slope of the line of best fit indicate about the relationship between the ${model.xLabel} and the ${model.yLabel}?`;
    const koDir = model.slope > 0 ? "증가" : "감소";
    explanation = `추세선의 기울기는 ${model.slope}이다. 기울기는 ${model.xLabel}가 1단위 늘어날 때 ${model.yLabel}가 얼마나 변하는지를 나타내므로, ${model.yLabel}는 약 ${fmt(Math.abs(model.slope))}만큼 ${koDir}한다.`;
    explanationEn = `The slope of the line of best fit is ${model.slope}. The slope tells us how much the ${model.yLabel} changes for each additional unit of ${model.xLabel}, so the ${model.yLabel} ${model.slope > 0 ? "increases" : "decreases"} by about ${fmt(Math.abs(model.slope))} unit(s).`;
  } else {
    question = `Based on the scatterplot, how many of the data points lie above the line of best fit?`;
    explanation = `추세선의 식은 ${eqStr(model.slope, model.intercept)}이다. 각 점의 x값을 이 식에 대입한 값보다 실제 y값이 더 큰(엄격히 위쪽에 있는) 점의 개수를 세면 ${model.correctAnswer}개이다.`;
    explanationEn = `The line of best fit is ${eqStr(model.slope, model.intercept)}. Counting the points whose actual y-value is strictly greater than the line's value at that x gives ${model.correctAnswer}.`;
  }

  const { shuffled, correctIndex, distractorRationales } = shuffleOptions(model.correctAnswer, model.distractors);
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}

export function renderTwoVarDataProblem(model: TwoVarDataModel): CompiledMathProblem {
  if ("slope" in model) return renderScatterProblem(model);
  return renderTableProblem(model);
}
