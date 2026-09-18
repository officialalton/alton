// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 다섯 번째(마지막) 세부 기술:
// "Nonlinear functions". f(x) = a(x-h)^2 + k(꼭짓점 형태)로 이차함수를 표현하고,
// 함수값 계산과 꼭짓점 좌표 찾기를 묻는다. 표준형이 아니라 꼭짓점 형태로 직접
// 생성해 항상 정수 꼭짓점을 보장한다(표준형에서 -b/2a를 구해 나눗셈이 안 떨어지는
// 문제를 피한다).
import type { DistractorRationale, DistractorKind } from "../review";
import type { PlaneSpec } from "@/lib/problem-figures/templates/coordinate-plane";

/** 관리자가 "새 문제" 패널에서 고르는 자료 정책(none|optional|require_plane|…) 중 이 컴파일러가
 * 실제로 구분하는 두 모드. 2026-09-17 버그 수정 — 이전에는 admin이 "자료 포함 · 좌표평면"을
 * 골라도 이 값이 runMathCompilerBatch까지 전달되지 않아 항상 텍스트형으로만 나갔다. */
export type NonlinearFnFigureMode = "text" | "plane";

export type NonlinearFnQuestionKind = "evaluate" | "vertex_x" | "vertex_y";
export type NonlinearFnDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — f(x) = a(x-h)^2 + k(이차함수). */
export type QuadraticFnModel = {
  family: "quadratic";
  skillCode: "nonlinear_functions";
  difficulty: NonlinearFnDifficulty;
  questionKind: NonlinearFnQuestionKind;
  a: number; h: number; k: number;
  /** evaluate 전용. */
  x0?: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

// 2026-09-17(제품 오너 지시, Step 4 고빈도 공백 2번) — "지수함수의 증가·감소와 문맥
// 해석". f(t) = a·b^t 형태(문맥상 "t년/일 후의 값")를 다룬다. 세 질문 유형:
// (1) evaluate — 주어진 t에서 함수값 계산, (2) find_x_for_value — 주어진 값을 만드는
// t를 역산, (3) interpret_a/interpret_b — a(초기값)와 b(증가·감소율)가 문맥에서
// 무엇을 뜻하는지 해석(문장 선택지, 숫자가 아니다). 실제 오류 경로: 증가/감소 방향
// 착각, 퍼센트율을 배율 자체로 착각(1.05 대신 0.05), 지수 off-by-one(t=0과 t=1
// 혼동), a와 b의 역할을 서로 바꿔 해석.
export type ExponentialContext = {
  funcName: string;
  varName: string;
  /** "the number of bacteria" 처럼 변화하는 양을 가리키는 명사구(관사 없이 시작). */
  noun: string;
  unit: string;
  timeUnit: string;
};

const EXPONENTIAL_CONTEXTS: ExponentialContext[] = [
  { funcName: "P", varName: "t", noun: "number of bacteria in a lab culture", unit: "bacteria", timeUnit: "hours" },
  { funcName: "V", varName: "t", noun: "value of a delivery van, in dollars,", unit: "dollars", timeUnit: "years" },
  { funcName: "N", varName: "t", noun: "number of subscribers to a streaming service", unit: "subscribers", timeUnit: "months" },
  { funcName: "A", varName: "t", noun: "amount of a radioactive substance, in grams,", unit: "grams", timeUnit: "days" },
];

export type ExponentialQuestionKind = "evaluate" | "find_x_for_value" | "interpret_a" | "interpret_b";

export type ExponentialFnModel = {
  family: "exponential";
  skillCode: "nonlinear_functions";
  difficulty: NonlinearFnDifficulty;
  questionKind: ExponentialQuestionKind;
  /** f(t) = a * b^t. a는 t=0일 때의 초기값, b는 배율(성장이면 >1, 감소면 0<b<1). */
  a: number;
  b: number;
  ratePercent: number;
  isGrowth: boolean;
  context: ExponentialContext;
  /** evaluate 전용이면 대입한 t, find_x_for_value 전용이면 목표값 f(t). */
  t0?: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

export type NonlinearFnModel = QuadraticFnModel | ExponentialFnModel;

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
/**
 * "$f(x) = a(x-h)^2+k$" 형태 — a=1/-1 계수 생략, h/k=0이면 항 생략(SAT 표기 규칙).
 * 2026-09-17(실측, 아침 UAT) — "^2"를 $…$ 밖에 그대로 두면 위첨자로 조판되지
 * 않고 캐럿 글자 그대로 노출된다 — 반드시 $…$로 감싼다.
 */
function vertexExpr(a: number, h: number, k: number): string {
  const aTerm = a === 1 ? "" : a === -1 ? "-" : fmt(a);
  const inner = h === 0 ? "x" : `x ${h >= 0 ? "-" : "+"} ${fmt(Math.abs(h))}`;
  const kTerm = k === 0 ? "" : ` ${k >= 0 ? "+" : "-"} ${fmt(Math.abs(k))}`;
  return `$f(x) = ${aTerm}(${inner})^2${kTerm}$`;
}

const RANGE_BY_DIFFICULTY: Record<NonlinearFnDifficulty, number> = { easy: 5, medium: 7, hard: 9 };
const MIN_A_BY_DIFFICULTY: Record<NonlinearFnDifficulty, number> = { easy: 1, medium: 1, hard: 2 };
const MAX_A_BY_DIFFICULTY: Record<NonlinearFnDifficulty, number> = { easy: 2, medium: 3, hard: 4 };

function randA(difficulty: NonlinearFnDifficulty): number {
  const min = MIN_A_BY_DIFFICULTY[difficulty];
  const max = MAX_A_BY_DIFFICULTY[difficulty];
  const magnitude = randInt(min, max);
  return Math.random() < 0.5 ? magnitude : -magnitude;
}

/** 2026-09-17(제품 오너 지시) — family를 명시하지 않으면 기존 이차함수 문항을 70%,
 * 새 지수함수 문항을 30% 섞는다(word_problem_translate와 같은 패턴). questionKind가
 * 명시되면 그 값이 어느 family에 속하는지로 family를 역산한다("evaluate"는 두 family
 * 모두에 있으므로 이차함수 쪽을 기본값으로 둔다 — 기존 호출부·테스트와 호환). */
export function generateNonlinearFnModel(params: {
  difficulty: NonlinearFnDifficulty;
  family?: "quadratic" | "exponential";
  questionKind?: NonlinearFnQuestionKind | ExponentialQuestionKind;
}): NonlinearFnModel {
  const quadraticKinds: string[] = ["evaluate", "vertex_x", "vertex_y"];
  const exponentialOnlyKinds: string[] = ["find_x_for_value", "interpret_a", "interpret_b"];
  let family = params.family;
  if (!family) {
    if (params.questionKind && exponentialOnlyKinds.includes(params.questionKind)) family = "exponential";
    else if (params.questionKind && quadraticKinds.includes(params.questionKind)) family = "quadratic";
    else family = Math.random() < 0.7 ? "quadratic" : "exponential";
  }
  if (family === "exponential") {
    return generateExponentialFnModel({ difficulty: params.difficulty, questionKind: params.questionKind as ExponentialQuestionKind | undefined });
  }
  return generateQuadraticFnModel({ difficulty: params.difficulty, questionKind: params.questionKind as NonlinearFnQuestionKind | undefined });
}

function generateQuadraticFnModel(params: {
  difficulty: NonlinearFnDifficulty;
  questionKind?: NonlinearFnQuestionKind;
}): QuadraticFnModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  const kinds: NonlinearFnQuestionKind[] = ["evaluate", "vertex_x", "vertex_y"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];

  for (let attempt = 0; attempt < 30; attempt++) {
    const a = randA(params.difficulty);
    const h = randInt(-range, range);
    const k = randInt(-range, range);

    if (questionKind === "vertex_x" || questionKind === "vertex_y") {
      const correctValue = questionKind === "vertex_x" ? h : k;
      const other = questionKind === "vertex_x" ? k : h;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: -correctValue, kind: "sign_error", reason: questionKind === "vertex_x" ? "꼭짓점의 x좌표는 h가 아니라 -h라고 착각해 부호를 반대로 계산했다." : "꼭짓점의 y좌표 부호를 반대로 계산했다." },
        { value: other, kind: "condition_ignored", reason: "x좌표와 y좌표를 서로 바꿔 답했다." },
        { value: -other, kind: "sign_error", reason: "x좌표와 y좌표를 바꾸고 부호까지 반대로 계산했다." },
      ];
      const seen = new Set<string>([fmt(correctValue)]);
      const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
      for (const c of cands) {
        if (distractors.length >= 3) break;
        const text = fmt(c.value);
        if (seen.has(text)) continue;
        seen.add(text);
        distractors.push({ value: text, kind: c.kind, reason: c.reason });
      }
      if (distractors.length < 3 && attempt < 29) continue;
      return { family: "quadratic", skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, h, k, correctAnswer: fmt(correctValue), distractors };
    }

    // evaluate: f(x0) = a(x0-h)^2 + k.
    const x0 = randInt(-range, range);
    const value = a * (x0 - h) * (x0 - h) + k;
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: a * (x0 + h) * (x0 + h) + k, kind: "sign_error", reason: "괄호 안 h의 부호를 반대로 계산했다(x0-h 대신 x0+h)." },
      { value: a * (x0 - h) * (x0 - h) - k, kind: "sign_error", reason: "마지막에 k를 더하지 않고 뺐다." },
      { value: (x0 - h) * (x0 - h) + k, kind: "formula_misuse", reason: "제곱한 값에 a를 곱하지 않았다." },
    ];
    const seen = new Set<string>([fmt(value)]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const c of cands) {
      if (distractors.length >= 3) break;
      const text = fmt(c.value);
      if (seen.has(text)) continue;
      seen.add(text);
      distractors.push({ value: text, kind: c.kind, reason: c.reason });
    }
    if (distractors.length < 3 && attempt < 29) continue;
    return { family: "quadratic", skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, h, k, x0, correctAnswer: fmt(value), distractors };
  }
  throw new Error("nonlinear_functions: 오답 후보 생성에 실패했습니다.");
}

