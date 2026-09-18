// 2026-09-17(제품 오너 지시) — linear_equations_two_var와 같은 공통 일차식 엔진을
// "Linear inequalities"로 확장한다. 계수·부등호·정답·오답을 전부 코드로 계산하고,
// AI는 이 모듈을 전혀 거치지 않는다(값을 바꿀 수 있는 자리가 없다).
//
// 범위(1차): (1) 한 변수 일차부등식 mx + b (부등호) c 를 x 에 대해 풀기(부호가 음수인
// 계수로 나눌 때 부등호 방향이 뒤집히는 것이 핵심 오류 지점) — (2) 두 변수 일차부등식
// y (부등호) mx + b 이 주어졌을 때 어느 점이 그 해 영역에 속하는가(좌표평면에 경계선과
// 음영을 실제로 그려 검증한다).
import type { PlaneSpec, PlaneObject } from "@/lib/problem-figures/templates/coordinate-plane";
import type { DistractorRationale, DistractorKind } from "../review";

export type LinearInequalityQuestionKind = "solve_one_var" | "point_in_solution" | "table_verification";
export type LinearInequalityDifficulty = "easy" | "medium" | "hard";
type Op = "<" | "<=" | ">" | ">=";

const OP_TEXT: Record<Op, string> = { "<": "<", "<=": "\\le", ">": ">", ">=": "\\ge" };
const OP_FLIPPED: Record<Op, Op> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" };

/**
 * 2026-09-17(실측, 표준 렌더링 검증기가 잡음) — "\le"/"\ge" 같은 LaTeX 제어문은
 * $…$ 수식 기호 밖에 그대로 두면 "latex_leak"으로 저장이 거부된다("수식은 항상
 * $…$ 안에" 라는 앱 전체 규칙, lib/problem-content-check.ts). 부등호가 <=/>= 를
 * 쓴 식 전체를 항상 $…$ 로 감싼다.
 */
function mathWrap(expr: string): string {
  return `$${expr}$`;
}

