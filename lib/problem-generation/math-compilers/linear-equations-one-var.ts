// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 첫 세부 기술: "Linear equations in
// one variable". a·x + b = c·x + d 형태의 한 변수 일차방정식을 풀어 x를 구한다.
// AI를 전혀 부르지 않는다 — 계수·정답·오답을 전부 코드로 계산한다.
import type { DistractorRationale, DistractorKind } from "../review";

export type LinearOneVarDifficulty = "easy" | "medium" | "hard";

/**
 * 불변 정답 모델 — a·x + b = c·x + d, 해는 x = (d-b)/(a-c). 계수는 항상 정수이고
 * 해도 항상 정수가 되도록 고른다(선택지가 지저분한 분수가 되지 않게).
 */
export type LinearOneVarModel = {
  skillCode: "linear_equations_one_var";
  difficulty: LinearOneVarDifficulty;
  a: number; b: number; c: number; d: number;
  x: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
function xTerm(m: number): string {
  return m === 1 ? "x" : m === -1 ? "-x" : `${fmt(m)}x`;
}
function sideExpr(m: number, b: number): string {
  if (m === 0) return fmt(b);
  if (b === 0) return xTerm(m);
  return `${xTerm(m)} ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
}

const RANGE_BY_DIFFICULTY: Record<LinearOneVarDifficulty, number> = { easy: 6, medium: 8, hard: 10 };
const MIN_COEF_BY_DIFFICULTY: Record<LinearOneVarDifficulty, number> = { easy: 1, medium: 1, hard: 2 };
const MAX_COEF_BY_DIFFICULTY: Record<LinearOneVarDifficulty, number> = { easy: 4, medium: 6, hard: 8 };

function randCoef(difficulty: LinearOneVarDifficulty): number {
  const min = MIN_COEF_BY_DIFFICULTY[difficulty];
  const max = MAX_COEF_BY_DIFFICULTY[difficulty];
  const magnitude = randInt(min, max);
  return Math.random() < 0.5 ? magnitude : -magnitude;
}

/** a·x + b = c·x + d 를 정수해로 만드는 계수를 고른다(최대 200회 시도). */
function pickEquation(range: number, difficulty: LinearOneVarDifficulty): { a: number; b: number; c: number; d: number; x: number } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = randInt(-range, range);
    const a = randCoef(difficulty);
    let c = randCoef(difficulty);
    if (c === a) c = a + (a >= 0 ? -1 : 1); // 계수가 같으면 항이 소거돼 방정식이 아니게 된다.
    const b = randInt(-range, range);
    // d = a*x + b - c*x  (양변이 x=x에서 실제로 같아지도록 역산)
    const d = (a - c) * x + b;
    if (Math.abs(d) <= range * 3 && x !== 0) return { a, b, c, d, x };
  }
  return { a: 2, b: 1, c: 1, d: 4, x: 3 };
}

export function generateLinearOneVarModel(params: { difficulty: LinearOneVarDifficulty }): LinearOneVarModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  for (let attempt = 0; attempt < 30; attempt++) {
    const { a, b, c, d, x } = pickEquation(range, params.difficulty);
    const correctAnswer = fmt(x);
    // 2026-09-17(제품 오너 지시) — 임의 오프셋이 아니라 실제 오류 경로만. 정답은
    // x = (d-b)/(a-c) — 상수항 이항(부호 반전)과 x항 소거(부호 반전)를 각각 놓치는
    // 조합 3가지(부호 격자에서 정답을 뺀 나머지)와, 최종 답의 부호를 통째로 반대로
    // 낸 경우 1가지를 후보로 둔다.
    const diffAC = a - c;
    const sumAC = a + c;
    const diffDB = d - b;
    const sumDB = d + b;
    const rawCandidates: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: diffAC !== 0 ? sumDB / diffAC : NaN, kind: "sign_error", reason: "상수항을 이항할 때 부호를 바꾸지 않았다(b를 더한 채로 계산)." },
      { value: sumAC !== 0 ? diffDB / sumAC : NaN, kind: "sign_error", reason: "x항을 이항할 때 부호를 바꾸지 않았다(계수를 뺀 게 아니라 더했다)." },
      { value: sumAC !== 0 ? sumDB / sumAC : NaN, kind: "formula_misuse", reason: "상수항과 x항 이항 둘 다 부호를 바꾸지 않았다." },
      { value: -x, kind: "condition_ignored", reason: "맞게 계산한 뒤 최종 답의 부호를 반대로 적었다." },
    ];
    const candidates = rawCandidates.filter((cand) => Number.isInteger(cand.value));
    const seen = new Set<number>([x]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const cand of candidates) {
      if (distractors.length >= 3) break;
      if (seen.has(cand.value)) continue;
      seen.add(cand.value);
      distractors.push({ value: fmt(cand.value), kind: cand.kind, reason: cand.reason });
    }
    if (distractors.length < 3 && attempt < 29) continue;
    return { skillCode: "linear_equations_one_var", difficulty: params.difficulty, a, b, c, d, x, correctAnswer, distractors: distractors.slice(0, 3) };
  }
  throw new Error("linear_equations_one_var: 오답 후보 생성에 실패했습니다.");
}

export function validateLinearOneVarModel(model: LinearOneVarModel): { ok: true } | { ok: false; reason: string } {
  if (model.a * model.x + model.b !== model.c * model.x + model.d) return { ok: false, reason: "해가 실제 방정식과 일치하지 않습니다." };
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
  figure: null;
  distractorRationales: DistractorRationale[];
};

export function renderLinearOneVarProblem(model: LinearOneVarModel): CompiledMathProblem {
  const passage = `Consider the equation shown.\n\n${sideExpr(model.a, model.b)} = ${sideExpr(model.c, model.d)}`;
  const question = "What is the solution to the equation shown?";
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const diffAC = model.a - model.c;
  const diffDB = model.d - model.b;
  // 실제 소거·이항 단계: a x + b = c x + d → (a-c)x = d-b → x = (d-b)/(a-c).
  const explanation = `양변에서 ${sideExpr(model.c, 0)}를 빼면 ${sideExpr(diffAC, model.b)} = ${fmt(model.d)}이고, 다시 ${fmt(model.b)}를 이항하면 (${fmt(diffAC)})x = ${fmt(diffDB)}이다. 따라서 x = ${fmt(diffDB)} ÷ (${fmt(diffAC)}) = ${model.correctAnswer}이다.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 방정식에서 나올 수 있는 실제 이항·소거 오류다.",
    matches: "같은 방정식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, figure: null, distractorRationales };
}