export function validateNonlinearFnModel(model: NonlinearFnModel): { ok: true } | { ok: false; reason: string } {
  if (model.family === "exponential") return validateExponentialFnModel(model);
  return validateQuadraticFnModel(model);
}

function validateQuadraticFnModel(model: QuadraticFnModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "evaluate") {
    if (model.x0 === undefined) return { ok: false, reason: "x0이 없습니다." };
    const expected = model.a * (model.x0 - model.h) * (model.x0 - model.h) + model.k;
    if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "f(x0) 계산이 정답과 일치하지 않습니다." };
  }
  if (model.questionKind === "vertex_x" && fmt(model.h) !== model.correctAnswer) return { ok: false, reason: "꼭짓점 x좌표가 h와 일치하지 않습니다." };
  if (model.questionKind === "vertex_y" && fmt(model.k) !== model.correctAnswer) return { ok: false, reason: "꼭짓점 y좌표가 k와 일치하지 않습니다." };
  return { ok: true };
}

const RATE_PERCENTS_BY_DIFFICULTY: Record<NonlinearFnDifficulty, number[]> = {
  easy: [5, 10],
  medium: [5, 10, 15, 20],
  hard: [10, 15, 20, 25, 30],
};

/** a * numerator^t / 100^t 를 항상 정수로 만들기 위해 a = k * 100^t 로 고정한다
 * (t는 1~2로 제한 — t=3이면 a가 백만 단위로 지나치게 커진다). */
