// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 두 번째 세부 기술: "Linear
// functions". f(x) = m·x + b 형태의 함수를 함수 표기(f 표기)로 다룬다. 두 변수
// 방정식(linear_equations_two_var)과 달리 "함수값 계산"·"두 점에서 기울기 구하기"가
// 질문 대상이라 오류 경로도 다르다(기울기 공식의 분자·분모를 바꾸는 실수 등).
import type { DistractorRationale, DistractorKind } from "../review";

export type LinearFunctionQuestionKind = "evaluate" | "find_x_for_value" | "slope_from_two_points";
export type LinearFunctionDifficulty = "easy" | "medium" | "hard";

export type LinearFunctionModel = {
  skillCode: "linear_functions";
  difficulty: LinearFunctionDifficulty;
  questionKind: LinearFunctionQuestionKind;
  m: number;
  b: number;
  /** evaluate: f(x0)=? / find_x_for_value: f(x)=target, x=? */
  x0?: number;
  target?: number;
  /** slope_from_two_points 전용 — 두 점. */
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
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
function fx(m: number, b: number): string {
  if (m === 0) return `f(x) = ${fmt(b)}`;
  if (b === 0) return `f(x) = ${xTerm(m)}`;
  return `f(x) = ${xTerm(m)} ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
}

const RANGE_BY_DIFFICULTY: Record<LinearFunctionDifficulty, number> = { easy: 6, medium: 8, hard: 10 };
const MIN_M_BY_DIFFICULTY: Record<LinearFunctionDifficulty, number> = { easy: 1, medium: 1, hard: 2 };
const MAX_M_BY_DIFFICULTY: Record<LinearFunctionDifficulty, number> = { easy: 3, medium: 5, hard: 6 };

function randSlope(difficulty: LinearFunctionDifficulty): number {
  const min = MIN_M_BY_DIFFICULTY[difficulty];
  const max = MAX_M_BY_DIFFICULTY[difficulty];
  const magnitude = randInt(min, max);
  return Math.random() < 0.5 ? magnitude : -magnitude;
}

function buildDistractors(
  correctValue: number,
  kind: "evaluate" | "find_x_for_value" | "slope"
): { value: number; kind: DistractorKind; reason: string }[] {
  const reasonByKind: Record<typeof kind, { sign: string; other: string }> = {
    evaluate: { sign: "곱셈에서 부호를 반대로 계산했다.", other: "기울기를 곱하지 않고 그대로 더했다(x를 대입하는 자리를 잘못 썼다)." },
    find_x_for_value: { sign: "이항할 때 부호를 바꾸지 않았다.", other: "기울기로 나누지 않고 빼서 계산했다." },
    slope: { sign: "분자·분모의 부호를 반대로 계산했다.", other: "기울기 공식의 분자와 분모(x 변화량·y 변화량)를 바꿔 계산했다." },
  };
  return [
    { value: -correctValue, kind: "sign_error", reason: reasonByKind[kind].sign },
    { value: correctValue + 1, kind: "other", reason: reasonByKind[kind].other },
  ];
}

export function generateLinearFunctionModel(params: {
  difficulty: LinearFunctionDifficulty;
  questionKind?: LinearFunctionQuestionKind;
}): LinearFunctionModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  const kinds: LinearFunctionQuestionKind[] = ["evaluate", "find_x_for_value", "slope_from_two_points"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];

  for (let attempt = 0; attempt < 30; attempt++) {
    const m = randSlope(params.difficulty);
    const b = randInt(-range, range);

    if (questionKind === "evaluate") {
      const x0 = randInt(-range, range);
      const value = m * x0 + b;
      // 실제 오류 경로: (1) 부호 반전, (2) 곱셈을 빼먹고 f(x0)=x0+b로 계산,
      // (3) f(x0)=m+b(대입한 x0를 빼먹음)로 계산.
      const cands = [
        { value: -value, kind: "sign_error" as DistractorKind, reason: "곱셈에서 부호를 반대로 계산했다." },
        { value: x0 + b, kind: "formula_misuse" as DistractorKind, reason: "기울기를 곱하지 않고 x값을 그대로 더했다." },
        { value: m + b, kind: "condition_ignored" as DistractorKind, reason: "대입할 x값 대신 1을 곱한 것처럼 계산했다(x0를 빼먹었다)." },
      ];
      const seen = new Set<number>([value]);
      const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
      for (const c of cands) {
        if (distractors.length >= 3) break;
        if (seen.has(c.value)) continue;
        seen.add(c.value);
        distractors.push({ value: fmt(c.value), kind: c.kind, reason: c.reason });
      }
      if (distractors.length < 3 && attempt < 29) continue;
      return {
        skillCode: "linear_functions", difficulty: params.difficulty, questionKind, m, b, x0,
        correctAnswer: fmt(value), distractors: distractors.slice(0, 3),
      };
    }

    if (questionKind === "find_x_for_value") {
      const x0 = randInt(-range, range);
      const target = m * x0 + b;
      if (x0 === 0 && attempt < 29) continue; // 정답이 0이면 "부호 반전" 오답이 정답과 겹친다.
      const cands = [
        { value: -x0, kind: "sign_error" as DistractorKind, reason: "이항할 때 부호를 바꾸지 않았다." },
        { value: target - b, kind: "formula_misuse" as DistractorKind, reason: "상수항을 이항하지 않고 target 값을 그대로 m으로 나눴다." },
        { value: target, kind: "condition_ignored" as DistractorKind, reason: "x를 구하지 않고 f(x)의 값을 그대로 답으로 썼다." },
      ];
      const seen = new Set<number>([x0]);
      const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
      for (const c of cands) {
        if (distractors.length >= 3) break;
        if (!Number.isInteger(c.value)) continue;
        if (seen.has(c.value)) continue;
        seen.add(c.value);
        distractors.push({ value: fmt(c.value), kind: c.kind, reason: c.reason });
      }
      if (distractors.length < 3 && attempt < 29) continue;
      return {
        skillCode: "linear_functions", difficulty: params.difficulty, questionKind, m, b, target,
        correctAnswer: fmt(x0), distractors: distractors.slice(0, 3),
      };
    }

    // slope_from_two_points: 두 점 (x1,y1), (x2,y2)에서 기울기 = (y2-y1)/(x2-x1).
    const x1 = randInt(-range, range);
    let x2 = randInt(-range, range);
    if (x2 === x1) x2 = x1 + (x1 >= range ? -1 : 1);
    const y1 = m * x1 + b;
    const y2 = m * x2 + b;
    // 2026-09-17 — 나눗셈이 들어간 후보(예: 분자·분모를 바꾼 값)는 대부분 정수가
    // 아니라 자주 필터링돼 후보가 2개 이하로 줄었다. 나눗셈 없이 항상 정수인 실제
    // 오류 경로 3가지만 쓴다: 부호 반전, y 변화량만 답으로 씀, x 변화량만 답으로 씀.
    const cands = [
      { value: -m, kind: "sign_error" as DistractorKind, reason: "분자·분모의 뺄셈 순서를 한쪽만 바꿔 부호가 반대로 나왔다." },
      { value: y2 - y1, kind: "condition_ignored" as DistractorKind, reason: "y 변화량을 x 변화량으로 나누지 않고 그대로 답으로 썼다." },
      { value: x2 - x1, kind: "condition_ignored" as DistractorKind, reason: "x 변화량을 y 변화량으로 나누지 않고 그대로 답으로 썼다." },
    ];
    const seen = new Set<number>([m]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const c of cands) {
      if (distractors.length >= 3) break;
      if (seen.has(c.value)) continue;
      seen.add(c.value);
      distractors.push({ value: fmt(c.value), kind: c.kind, reason: c.reason });
    }
    if (distractors.length < 3 && attempt < 29) continue;
    return {
      skillCode: "linear_functions", difficulty: params.difficulty, questionKind, m, b,
      p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 },
      correctAnswer: fmt(m), distractors: distractors.slice(0, 3),
    };
  }
  throw new Error("linear_functions: 오답 후보 생성에 실패했습니다.");
}

export function validateLinearFunctionModel(model: LinearFunctionModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "evaluate") {
    if (model.x0 === undefined || fmt(model.m * model.x0 + model.b) !== model.correctAnswer) return { ok: false, reason: "f(x0) 계산이 정답과 일치하지 않습니다." };
  }
  if (model.questionKind === "find_x_for_value") {
    if (model.target === undefined) return { ok: false, reason: "target 값이 없습니다." };
    const x = Number(model.correctAnswer);
    if (model.m * x + model.b !== model.target) return { ok: false, reason: "x 값이 f(x)=target을 만족하지 않습니다." };
  }
  if (model.questionKind === "slope_from_two_points") {
    if (!model.p1 || !model.p2) return { ok: false, reason: "두 점이 없습니다." };
    if (model.p2.x === model.p1.x) return { ok: false, reason: "두 점의 x좌표가 같아 기울기를 정의할 수 없습니다." };
    const slope = (model.p2.y - model.p1.y) / (model.p2.x - model.p1.x);
    if (fmt(slope) !== model.correctAnswer) return { ok: false, reason: "두 점에서 계산한 기울기가 정답과 일치하지 않습니다." };
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

export function renderLinearFunctionProblem(model: LinearFunctionModel): CompiledMathProblem {
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 함수·같은 점에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 함수에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  if (model.questionKind === "evaluate") {
    const passage = `The function f is defined by ${fx(model.m, model.b)}.`;
    const question = `What is f(${fmt(model.x0!)})?`;
    const explanation = `f(${fmt(model.x0!)}) = ${fmt(model.m)} × ${fmt(model.x0!)} ${model.b >= 0 ? "+" : "-"} ${fmt(Math.abs(model.b))} = ${model.correctAnswer}이다.`;
    const explanationEn = `f(${fmt(model.x0!)}) = ${fmt(model.m)} × ${fmt(model.x0!)} ${model.b >= 0 ? "+" : "-"} ${fmt(Math.abs(model.b))} = ${model.correctAnswer}.`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  if (model.questionKind === "find_x_for_value") {
    const passage = `The function f is defined by ${fx(model.m, model.b)}.`;
    const question = `For what value of x does f(x) = ${fmt(model.target!)}?`;
    const explanation = `${fmt(model.m)}x ${model.b >= 0 ? "+" : "-"} ${fmt(Math.abs(model.b))} = ${fmt(model.target!)}에서 상수항을 이항하면 ${fmt(model.m)}x = ${fmt(model.target! - model.b)}이므로 x = ${fmt(model.target! - model.b)} ÷ ${fmt(model.m)} = ${model.correctAnswer}이다.`;
    const explanationEn = `From ${fmt(model.m)}x ${model.b >= 0 ? "+" : "-"} ${fmt(Math.abs(model.b))} = ${fmt(model.target!)}, moving the constant term gives ${fmt(model.m)}x = ${fmt(model.target! - model.b)}, so x = ${fmt(model.target! - model.b)} ÷ ${fmt(model.m)} = ${model.correctAnswer}.`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  const { p1, p2 } = model;
  const passage = `In the xy-plane, line f passes through the points (${fmt(p1!.x)}, ${fmt(p1!.y)}) and (${fmt(p2!.x)}, ${fmt(p2!.y)}).`;
  const question = "What is the slope of line f?";
  const dy = p2!.y - p1!.y;
  const dx = p2!.x - p1!.x;
  const explanation = `기울기는 (y의 변화량) ÷ (x의 변화량) = (${fmt(dy)}) ÷ (${fmt(dx)}) = ${model.correctAnswer}이다.`;
  const explanationEn = `Slope = (change in y) ÷ (change in x) = (${fmt(dy)}) ÷ (${fmt(dx)}) = ${model.correctAnswer}.`;
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