export type LinearInequalityModel = {
  skillCode: "linear_inequalities";
  difficulty: LinearInequalityDifficulty;
  questionKind: LinearInequalityQuestionKind;
  /** solve_one_var: m·x (op) c 형태. point_in_solution: y (op) m·x + b 형태(항상 y 기준). */
  m: number;
  b: number;
  op: Op;
  /** solve_one_var 전용. */
  c?: number;
  /** solve_one_var 정답: 뒤집힌 부등호와 해. point_in_solution 정답: 어느 점이 해인가. */
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
  /** point_in_solution 전용 — 후보 점 4개(정답 포함, 이미 정답 위치에 correctAnswer 문자열과 대응). */
  candidatePoints?: { x: number; y: number; satisfies: boolean }[];
  /**
   * 2026-09-17(제품 오너 지시, Step 4 항목 4) — table_verification 전용: "표 검증형"
   * 실제 SAT 패턴("y > 13x - 18. For which of the following tables are all the
   * values of x and their corresponding values of y solutions...?"). x값 3개와
   * 후보 표 4개(정답 포함) — 각 표는 (x, y) 세 쌍이며 정답 표만 세 행 모두 부등식을
   * 만족한다. 오답 표는 실제 오류 경로(부등호 방향 반대·경계값 그대로 사용·기울기
   * 부호 오류)로 정확히 한 행만 위반하게 만든다.
   */
  tableXValues?: number[];
  tableCandidates?: { rows: { x: number; y: number }[]; allSatisfy: boolean }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

const RANGE_BY_DIFFICULTY: Record<LinearInequalityDifficulty, number> = { easy: 6, medium: 8, hard: 10 };
const MIN_M_MAGNITUDE: Record<LinearInequalityDifficulty, number> = { easy: 1, medium: 1, hard: 2 };
const MAX_M_MAGNITUDE: Record<LinearInequalityDifficulty, number> = { easy: 3, medium: 5, hard: 6 };

function randSlope(difficulty: LinearInequalityDifficulty): number {
  const min = MIN_M_MAGNITUDE[difficulty];
  const max = MAX_M_MAGNITUDE[difficulty];
  const magnitude = randInt(min, max);
  return Math.random() < 0.5 ? magnitude : -magnitude;
}

/** "3x" / "x" / "-x" / "-3x" — 계수 1/-1을 그대로 찍지 않는다(linear-two-variables.ts의 fmtLine과 같은 규칙). */
function xTerm(m: number): string {
  return m === 1 ? "x" : m === -1 ? "-x" : `${fmt(m)}x`;
}

/**
 * "mx + b" 우변 표현식 — 2026-09-17(품질 보완, 실제 배치 표본에서 발견) 절편이
 * 0이면 "+ 0"을 그대로 붙이지 않는다(linear-two-variables.ts의 fmtLine과 같은 규칙).
 */
function rhsExpr(m: number, b: number): string {
  if (b === 0) return xTerm(m);
  return `${xTerm(m)} ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
}

function opWord(op: Op): string {
  return op === "<" ? "미만" : op === "<=" ? "이하" : op === ">" ? "초과" : "이상";
}

/**
 * 2026-09-17(제품 오너 지시) — "실제 오류 경로가 아닌 임의 수치 오답"을 없앤다.
 * 예전에는 부호×방향 조합이 겹치면(계수가 양수일 때 특히 잦다) "경계값 ± 1..20"
 * 같은 임의 오프셋으로 채웠다. 대신 실제 오류 경로 4개만 후보로 두고, 그래도
 * 3개가 안 모이면(드묾) 계수를 다시 뽑아 재시도한다 — 임의값을 끼워 넣지 않는다.
 */
function generateSolveOneVar(difficulty: LinearInequalityDifficulty): LinearInequalityModel {
  const range = RANGE_BY_DIFFICULTY[difficulty];
  for (let attempt = 0; attempt < 30; attempt++) {
    const m = randSlope(difficulty);
    const b = randInt(-range, range);
    const opPool: Op[] = ["<", "<=", ">", ">="];
    const op = opPool[randInt(0, 3)];
    // 해의 경계값(boundary)을 먼저 정수로 고르고, 거기서 거꾸로 c = m·boundary + b를
    // 계산한다 — c를 먼저 고르면 (c-b)가 m의 배수가 아닐 때 정수해가 안 나온다.
    const boundary = randInt(-range, range);
    const adjustedC = m * boundary + b;
    const finalOp = m < 0 ? OP_FLIPPED[op] : op;
    const correctAnswer = mathWrap(`x ${OP_TEXT[finalOp]} ${fmt(boundary)}`);

    const candidates: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: mathWrap(`x ${OP_TEXT[op]} ${fmt(boundary)}`), kind: "sign_error", reason: "계수가 음수인데도 부등호 방향을 뒤집지 않았다." },
      { value: mathWrap(`x ${OP_TEXT[finalOp]} ${fmt(-boundary)}`), kind: "other", reason: "경계값의 부호를 반대로 계산했다." },
      { value: mathWrap(`x ${OP_TEXT[op]} ${fmt(-boundary)}`), kind: "other", reason: "부등호 방향도 뒤집지 않고 경계값 부호도 반대로 계산했다." },
      { value: mathWrap(`x ${OP_TEXT[finalOp]} ${fmt(adjustedC)}`), kind: "step_missing", reason: "상수항을 이항하지 않고 원래 상수를 그대로 경계값으로 썼다." },
    ];
    const seen = new Set<string>([correctAnswer]);
    const uniqueDistractors: typeof candidates = [];
    for (const c of candidates) {
      if (uniqueDistractors.length >= 3) break;
      if (seen.has(c.value)) continue;
      seen.add(c.value);
      uniqueDistractors.push(c);
    }
    if (uniqueDistractors.length < 3 && attempt < 29) continue;
    return {
      skillCode: "linear_inequalities", difficulty, questionKind: "solve_one_var",
      m, b, op, c: adjustedC, correctAnswer, distractors: uniqueDistractors.slice(0, 3),
    };
  }
  throw new Error("linear_inequalities: 오답 후보 생성에 실패했습니다.");
}

function generatePointInSolution(difficulty: LinearInequalityDifficulty): LinearInequalityModel {
  const range = RANGE_BY_DIFFICULTY[difficulty];
  const m = randSlope(difficulty);
  const b = randInt(-range, range);
  const opPool: Op[] = ["<", "<=", ">", ">="];
  const op = opPool[randInt(0, 3)];

  const satisfies = (x: number, y: number): boolean => {
    const rhs = m * x + b;
    if (op === "<") return y < rhs;
    if (op === "<=") return y <= rhs;
    if (op === ">") return y > rhs;
    return y >= rhs;
  };

  // 정답 점 하나(해 영역 안), 오답 점 셋(해 영역 밖 — 경계선 위 또는 반대편)을 실제로 계산해 고른다.
  let correctPoint: { x: number; y: number } | null = null;
  for (let attempt = 0; attempt < 100 && !correctPoint; attempt++) {
    const x = randInt(-range, range);
    const y = randInt(-range, range);
    if (satisfies(x, y)) correctPoint = { x, y };
  }
  if (!correctPoint) correctPoint = { x: 0, y: op === "<" || op === "<=" ? b - 1 : b + 1 };

  const wrongCandidates: { x: number; y: number; kind: DistractorKind; reason: string }[] = [];
  for (let attempt = 0; attempt < 200 && wrongCandidates.length < 3; attempt++) {
    const x = randInt(-range, range);
    const y = randInt(-range, range);
    if (satisfies(x, y)) continue;
    if (wrongCandidates.some((p) => p.x === x && p.y === y)) continue;
    if (x === correctPoint.x && y === correctPoint.y) continue;
    const onBoundary = y === m * x + b;
    wrongCandidates.push({
      x, y,
      kind: onBoundary ? "condition_ignored" : "sign_error",
      reason: onBoundary
        ? `경계선 위의 점이라 부등호가 ${op === "<=" || op === ">=" ? "등호를 포함해도" : "등호를 포함하지 않아"} 해가 아니다.`
        : "부등호의 방향을 반대로 적용해 해 영역 밖의 점을 답으로 골랐다.",
    });
  }
  while (wrongCandidates.length < 3) {
    const x = correctPoint.x + wrongCandidates.length + 1;
    const y = correctPoint.y + 5;
    if (!satisfies(x, y)) wrongCandidates.push({ x, y, kind: "other", reason: "해 영역 밖의 다른 점을 답으로 골랐다." });
    else wrongCandidates.push({ x: x + range, y, kind: "other", reason: "해 영역 밖의 다른 점을 답으로 골랐다." });
  }

  const candidatePoints = [
    { x: correctPoint.x, y: correctPoint.y, satisfies: true },
    ...wrongCandidates.slice(0, 3).map((p) => ({ x: p.x, y: p.y, satisfies: false })),
  ];

  return {
    skillCode: "linear_inequalities", difficulty, questionKind: "point_in_solution",
    m, b, op,
    correctAnswer: `(${fmt(correctPoint.x)}, ${fmt(correctPoint.y)})`,
    distractors: wrongCandidates.slice(0, 3).map((p) => ({ value: `(${fmt(p.x)}, ${fmt(p.y)})`, kind: p.kind, reason: p.reason })),
    candidatePoints,
  };
}

/** "| x | y |\n|---|---|\n| 3 | 21 |\n…" — 마크다운 파이프 표. LearningText(선택지 렌더링에도
 * 그대로 쓰이는 컴포넌트, app/session/[id]/LearningText.tsx)가 이 형식을 표로 그린다는 것을
 * two_variable_data의 지문 렌더링 경로에서 이미 확인했다(lib/render-learning-content.ts의
 * splitLearningBlocks). 선택지 전용 렌더링 인프라를 새로 만들지 않는다. */
function renderTableOption(rows: { x: number; y: number }[]): string {
  const header = "| x | y |";
  const sep = "|---|---|";
  const body = rows.map((r) => `| ${fmt(r.x)} | ${fmt(r.y)} |`).join("\n");
  return `${header}\n${sep}\n${body}`;
}

/**
 * 2026-09-17(제품 오너 지시) — 표 검증형은 실제 College Board 표본이 전부 엄격부등호(< , >)다.
 * 등호 포함 부등호(<=, >=)는 "경계값을 그대로 썼다"는 오류 경로 자체가 성립하지 않는다(등호를
 * 포함하면 경계값도 실제 정답이라 오답으로 못 쓴다) — 그래서 이 유형만 엄격부등호로 제한한다.
 */
function generateTableVerification(difficulty: LinearInequalityDifficulty): LinearInequalityModel {
  const range = RANGE_BY_DIFFICULTY[difficulty];
  for (let attempt = 0; attempt < 40; attempt++) {
    const m = randSlope(difficulty);
    const b = randInt(-range, range);
    const op: Op = Math.random() < 0.5 ? "<" : ">";
    const satisfies = (x: number, y: number): boolean => {
      const rhs = m * x + b;
      return op === "<" ? y < rhs : y > rhs;
    };
    const margin = (): number => randInt(1, Math.max(2, Math.floor(range / 2)));

    const xs: number[] = [];
    while (xs.length < 3) {
      const x = randInt(-range, range);
      if (!xs.includes(x)) xs.push(x);
    }
    const trueRow = (x: number): { x: number; y: number } => {
      const rhs = m * x + b;
      const y = op === "<" ? rhs - margin() : rhs + margin();
      return { x, y };
    };
    const correctRows = xs.map(trueRow);
    if (!correctRows.every((r) => satisfies(r.x, r.y))) continue;

    // 오답 표 1 — 첫 행만 부등호 방향을 반대로 적용한 값을 쓴다.
    const wrongDirRows = correctRows.map((r, i) => {
      if (i !== 0) return r;
      const rhs = m * r.x + b;
      const y = op === "<" ? rhs + margin() : rhs - margin();
      return { x: r.x, y };
    });
    // 오답 표 2 — 둘째 행만 경계값(등호) 그대로 쓴다(엄격부등호라 항상 위반).
    const boundaryRows = correctRows.map((r, i) => (i !== 1 ? r : { x: r.x, y: m * r.x + b }));
    // 오답 표 3 — 셋째 행만 기울기 부호를 반대로 계산한 값을 쓴다.
    const signErrRows = correctRows.map((r, i) => {
      if (i !== 2) return r;
      const wrongRhs = -m * r.x + b;
      const y = op === "<" ? wrongRhs - margin() : wrongRhs + margin();
      return { x: r.x, y };
    });

    const exactlyOneViolation = (rows: { x: number; y: number }[]): boolean =>
      rows.filter((r) => !satisfies(r.x, r.y)).length === 1;
    if (!exactlyOneViolation(wrongDirRows) || !exactlyOneViolation(boundaryRows) || !exactlyOneViolation(signErrRows)) continue;

    const tableCandidates = [
      { rows: correctRows, allSatisfy: true },
      { rows: wrongDirRows, allSatisfy: false },
      { rows: boundaryRows, allSatisfy: false },
      { rows: signErrRows, allSatisfy: false },
    ];
    const texts = tableCandidates.map((c) => renderTableOption(c.rows));
    if (new Set(texts).size !== 4) continue;

    return {
      skillCode: "linear_inequalities", difficulty, questionKind: "table_verification",
      m, b, op,
      tableXValues: xs,
      tableCandidates,
      correctAnswer: texts[0],
      distractors: [
        { value: texts[1], kind: "sign_error", reason: `표의 첫 행(x = ${fmt(wrongDirRows[0].x)})이 부등호 방향을 반대로 적용한 값을 쓰고 있다.` },
        { value: texts[2], kind: "condition_ignored", reason: `표의 둘째 행(x = ${fmt(boundaryRows[1].x)})이 경계값(등호)을 그대로 써서 엄격부등호를 만족하지 않는다.` },
        { value: texts[3], kind: "other", reason: `표의 셋째 행(x = ${fmt(signErrRows[2].x)})이 기울기의 부호를 반대로 계산한 값을 쓰고 있다.` },
      ],
    };
  }
  throw new Error("linear_inequalities(table_verification): 오답 표 생성에 실패했습니다.");
}

export function generateLinearInequalityModel(params: {
  difficulty: LinearInequalityDifficulty;
  questionKind?: LinearInequalityQuestionKind;
}): LinearInequalityModel {
  const kind = params.questionKind ?? (() => {
    const roll = Math.random();
    if (roll < 0.4) return "solve_one_var" as const;
    if (roll < 0.7) return "point_in_solution" as const;
    return "table_verification" as const;
  })();
  if (kind === "solve_one_var") return generateSolveOneVar(params.difficulty);
  if (kind === "point_in_solution") return generatePointInSolution(params.difficulty);
  return generateTableVerification(params.difficulty);
}

/** 결정적 검사 — 답의 유일성·오답 3개·(point_in_solution) 실제 대입 결과 일치. */
export function validateLinearInequalityModel(model: LinearInequalityModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "point_in_solution") {
    if (!model.candidatePoints || model.candidatePoints.length !== 4) return { ok: false, reason: "후보 점이 4개가 아닙니다." };
    const check = (x: number, y: number): boolean => {
      const rhs = model.m * x + model.b;
      if (model.op === "<") return y < rhs;
      if (model.op === "<=") return y <= rhs;
      if (model.op === ">") return y > rhs;
      return y >= rhs;
    };
    for (const p of model.candidatePoints) {
      if (check(p.x, p.y) !== p.satisfies) return { ok: false, reason: "후보 점의 해 여부가 실제 대입 결과와 다릅니다." };
    }
    const trueCount = model.candidatePoints.filter((p) => p.satisfies).length;
    if (trueCount !== 1) return { ok: false, reason: "해 영역에 속하는 후보 점이 정확히 하나가 아닙니다." };
  }
  if (model.questionKind === "table_verification") {
    if (!model.tableCandidates || model.tableCandidates.length !== 4) return { ok: false, reason: "후보 표가 4개가 아닙니다." };
    const check = (x: number, y: number): boolean => {
      const rhs = model.m * x + model.b;
      return model.op === "<" ? y < rhs : y > rhs;
    };
    for (const t of model.tableCandidates) {
      const actual = t.rows.every((r) => check(r.x, r.y));
      if (actual !== t.allSatisfy) return { ok: false, reason: "후보 표의 만족 여부가 실제 대입 결과와 다릅니다." };
    }
    const trueCount = model.tableCandidates.filter((t) => t.allSatisfy).length;
    if (trueCount !== 1) return { ok: false, reason: "모든 행이 조건을 만족하는 후보 표가 정확히 하나가 아닙니다." };
    if (model.op !== "<" && model.op !== ">") return { ok: false, reason: "table_verification은 엄격부등호(< 또는 >)만 지원합니다." };
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
  figure: PlaneSpec | null;
  distractorRationales: DistractorRationale[];
};

function buildFigureForPointInSolution(model: LinearInequalityModel): PlaneSpec {
  const range = RANGE_BY_DIFFICULTY[model.difficulty] + 2;
  const objects: PlaneObject[] = [
    { id: "region", kind: "inequality", op: model.op, slope: model.m, intercept: model.b, label: "" },
  ];
  return { type: "plane", axes: { x: { min: -range, max: range }, y: { min: -range, max: range } }, objects };
}

export function renderLinearInequalityProblem(model: LinearInequalityModel): CompiledMathProblem {
  const shuffleWithAnswer = (correct: string, wrongs: string[]): { options: string[]; correctIndex: number } => {
    const options = [correct, ...wrongs];
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    return { options: order.map((i) => options[i]), correctIndex: order.indexOf(0) };
  };

  if (model.questionKind === "solve_one_var") {
    const passage = `Consider the inequality shown.\n\n${mathWrap(`${rhsExpr(model.m, model.b)} ${OP_TEXT[model.op]} ${fmt(model.c!)}`)}`;
    const question = "Which of the following describes all values of x that satisfy the inequality shown?";
    const { options, correctIndex } = shuffleWithAnswer(model.correctAnswer, model.distractors.map((d) => d.value));
    const flipped = model.m < 0;
    // 2026-09-17(품질 보완) — 절편이 0이면 "0을 정리한 뒤" 같은 무의미한 문장이
    // 나가지 않게, 상수항을 옮기는 단계 자체를 문장에서 뺀다.
    const moveStep = model.b === 0 ? "" : `양변에서 ${fmt(model.b)}를 정리한 뒤 `;
    const explanation = flipped
      ? `${moveStep}음수 ${fmt(model.m)}로 나누므로 부등호 방향이 뒤집힌다. 따라서 ${model.correctAnswer}이다.`
      : `${moveStep}양수 ${fmt(model.m)}로 나누므로 부등호 방향은 그대로다. 따라서 ${model.correctAnswer}이다.`;
    const moveStepEn = model.b === 0 ? "" : `Isolating the x-term by moving ${fmt(model.b)} to the other side, `;
    const explanationEn = flipped
      ? `${moveStepEn}dividing by the negative number ${fmt(model.m)} reverses the inequality sign. So the answer is ${model.correctAnswer}.`
      : `${moveStepEn}dividing by the positive number ${fmt(model.m)} keeps the inequality sign the same. So the answer is ${model.correctAnswer}.`;
    const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
      index: options.indexOf(d.value) >= 0 ? options.indexOf(d.value) : i,
      plausibleBecause: "같은 부등식에서 나올 수 있는 실제 계산 오류 경로다.",
      matches: "같은 부등식에서 계산되었다.",
      whyWrong: d.reason,
      kind: d.kind,
      obvious: false,
    }));
    return { passage, question, options, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  if (model.questionKind === "table_verification") {
    const passage = `Consider the inequality shown.\n\n${mathWrap(`y ${OP_TEXT[model.op]} ${rhsExpr(model.m, model.b)}`)}`;
    const question = "For which of the following tables are all the values of x and their corresponding values of y solutions to the given inequality?";
    const { options, correctIndex } = shuffleWithAnswer(model.correctAnswer, model.distractors.map((d) => d.value));
    const opKorTv = model.op === "<" ? "작아야" : "커야";
    const opEnTv = model.op === "<" ? "less than" : "greater than";
    const boundaryList = model.tableXValues!.map((x) => `x = ${fmt(x)}일 때 ${fmt(model.m * x + model.b)}`).join(", ");
    const boundaryListEn = model.tableXValues!.map((x) => `x = ${fmt(x)} gives ${fmt(model.m * x + model.b)}`).join(", ");
    const explanation = `경계선 y = ${rhsExpr(model.m, model.b)}에 각 표의 x값을 대입하면 경계값은 ${boundaryList}이다. 부등식이 ${OP_TEXT[model.op]}이므로 표의 y값이 이 경계값보다 ${opKorTv} 세 행 모두 조건을 만족한다. 오답 표들은 한 행씩 실제로 대입해 보면 조건을 만족하지 않는다(부등호 방향을 반대로 적용했거나, 경계값을 그대로 썼거나, 기울기 부호를 반대로 계산했다). 세 행 모두 조건을 만족하는 표는 정답 표뿐이다.`;
    const explanationEn = `Substituting each table's x-value into the boundary line y = ${rhsExpr(model.m, model.b)} gives the boundary values: ${boundaryListEn}. Since the inequality uses ${OP_TEXT[model.op]}, every row's y-value must be ${opEnTv} that boundary value for the table to be entirely valid. In each wrong table, at least one row fails this check when substituted directly (wrong inequality direction, using the boundary value itself, or a sign error in the slope). Only the correct table has every row actually satisfy the inequality.`;
    const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
      index: options.indexOf(d.value) >= 0 ? options.indexOf(d.value) : i,
      plausibleBecause: "세 행 중 두 행은 실제로 조건을 만족해 얼핏 보면 정답 표로 보일 수 있다.",
      matches: "같은 부등식·같은 x값으로 계산되었다.",
      whyWrong: d.reason,
      kind: d.kind,
      obvious: false,
    }));
    return { passage, question, options, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  const opKor = model.op === "<" || model.op === "<=" ? "작다" : "크다";
  const opEn = model.op === "<" || model.op === "<=" ? "less than" : "greater than";
  const eqIncl = model.op === "<=" || model.op === ">=" ? "(경계선 포함)" : "(경계선 제외)";
  const eqInclEn = model.op === "<=" || model.op === ">=" ? "(boundary included)" : "(boundary excluded)";
  const passage = `Consider the graph of the inequality shown.\n\n${mathWrap(`y ${OP_TEXT[model.op]} ${rhsExpr(model.m, model.b)}`)}`;
  const question = "Which of the following points is a solution to the inequality shown?";
  const { options, correctIndex } = shuffleWithAnswer(model.correctAnswer, model.distractors.map((d) => d.value));
  const explanation = `경계선 y = ${rhsExpr(model.m, model.b)} ${eqIncl}을 기준으로, y 값이 경계선의 값보다 ${opKor} 쪽이 해 영역이다. ${model.correctAnswer}를 대입하면 조건을 만족하므로 정답이다.`;
  const explanationEn = `Relative to the boundary line y = ${rhsExpr(model.m, model.b)} ${eqInclEn}, the solution region is where the y-value is ${opEn} the boundary's value. Substituting ${model.correctAnswer} satisfies the condition, so it is the correct answer.`;
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: options.indexOf(d.value) >= 0 ? options.indexOf(d.value) : i,
    plausibleBecause: "그래프 위 또는 반대편의 실제 점이라 얼핏 보면 해로 보일 수 있다.",
    matches: "같은 그래프에서 골랐다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));
  return { passage, question, options, correctIndex, explanation, explanationEn, figure: buildFigureForPointInSolution(model), distractorRationales };
}