function pickExponentialCore(difficulty: NonlinearFnDifficulty): { a: number; ratePercent: number; isGrowth: boolean; b: number; t: number } {
  const rates = RATE_PERCENTS_BY_DIFFICULTY[difficulty];
  const ratePercent = rates[randInt(0, rates.length - 1)];
  const isGrowth = Math.random() < 0.5;
  const t = difficulty === "easy" ? 1 : randInt(1, 2);
  const numerator = isGrowth ? 100 + ratePercent : 100 - ratePercent;
  const k = randInt(1, 9);
  const a = k * 100 ** t;
  const b = numerator / 100;
  return { a, ratePercent, isGrowth, b, t };
}

function pickExponentialContext(): ExponentialContext {
  return EXPONENTIAL_CONTEXTS[randInt(0, EXPONENTIAL_CONTEXTS.length - 1)];
}

/** exponentValue(a, b, t) = a * b^t. b가 100분율 분수이므로 t<=2에서는 항상 정확한
 * 정수가 나온다(pickExponentialCore가 a를 100^t의 배수로 고정하기 때문). */
function exponentialValue(a: number, b: number, t: number): number {
  return Math.round(a * b ** t * 1e6) / 1e6;
}

function generateExponentialFnModel(params: { difficulty: NonlinearFnDifficulty; questionKind?: ExponentialQuestionKind }): ExponentialFnModel {
  const kinds: ExponentialQuestionKind[] = ["evaluate", "find_x_for_value", "interpret_a", "interpret_b"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  const context = pickExponentialContext();

  if (questionKind === "interpret_a" || questionKind === "interpret_b") {
    // interpret 유형은 계산이 없으므로 a·ratePercent 범위를 넓게 잡아도 무방하다.
    const rates = RATE_PERCENTS_BY_DIFFICULTY[params.difficulty];
    const ratePercent = rates[randInt(0, rates.length - 1)];
    const isGrowth = Math.random() < 0.5;
    const a = randInt(2, 9) * (params.difficulty === "hard" ? 1000 : 100);
    const b = (isGrowth ? 100 + ratePercent : 100 - ratePercent) / 100;
    const direction = isGrowth ? "increases" : "decreases";
    const oppositeDirection = isGrowth ? "decreases" : "increases";

    if (questionKind === "interpret_a") {
      const correctAnswer = `When ${context.varName} = 0, the ${context.noun} was ${a} ${context.unit}.`;
      const distractors: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: `Each additional ${context.timeUnit.replace(/s$/, "")}, the ${context.noun} ${direction} by ${a} ${context.unit}.`, kind: "condition_ignored", reason: `초기값(a)의 역할을 증가·감소율(b)의 역할과 바꿔 해석했다 — a는 매 ${context.timeUnit}마다 바뀌는 양이 아니라 t=0에서의 값이다.` },
        { value: `After 1 ${context.timeUnit.replace(/s$/, "")}, the ${context.noun} was ${a} ${context.unit}.`, kind: "condition_ignored", reason: "t=0(초기값)과 t=1을 혼동했다(지수 off-by-one) — a는 f(1)이 아니라 f(0)이다." },
        { value: `The ${context.noun} changes by ${a}% each ${context.timeUnit.replace(/s$/, "")}.`, kind: "formula_misuse", reason: "a를 퍼센트 증가·감소율로 착각했다 — a는 초기값(단위: 실제 수량)이지 퍼센트가 아니다." },
      ];
      return { family: "exponential", skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, b, ratePercent, isGrowth, context, correctAnswer, distractors };
    }

    const correctAnswer = `Each ${context.timeUnit.replace(/s$/, "")}, the ${context.noun} ${direction} by ${ratePercent}%.`;
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: `Each ${context.timeUnit.replace(/s$/, "")}, the ${context.noun} ${oppositeDirection} by ${ratePercent}%.`, kind: "sign_error", reason: `증가와 감소 방향을 반대로 읽었다 — b = ${fmt(b)}는 ${isGrowth ? "1보다 크므로 증가" : "1보다 작으므로 감소"}를 뜻한다.` },
      { value: `Each ${context.timeUnit.replace(/s$/, "")}, the ${context.noun} is multiplied by ${ratePercent}%.`, kind: "formula_misuse", reason: `퍼센트율(${ratePercent}%) 자체를 배율로 착각했다 — 실제 배율은 ${fmt(b)}(=${isGrowth ? "100%+" : "100%-"}${ratePercent}%)이지 ${ratePercent}%가 아니다.` },
      { value: `The ${context.noun} starts at ${ratePercent} ${context.unit}.`, kind: "condition_ignored", reason: "증가·감소율(b)의 역할을 초기값(a)의 역할과 바꿔 해석했다." },
    ];
    return { family: "exponential", skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, b, ratePercent, isGrowth, context, correctAnswer, distractors };
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const { a, ratePercent, isGrowth, b, t } = pickExponentialCore(params.difficulty);
    const oppositeB = isGrowth ? (100 - ratePercent) / 100 : (100 + ratePercent) / 100;

    if (questionKind === "evaluate") {
      const value = exponentialValue(a, b, t);
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: exponentialValue(a, oppositeB, t), kind: "sign_error", reason: `증가·감소 방향을 반대로 적용했다(성장이면 배율 ${fmt(oppositeB)} 대신 ${fmt(b)}를 썼어야 한다).` },
        { value: exponentialValue(a, ratePercent / 100, t), kind: "formula_misuse", reason: `퍼센트율(${ratePercent}%)을 배율 자체로 썼다 — ${fmt(ratePercent / 100)}이 아니라 ${fmt(b)}를 곱해야 한다.` },
        { value: exponentialValue(a, b, t - 1), kind: "condition_ignored", reason: `지수를 하나 적게 곱했다(t=${t} 대신 t=${t - 1}로 계산 — 초기값과 f(1)을 혼동하는 off-by-one 오류).` },
      ];
      const seen = new Set<string>([fmt(value)]);
      const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
      for (const c of cands) {
        if (distractors.length >= 3) break;
        const text = fmt(c.value);
        if (seen.has(text)) continue;
        seen.add(text);
        distractors.push({ value: text, kind: c.kind, reason: c.reason });
      }
      if (distractors.length < 3 && attempt < 29) continue;
      return { family: "exponential", skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, b, ratePercent, isGrowth, context, t0: t, correctAnswer: fmt(value), distractors };
    }

    // find_x_for_value: f(t)=target인 t를 역산 — 생성 시점에 이미 알고 있는 t를 정답으로 둔다.
    const candT = [t + 1, Math.max(0, t - 1), 0, 2 * t, t + 2].filter((v) => v !== t);
    const seen = new Set<number>([t]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    const reasons: Record<number, string> = {
      [t + 1]: "지수를 하나 더 곱해 t를 실제보다 1 크게 계산했다(off-by-one).",
      [Math.max(0, t - 1)]: "지수를 하나 덜 곱해 t를 실제보다 1 작게 계산했다(off-by-one).",
      0: "t=0(초기값)과 실제로 목표값이 나오는 시점을 혼동했다.",
      [2 * t]: "지수를 두 배로 잘못 계산했다(배율을 한 번 더 곱해야 하는 것으로 착각).",
      [t + 2]: "지수를 실제보다 2 크게 계산했다.",
    };
    for (const cand of candT) {
      if (distractors.length >= 3) break;
      if (seen.has(cand)) continue;
      seen.add(cand);
      distractors.push({ value: fmt(cand), kind: "condition_ignored", reason: reasons[cand] ?? "지수 계산을 잘못했다." });
    }
    if (distractors.length < 3 && attempt < 29) continue;
    const target = exponentialValue(a, b, t);
    return { family: "exponential", skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, b, ratePercent, isGrowth, context, t0: target, correctAnswer: fmt(t), distractors };
  }
  throw new Error("nonlinear_functions(exponential): 오답 후보 생성에 실패했습니다.");
}

