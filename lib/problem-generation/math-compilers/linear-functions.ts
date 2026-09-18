// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 두 번째 세부 기술: "Linear
// functions". f(x) = m·x + b 형태의 함수를 함수 표기(f 표기)로 다룬다. 두 변수
// 방정식(linear_equations_two_var)과 달리 "함수값 계산"·"두 점에서 기울기 구하기"가
// 질문 대상이라 오류 경로도 다르다(기울기 공식의 분자·분모를 바꾸는 실수 등).
import type { DistractorRationale, DistractorKind } from "../review";

// 2026-09-17(제품 오너 지시, Step 4 고빈도 공백 6번) — "기울기·절편의 문맥 해석".
// 실제 문맥(구독자 수, 요금 등)에 얹은 일차함수 S(t) = m·t + b에서 m(기울기)과
// b(절편)가 무엇을 뜻하는지 해석하는 문항. 숫자 계산이 아니라 "어느 문장이 맞는
// 해석인가"를 고르는 문제라 정답·오답이 전부 문장(문자열)이다. 실제 오류 경로:
// 기울기의 의미와 절편의 의미를 서로 바꿔 서술, 단위를 잘못 읽음(달마다↔해마다),
// 증가·감소 방향 착각(기울기가 음수인데 "증가"라고 서술), 무엇이 변하고 무엇이
// 고정인지를 잘못 서술하는 그럴듯한 오답.
export type LinearContext = {
  funcName: string;
  varName: string;
  /** "the number of subscribers" 처럼 변화하는 양을 가리키는 명사구(관사 없이 시작). */
  noun: string;
  unit: string;
  timeUnit: string;
};

const LINEAR_CONTEXTS: LinearContext[] = [
  { funcName: "S", varName: "t", noun: "number of subscribers to a streaming service", unit: "subscribers", timeUnit: "months" },
  { funcName: "C", varName: "n", noun: "total cost, in dollars, of a repair job", unit: "dollars", timeUnit: "hours of labor" },
  { funcName: "H", varName: "t", noun: "height of water in a tank, in centimeters,", unit: "centimeters", timeUnit: "minutes" },
  { funcName: "W", varName: "d", noun: "weight of a hiker's backpack, in pounds,", unit: "pounds", timeUnit: "days" },
];

export type LinearFunctionQuestionKind = "evaluate" | "find_x_for_value" | "slope_from_two_points" | "interpret_slope" | "interpret_intercept";
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
  /** interpret_slope/interpret_intercept 전용 — 문맥. */
  context?: LinearContext;
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

/** 문맥이 있는 문항(interpret_slope/interpret_intercept)에서는 함수·변수 이름을
 * 문맥에 맞춰 쓴다("S(t) = 250t + 1200" 처럼). */
