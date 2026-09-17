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

export type LinearInequalityQuestionKind = "solve_one_var" | "point_in_solution";
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

export function generateLinearInequalityModel(params: {
  difficulty: LinearInequalityDifficulty;
  questionKind?: LinearInequalityQuestionKind;
}): LinearInequalityModel {
  const kind = params.questionKind ?? (randInt(0, 1) === 0 ? "solve_one_var" : "point_in_solution");
  return kind === "solve_one_var" ? generateSolveOneVar(params.difficulty) : generatePointInSolution(params.difficulty);
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