function validateExponentialFnModel(model: ExponentialFnModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "evaluate") {
    if (model.t0 === undefined) return { ok: false, reason: "t0이 없습니다." };
    const expected = exponentialValue(model.a, model.b, model.t0);
    if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "f(t0) 계산이 정답과 일치하지 않습니다." };
  }
  if (model.questionKind === "find_x_for_value") {
    if (model.t0 === undefined) return { ok: false, reason: "목표값(target)이 없습니다." };
    const t = Number(model.correctAnswer);
    if (fmt(exponentialValue(model.a, model.b, t)) !== fmt(model.t0)) return { ok: false, reason: "정답 t에서 계산한 f(t)가 목표값과 일치하지 않습니다." };
  }
  if ((model.questionKind === "interpret_a" || model.questionKind === "interpret_b") && model.correctAnswer.length === 0) {
    return { ok: false, reason: "해석 문장이 비어 있습니다." };
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

/** vertex-form 계수(a,h,k)로 좌표평면 그림을 만든다 — x축은 꼭짓점을 중심으로 폭 6, y축은
 * 구간 안에서 실제로 지나는 값들을 다 담도록 여유를 둔다. */
function buildPlaneFigure(a: number, h: number, k: number): PlaneSpec {
  const xMin = h - 6, xMax = h + 6;
  const yAtEdge1 = a * (xMin - h) * (xMin - h) + k;
  const yAtEdge2 = a * (xMax - h) * (xMax - h) + k;
  const yValues = [k, yAtEdge1, yAtEdge2];
  const yLo = Math.min(...yValues), yHi = Math.max(...yValues);
  const margin = Math.max(2, Math.round((yHi - yLo) * 0.15) || 2);
  const b = -2 * a * h;
  const c = a * h * h + k;
  return {
    type: "plane",
    axes: { x: { min: xMin, max: xMax }, y: { min: yLo - margin, max: yHi + margin } },
    objects: [{ id: "f", kind: "function", fn: "quadratic", params: [a, b, c], label: "f" }],
    grid: true,
  };
}

export function renderNonlinearFnProblem(model: NonlinearFnModel, opts?: { figureMode?: NonlinearFnFigureMode }): CompiledMathProblem {
  if (model.family === "exponential") return renderExponentialFnProblem(model);
  return renderQuadraticFnProblem(model, opts);
}

function renderQuadraticFnProblem(model: QuadraticFnModel, opts?: { figureMode?: NonlinearFnFigureMode }): CompiledMathProblem {
  // 2026-09-17 버그 수정 — figureMode가 "plane"이면(관리자가 자료 포함·좌표평면을 골랐을 때)
  // 실제로 그래프를 그려서 지문이 가리키는 "the graph"가 실존하게 한다. 기본(텍스트형)은
  // 그림 없이 식만으로 성립하는 기존 문항 그대로다.
  const figureMode: NonlinearFnFigureMode = opts?.figureMode ?? "text";
  const figure: PlaneSpec | null = figureMode === "plane" ? buildPlaneFigure(model.a, model.h, model.k) : null;
  const passage = figureMode === "plane"
    ? `The function f is defined by ${vertexExpr(model.a, model.h, model.k)}. The graph of y = f(x) is shown in the xy-plane below.`
    : `The function f is defined by ${vertexExpr(model.a, model.h, model.k)}.`;
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 함수에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 함수에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  // 2026-09-17(실측, 아침 UAT) — 해설(explanation) 칸은 지문과 달리 $…$를 KaTeX로
  // 조판하지 않고 그대로 노출한다 — 해설에는 $…$ 대신 유니코드 위첨자(²)를 쓴다.
  if (model.questionKind === "evaluate") {
    const question = `What is f(${fmt(model.x0!)})?`;
    const explanation = `f(${fmt(model.x0!)}) = ${fmt(model.a)}(${fmt(model.x0!)} - ${fmt(model.h)})² ${model.k >= 0 ? "+" : "-"} ${fmt(Math.abs(model.k))} = ${fmt(model.a)} × ${fmt(model.x0! - model.h)}² ${model.k >= 0 ? "+" : "-"} ${fmt(Math.abs(model.k))} = ${model.correctAnswer}이다.`;
    const explanationEn = `f(${fmt(model.x0!)}) = ${fmt(model.a)}(${fmt(model.x0!)} - ${fmt(model.h)})² ${model.k >= 0 ? "+" : "-"} ${fmt(Math.abs(model.k))} = ${fmt(model.a)} × ${fmt(model.x0! - model.h)}² ${model.k >= 0 ? "+" : "-"} ${fmt(Math.abs(model.k))} = ${model.correctAnswer}.`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
  }
  if (model.questionKind === "vertex_x") {
    const question = "What is the x-coordinate of the vertex of the graph of f in the xy-plane?";
    const explanation = `f(x) = a(x-h)² + k 형태에서 꼭짓점은 (h, k)이므로 꼭짓점의 x좌표는 h = ${model.correctAnswer}이다.`;
    const explanationEn = `In the form f(x) = a(x-h)² + k, the vertex is (h, k), so the x-coordinate of the vertex is h = ${model.correctAnswer}.`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
  }
  const question = "What is the y-coordinate of the vertex of the graph of f in the xy-plane?";
  const explanation = `f(x) = a(x-h)² + k 형태에서 꼭짓점은 (h, k)이므로 꼭짓점의 y좌표는 k = ${model.correctAnswer}이다.`;
  const explanationEn = `In the form f(x) = a(x-h)² + k, the vertex is (h, k), so the y-coordinate of the vertex is k = ${model.correctAnswer}.`;
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}

/** "$f(t) = a · b^t$" 형태 문자열(KaTeX용, $…$로 감싼다). */
function exponentialExpr(model: ExponentialFnModel): string {
  return `$${model.context.funcName}(${model.context.varName}) = ${fmt(model.a)} \\cdot ${fmt(model.b)}^{${model.context.varName}}$`;
}

function renderExponentialFnProblem(model: ExponentialFnModel): CompiledMathProblem {
  const { context } = model;
  const passage = `The ${context.noun} after ${context.varName} ${context.timeUnit} is modeled by ${exponentialExpr(model)}, where ${context.varName} ≥ 0.`;
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 지수함수·같은 문맥에서 나올 수 있는 실제 해석·계산 오류다.",
    matches: "같은 모델에서 나온 표현이다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  if (model.questionKind === "evaluate") {
    const question = `To the nearest whole number, what is ${context.funcName}(${fmt(model.t0!)})?`;
    const explanation = `${context.funcName}(${fmt(model.t0!)}) = ${fmt(model.a)} × ${fmt(model.b)}^${fmt(model.t0!)} = ${model.correctAnswer}이다(${fmt(model.a)}에 배율 ${fmt(model.b)}를 ${fmt(model.t0!)}번 곱한 값).`;
    const explanationEn = `${context.funcName}(${fmt(model.t0!)}) = ${fmt(model.a)} × ${fmt(model.b)}^${fmt(model.t0!)} = ${model.correctAnswer} (multiply the initial value ${fmt(model.a)} by the factor ${fmt(model.b)}, ${fmt(model.t0!)} time(s)).`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  if (model.questionKind === "find_x_for_value") {
    const question = `For what value of ${context.varName} does ${context.funcName}(${context.varName}) = ${fmt(model.t0!)}?`;
    const explanation = `${fmt(model.a)} × ${fmt(model.b)}^${context.varName} = ${fmt(model.t0!)}에서 양변을 ${fmt(model.a)}로 나누면 ${fmt(model.b)}^${context.varName} = ${fmt(model.t0! / model.a)}이고, ${fmt(model.b)}를 ${model.correctAnswer}번 거듭제곱하면 이 값이 나오므로 ${context.varName} = ${model.correctAnswer}이다.`;
    const explanationEn = `From ${fmt(model.a)} × ${fmt(model.b)}^${context.varName} = ${fmt(model.t0!)}, dividing both sides by ${fmt(model.a)} gives ${fmt(model.b)}^${context.varName} = ${fmt(model.t0! / model.a)}. Raising ${fmt(model.b)} to the power ${model.correctAnswer} gives this value, so ${context.varName} = ${model.correctAnswer}.`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  const direction = model.isGrowth ? "increases" : "decreases";
  if (model.questionKind === "interpret_a") {
    const question = `What does the value ${fmt(model.a)} represent in this context?`;
    const explanation = `${context.varName} = 0을 대입하면 ${context.funcName}(0) = ${fmt(model.a)} × ${fmt(model.b)}^0 = ${fmt(model.a)}이므로, ${fmt(model.a)}는 ${context.varName} = 0일 때(모델이 시작될 때)의 ${context.noun} 값이다.`;
    const explanationEn = `Substituting ${context.varName} = 0 gives ${context.funcName}(0) = ${fmt(model.a)} × ${fmt(model.b)}^0 = ${fmt(model.a)}, so ${fmt(model.a)} is the value of the ${context.noun} when ${context.varName} = 0 (the starting value of the model).`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }
  const question = `What does the value ${fmt(model.b)} represent in this context?`;
  const explanation = `${context.varName}이 1 증가할 때마다 값에 ${fmt(model.b)}를 곱하는 것이 배율의 정의이고, ${fmt(model.b)} = 1 ${model.isGrowth ? "+" : "-"} ${model.ratePercent}/100이므로 매 ${context.timeUnit.replace(/s$/, "")}마다 ${context.noun}가 ${model.ratePercent}%씩 ${direction === "increases" ? "증가" : "감소"}함을 뜻한다.`;
  const explanationEn = `Multiplying by ${fmt(model.b)} each time ${context.varName} increases by 1 is the definition of the growth factor, and since ${fmt(model.b)} = 1 ${model.isGrowth ? "+" : "-"} ${model.ratePercent}/100, this means the ${context.noun} ${direction} by ${model.ratePercent}% each ${context.timeUnit.replace(/s$/, "")}.`;
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