function contextFx(m: number, b: number, context: LinearContext): string {
  const term = m === 1 ? context.varName : m === -1 ? `-${context.varName}` : `${fmt(m)}${context.varName}`;
  if (m === 0) return `${context.funcName}(${context.varName}) = ${fmt(b)}`;
  if (b === 0) return `${context.funcName}(${context.varName}) = ${term}`;
  return `${context.funcName}(${context.varName}) = ${term} ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
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

const LINEAR_INTERPRET_KINDS: LinearFunctionQuestionKind[] = ["interpret_slope", "interpret_intercept"];

function pickLinearContext(): LinearContext {
  return LINEAR_CONTEXTS[randInt(0, LINEAR_CONTEXTS.length - 1)];
}

function generateInterpretModel(params: { difficulty: LinearFunctionDifficulty; questionKind: "interpret_slope" | "interpret_intercept" }): LinearFunctionModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  const context = pickLinearContext();
  const m = randSlope(params.difficulty);
  const b = randInt(0, range * 20 + 10); // 절편은 문맥상 "시작할 때의 양"이라 음수를 피한다.
  const timeUnitSingular = context.timeUnit.replace(/s$/, "");
  const direction = m >= 0 ? "increases" : "decreases";
  const oppositeDirection = m >= 0 ? "decreases" : "increases";

  if (params.questionKind === "interpret_slope") {
    const correctAnswer = `The ${context.noun} ${direction} by ${Math.abs(m)} ${context.unit} each ${timeUnitSingular}.`;
    const rawCandidates: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: `The ${context.noun} ${oppositeDirection} by ${Math.abs(m)} ${context.unit} each ${timeUnitSingular}.`, kind: "sign_error", reason: `기울기의 부호를 반대로 읽었다 — m = ${fmt(m)}는 ${m >= 0 ? "증가" : "감소"}를 뜻한다.` },
      { value: `When ${context.varName} = 0, the ${context.noun} is ${Math.abs(m)} ${context.unit}.`, kind: "condition_ignored", reason: "기울기(변화율)의 의미를 절편(초기값)의 의미와 바꿔 서술했다." },
      { value: `The ${context.noun} ${direction} by ${Math.abs(m)} ${context.unit} each year.`, kind: "formula_misuse", reason: `단위 기간을 잘못 읽었다 — 실제 단위는 "${timeUnitSingular}"이지 "year"가 아니다.` },
      { value: `The ${context.noun} is always ${Math.abs(m)} ${context.unit}, no matter the value of ${context.varName}.`, kind: "other", reason: "변화하는 양(기울기)을 고정된 값처럼 서술했다 — 실제로는 매 기간 값이 바뀐다." },
    ];
    const seen = new Set<string>([correctAnswer]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const cand of rawCandidates) {
      if (distractors.length >= 3) break;
      if (seen.has(cand.value)) continue;
      seen.add(cand.value);
      distractors.push(cand);
    }
    return { skillCode: "linear_functions", difficulty: params.difficulty, questionKind: "interpret_slope", m, b, context, correctAnswer, distractors: distractors.slice(0, 3) };
  }

  const correctAnswer = `When ${context.varName} = 0, the ${context.noun} is ${b} ${context.unit}.`;
  const rawCandidates: { value: string; kind: DistractorKind; reason: string }[] = [
    { value: `The ${context.noun} ${direction} by ${b} ${context.unit} each ${timeUnitSingular}.`, kind: "condition_ignored", reason: "절편(초기값)의 의미를 기울기(변화율)의 의미와 바꿔 서술했다." },
    { value: `After 1 ${timeUnitSingular}, the ${context.noun} is ${b} ${context.unit}.`, kind: "sign_error", reason: `${context.varName} = 0(시작 시점)과 ${context.varName} = 1을 혼동했다 — 절편은 시작할 때의 값이다.` },
    { value: `When ${context.varName} = 0, the ${context.noun} is ${b} ${context.unit} each ${timeUnitSingular}.`, kind: "formula_misuse", reason: "고정된 시작값(절편)을 매 기간 반복되는 값처럼 서술해 단위를 잘못 붙였다." },
    { value: `The maximum possible ${context.noun} is ${b} ${context.unit}.`, kind: "other", reason: "절편을 최댓값으로 잘못 해석했다 — 절편은 시작값일 뿐 최댓값을 뜻하지 않는다." },
  ];
  const seen = new Set<string>([correctAnswer]);
  const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const cand of rawCandidates) {
    if (distractors.length >= 3) break;
    if (seen.has(cand.value)) continue;
    seen.add(cand.value);
    distractors.push(cand);
  }
  return { skillCode: "linear_functions", difficulty: params.difficulty, questionKind: "interpret_intercept", m, b, context, correctAnswer, distractors: distractors.slice(0, 3) };
}

export function generateLinearFunctionModel(params: {
  difficulty: LinearFunctionDifficulty;
  questionKind?: LinearFunctionQuestionKind;
}): LinearFunctionModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  const kinds: LinearFunctionQuestionKind[] = ["evaluate", "find_x_for_value", "slope_from_two_points"];
  if (params.questionKind && LINEAR_INTERPRET_KINDS.includes(params.questionKind)) {
    return generateInterpretModel({ difficulty: params.difficulty, questionKind: params.questionKind as "interpret_slope" | "interpret_intercept" });
  }
  // 2026-09-17(제품 오너 지시) — questionKind를 지정하지 않으면 기존 계산형 세 유형을
  // 70%, 새 문맥 해석 두 유형(slope/intercept 각 15%)을 30%로 섞는다.
  if (!params.questionKind) {
    const roll = Math.random();
    if (roll >= 0.85) return generateInterpretModel({ difficulty: params.difficulty, questionKind: "interpret_slope" });
    if (roll >= 0.7) return generateInterpretModel({ difficulty: params.difficulty, questionKind: "interpret_intercept" });
  }
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
  if (model.questionKind === "interpret_slope" || model.questionKind === "interpret_intercept") {
    if (!model.context) return { ok: false, reason: "문맥(context)이 없습니다." };
    if (model.correctAnswer.length === 0) return { ok: false, reason: "해석 문장이 비어 있습니다." };
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

  if (model.questionKind === "slope_from_two_points") {
    const { p1, p2 } = model;
    const passage = `In the xy-plane, line f passes through the points (${fmt(p1!.x)}, ${fmt(p1!.y)}) and (${fmt(p2!.x)}, ${fmt(p2!.y)}).`;
    const question = "What is the slope of line f?";
    const dy = p2!.y - p1!.y;
    const dx = p2!.x - p1!.x;
    const explanation = `기울기는 (y의 변화량) ÷ (x의 변화량) = (${fmt(dy)}) ÷ (${fmt(dx)}) = ${model.correctAnswer}이다.`;
    const explanationEn = `Slope = (change in y) ÷ (change in x) = (${fmt(dy)}) ÷ (${fmt(dx)}) = ${model.correctAnswer}.`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  const { context } = model;
  const timeUnitSingular = context!.timeUnit.replace(/s$/, "");
  const passage = `The ${context!.noun} after ${context!.varName} ${context!.timeUnit} is modeled by the function ${contextFx(model.m, model.b, context!)}.`;

  if (model.questionKind === "interpret_slope") {
    const question = `What does the value ${fmt(model.m)} represent in this context?`;
    const explanation = `함수 ${contextFx(model.m, model.b, context!)}에서 ${context!.varName}의 계수(기울기) ${fmt(model.m)}는 ${context!.varName}이 1(${timeUnitSingular}) 늘어날 때마다 ${context!.noun}가 얼마나 바뀌는지를 뜻한다. ${model.m >= 0 ? "값이 양수이므로 증가" : "값이 음수이므로 감소"}하며, 그 크기는 ${Math.abs(model.m)} ${context!.unit}이다. 따라서 "${model.correctAnswer}"가 정답이다.`;
    const explanationEn = `In ${contextFx(model.m, model.b, context!)}, the coefficient of ${context!.varName} (the slope) ${fmt(model.m)} represents how much the ${context!.noun} changes for each additional ${timeUnitSingular}. Since the value is ${model.m >= 0 ? "positive, it increases" : "negative, it decreases"}, by ${Math.abs(model.m)} ${context!.unit}. So the correct interpretation is "${model.correctAnswer}"`;
    return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
  }

  const question = `What does the value ${fmt(model.b)} represent in this context?`;
  const explanation = `함수 ${contextFx(model.m, model.b, context!)}에서 ${context!.varName} = 0을 대입하면 f(0) = ${fmt(model.b)}이므로, ${fmt(model.b)}는 ${context!.varName} = 0일 때(모델이 시작될 때)의 ${context!.noun} 값이다. 따라서 "${model.correctAnswer}"가 정답이다.`;
  const explanationEn = `In ${contextFx(model.m, model.b, context!)}, substituting ${context!.varName} = 0 gives f(0) = ${fmt(model.b)}, so ${fmt(model.b)} is the value of the ${context!.noun} when ${context!.varName} = 0 (the starting point of the model). So the correct interpretation is "${model.correctAnswer}"`;
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
