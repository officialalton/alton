// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 세 번째 세부 기술:
// "Equivalent expressions". a(x+b) + c(x+d) 형태를 전개·동류항 정리해 mx+n 형태로
// 만들고, 그 결과와 동치인 선택지를 고르게 한다. 오답은 분배·동류항 정리에서 실제로
// 나올 수 있는 오류(음수 분배 부호 누락, 상수항에만 분배, 동류항을 잘못 더함)에서
// 계산한다.
import type { DistractorRationale, DistractorKind } from "../review";

export type EquivalentExpressionsDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — a(x+b) + c(x+d) ≡ (a+c)x + (a*b+c*d). */
export type EquivalentExpressionsModel = {
  skillCode: "equivalent_expressions";
  difficulty: EquivalentExpressionsDifficulty;
  a: number; b: number; c: number; d: number;
  m: number; n: number;
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
/** mx+n 형태 문자열 — m=0이면 상수만, n=0이면 x항만. */
function linearExpr(m: number, n: number): string {
  if (m === 0) return fmt(n);
  if (n === 0) return xTerm(m);
  return `${xTerm(m)} ${n >= 0 ? "+" : "-"} ${fmt(Math.abs(n))}`;
}
function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

const RANGE_BY_DIFFICULTY: Record<EquivalentExpressionsDifficulty, number> = { easy: 4, medium: 6, hard: 8 };

export function generateEquivalentExpressionsModel(params: { difficulty: EquivalentExpressionsDifficulty }): EquivalentExpressionsModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = nonZero(-range, range);
    const c = nonZero(-range, range);
    const b = randInt(-range, range);
    const d = randInt(-range, range);
    const m = a + c;
    const n = a * b + c * d;
    if (m === 0 && attempt < 29) continue; // x항이 사라지면 "동치식 고르기" 취지가 없어진다.
    const correctAnswer = linearExpr(m, n);

    // 실제 오류 경로 — (1) 두 번째 괄호에는 분배하지 않음(c*d 대신 d만 더함),
    // (2) 상수항끼리만 계산하고 x항 계수를 안 더함(둘 다 a만 반영),
    // (3) 부호가 음수인 계수를 분배할 때 상수항 부호를 안 바꿈.
    const rawCandidates: { value: [number, number]; kind: DistractorKind; reason: string }[] = [
      { value: [m, a * b + d], kind: "step_missing", reason: "두 번째 괄호에는 c를 분배하지 않고 d를 그대로 더했다." },
      { value: [a, a * b + c * d], kind: "condition_ignored", reason: "x의 계수를 구할 때 c를 더하지 않고 a만 남겼다." },
      { value: [m, a * b - c * d], kind: "sign_error", reason: "두 번째 괄호를 분배할 때 c*d의 부호를 반대로 계산했다." },
    ];
    const seen = new Set<string>([correctAnswer]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const cand of rawCandidates) {
      if (distractors.length >= 3) break;
      const text = linearExpr(cand.value[0], cand.value[1]);
      if (seen.has(text)) continue;
      seen.add(text);
      distractors.push({ value: text, kind: cand.kind, reason: cand.reason });
    }
    if (distractors.length < 3 && attempt < 29) continue;
    return { skillCode: "equivalent_expressions", difficulty: params.difficulty, a, b, c, d, m, n, correctAnswer, distractors: distractors.slice(0, 3) };
  }
  throw new Error("equivalent_expressions: 오답 후보 생성에 실패했습니다.");
}

export function validateEquivalentExpressionsModel(model: EquivalentExpressionsModel): { ok: true } | { ok: false; reason: string } {
  if (model.m !== model.a + model.c) return { ok: false, reason: "x의 계수가 a+c와 일치하지 않습니다." };
  if (model.n !== model.a * model.b + model.c * model.d) return { ok: false, reason: "상수항이 a*b+c*d와 일치하지 않습니다." };
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

/** 괄호 앞 계수(부호 포함, 예: -3) — 2026-09-17(실측, 아침 UAT) "1(x + 7)"처럼
 * 계수 1을 그대로 찍던 것을 실제 SAT 표기(계수 생략, -1은 부호만)에 맞춘다.
 * linear-two-variables.ts의 xTerm과 같은 규칙. */
function coefTerm(a: number): string {
  return a === 1 ? "" : a === -1 ? "-" : fmt(a);
}
/** 괄호 앞 계수(크기만, 부호는 앞에 별도로 "+"/"-"가 이미 붙는 두 번째 항용). */
function coefMagnitude(a: number): string {
  const abs = Math.abs(a);
  return abs === 1 ? "" : fmt(abs);
}
/** "(x + 3)"/"(x - 3)"/"(x)" — 2026-09-17(실측, 아침 UAT) 상수항이 0이면 "(x + 0)"을
 * 그대로 찍던 것을 고친다(linear-two-variables.ts의 rhsExpr과 같은 규칙). */
function parenTerm(k: number): string {
  if (k === 0) return "(x)";
  return `(x ${k >= 0 ? "+" : "-"} ${fmt(Math.abs(k))})`;
}

export function renderEquivalentExpressionsProblem(model: EquivalentExpressionsModel): CompiledMathProblem {
  const lhs = `${coefTerm(model.a)}${parenTerm(model.b)} ${model.c >= 0 ? "+" : "-"} ${coefMagnitude(model.c)}${parenTerm(model.d)}`;
  const passage = `Consider the expression shown.\n\n${lhs}`;
  const question = "Which of the following is equivalent to the expression shown?";
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const explanation = `첫 번째 괄호를 분배하면 ${linearExpr(model.a, model.a * model.b)}이고, 두 번째 괄호를 분배하면 ${linearExpr(model.c, model.c * model.d)}이다. x항끼리 더하면 ${fmt(model.a)} + ${fmt(model.c)} = ${fmt(model.m)}이고, 상수항끼리 더하면 ${fmt(model.a * model.b)} + ${fmt(model.c * model.d)} = ${fmt(model.n)}이다. 따라서 ${model.correctAnswer}이다.`;
  const explanationEn = `Distributing the first term gives ${linearExpr(model.a, model.a * model.b)}, and distributing the second term gives ${linearExpr(model.c, model.c * model.d)}. Adding the x-terms: ${fmt(model.a)} + ${fmt(model.c)} = ${fmt(model.m)}. Adding the constants: ${fmt(model.a * model.b)} + ${fmt(model.c * model.d)} = ${fmt(model.n)}. So the answer is ${model.correctAnswer}.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 식을 분배·정리하는 과정에서 나올 수 있는 실제 오류다.",
    matches: "같은 식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
