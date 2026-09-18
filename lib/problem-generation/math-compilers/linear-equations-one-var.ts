// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 첫 세부 기술: "Linear equations in
// one variable". a·x + b = c·x + d 형태의 한 변수 일차방정식을 풀어 x를 구한다.
// AI를 전혀 부르지 않는다 — 계수·정답·오답을 전부 코드로 계산한다.
import type { DistractorRationale, DistractorKind } from "../review";

export type LinearOneVarDifficulty = "easy" | "medium" | "hard";

// 2026-09-17(제품 오너 지시, Step 4 고빈도 공백 1번) — "문장제에서 일차방정식 세우기"
// (word-problem-to-linear-equation translation). 실제 시험에서 자주 나오는 형태는
// 방정식을 "푸는" 게 아니라, 서술된 문장을 보고 "어느 식이 이 상황을 나타내는가"를
// 고르는 것 — 정답은 숫자가 아니라 방정식 자기 자체(문자열)다. a·x + b = c 형태로
// 한정한다("8배보다 3 크다" = 83 같은 한 단계 관계식).
export type LinearOneVarKind = "solve" | "word_problem_translate";

/**
 * 불변 정답 모델 — a·x + b = c·x + d, 해는 x = (d-b)/(a-c). 계수는 항상 정수이고
 * 해도 항상 정수가 되도록 고른다(선택지가 지저분한 분수가 되지 않게).
 */
export type LinearOneVarModel =
  | {
      kind: "solve";
      skillCode: "linear_equations_one_var";
      difficulty: LinearOneVarDifficulty;
      a: number; b: number; c: number; d: number;
      x: number;
      correctAnswer: string;
      distractors: { value: string; kind: DistractorKind; reason: string }[];
    }
  | WordProblemTranslateModel;

/**
 * 문장제 → 방정식 모델. "a times a number x, plus/minus b, equals c" 형태의 관계를
 * 자연어 문장(항상 영어 지문, SAT 원문 관례를 따름)으로 서술하고, 그 문장을 정확히
 * 나타내는 방정식을 고르게 한다. 정답·오답 전부 "a·x + b = c" 표기를 문자열로
 * 코드가 직접 조립한다 — AI는 관여하지 않는다.
 */
export type WordProblemTranslateModel = {
  kind: "word_problem_translate";
  skillCode: "linear_equations_one_var";
  difficulty: LinearOneVarDifficulty;
  /** a·x + b = c, b는 "b more than"(양수) 또는 "b less than"(음수로 표현)이다. */
  a: number; b: number; c: number;
  /** true면 "b more than a times x", false면 "b less than a times x". */
  bIsMore: boolean;
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

export function generateLinearOneVarModel(params: { difficulty: LinearOneVarDifficulty; kind?: LinearOneVarKind }): LinearOneVarModel {
  // 2026-09-17(제품 오너 지시) — kind를 지정하지 않으면 기존 "풀기" 문항 70%,
  // "문장제 → 방정식 세우기" 문항 30%로 섞는다(실제 시험 빈도가 풀기 쪽이 더 많다).
  const kind: LinearOneVarKind = params.kind ?? (Math.random() < 0.3 ? "word_problem_translate" : "solve");
  if (kind === "word_problem_translate") return generateWordProblemTranslateModel(params);
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
    return { kind: "solve", skillCode: "linear_equations_one_var", difficulty: params.difficulty, a, b, c, d, x, correctAnswer, distractors: distractors.slice(0, 3) };
  }
  throw new Error("linear_equations_one_var: 오답 후보 생성에 실패했습니다.");
}

const WORD_RANGE_BY_DIFFICULTY: Record<LinearOneVarDifficulty, number> = { easy: 6, medium: 9, hard: 12 };
const WORD_A_RANGE_BY_DIFFICULTY: Record<LinearOneVarDifficulty, [number, number]> = {
  easy: [2, 5], medium: [3, 8], hard: [4, 12],
};

/** "a·x + b = c" 를 문자열로 조립한다("8x + 3 = 83", "8x - 3 = 83"). */
function eqString(a: number, b: number, c: number): string {
  const xTerm = a === 1 ? "x" : `${a}x`;
  if (b === 0) return `${xTerm} = ${c}`;
  return `${xTerm} ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${c}`;
}

export function generateWordProblemTranslateModel(params: { difficulty: LinearOneVarDifficulty }): WordProblemTranslateModel {
  const range = WORD_RANGE_BY_DIFFICULTY[params.difficulty];
  const [aMin, aMax] = WORD_A_RANGE_BY_DIFFICULTY[params.difficulty];
  const a = randInt(aMin, aMax);
  const b = randInt(2, range);
  const bIsMore = Math.random() < 0.5;
  // x는 임의의 양의 정수(문항에 실제로 등장하는 값은 아니고, c를 정수로 만들기 위한
  // 내부 계산용) — c = a*x + (bIsMore ? b : -b).
  const x = randInt(2, range);
  const signedB = bIsMore ? b : -b;
  const c = a * x + signedB;
  const correctAnswer = eqString(a, signedB, c);

  // 2026-09-17(제품 오너 지시) — 실제 오역 오류 경로 3가지:
  // 1) 부호 반전: "more than"을 "less than"으로(또는 반대로) 잘못 읽음.
  // 2) 괄호 오류(그룹핑 오류): "b 만큼 크다/작다"를 곱셈 안으로 잘못 넣음 → a(x±b) = c.
  //    단, a(x+b) = ax + ab이므로 우변도 그에 맞게 다시 계산해야 실제로 성립하는 오답이 된다.
  //    여기서는 "같은 표면형만 바뀐 오답"으로 c는 그대로 두고 좌변 형태만 바꾼다
  //    (학생이 실제로 이렇게 잘못 세운 식 자체가 오답 선택지가 된다 — 좌변 계산 결과가
  //    아니라 "잘못 세운 식의 모양"이 오답이다).
  // 3) 계수·상수 위치 스왑: b·x + a = c (문장에서 어느 수가 계수인지 헷갈림).
  const flippedSignB = -signedB;
  const groupingKind = "formula_misuse" as const;
  const swapKind = "condition_ignored" as const;
  const rawCandidates: { value: string; kind: DistractorKind; reason: string }[] = [
    { value: eqString(a, flippedSignB, c), kind: "sign_error", reason: `"${bIsMore ? "more than" : "less than"}"의 방향을 반대로 읽어 부호를 뒤집었다.` },
    { value: `${a}(x ${bIsMore ? "+" : "-"} ${b}) = ${c}`, kind: groupingKind, reason: `"${b} ${bIsMore ? "more than" : "less than"} a times x"를 "a times (x ${bIsMore ? "plus" : "minus"} ${b})"로 잘못 묶었다(괄호를 곱셈 안에 넣음).` },
    { value: eqString(b, a, c), kind: swapKind, reason: "계수와 상수를 서로 바꿔 세웠다(어느 수가 x에 곱해지는지 헷갈림)." },
  ];
  const seen = new Set<string>([correctAnswer]);
  const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const cand of rawCandidates) {
    if (seen.has(cand.value)) continue;
    seen.add(cand.value);
    distractors.push(cand);
  }
  // 중복으로 후보가 줄어들면(드묾) 계수를 살짝 바꾼 여분 후보로 채운다.
  if (distractors.length < 3) {
    const extra = eqString(a, signedB, c + (b || 1));
    if (!seen.has(extra)) distractors.push({ value: extra, kind: "formula_misuse", reason: "우변 상수를 잘못 옮겨 적었다." });
  }
  return {
    kind: "word_problem_translate",
    skillCode: "linear_equations_one_var",
    difficulty: params.difficulty,
    a, b: signedB, c, bIsMore,
    correctAnswer,
    distractors: distractors.slice(0, 3),
  };
}

export function validateLinearOneVarModel(model: LinearOneVarModel): { ok: true } | { ok: false; reason: string } {
  if (model.kind === "word_problem_translate") {
    if ((model.c - model.b) % model.a !== 0) return { ok: false, reason: "방정식의 해가 정수가 아닙니다." };
    const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
    if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 표현식이 중복됩니다." };
    if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
    if (!model.correctAnswer.includes(`${model.a === 1 ? "" : model.a}x`)) return { ok: false, reason: "정답 방정식에 x항이 없습니다." };
    return { ok: true };
  }
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
  explanationEn: string;
  figure: null;
  distractorRationales: DistractorRationale[];
};

/** 숫자를 서수/기수 영어 표현 없이 그대로 문장에 쓴다("8 times a number x"). */
function wordProblemPassage(model: WordProblemTranslateModel): string {
  const relation = model.bIsMore
    ? `${Math.abs(model.b)} more than ${model.a} times a number x`
    : `${Math.abs(model.b)} less than ${model.a} times a number x`;
  return `${relation.charAt(0).toUpperCase()}${relation.slice(1)} is equal to ${model.c}.`;
}

export function renderWordProblemTranslateProblem(model: WordProblemTranslateModel): CompiledMathProblem {
  const passage = wordProblemPassage(model);
  const question = "Which equation represents the statement above?";
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const relationKo = model.bIsMore ? `${model.a}x보다 ${Math.abs(model.b)} 크다` : `${model.a}x보다 ${Math.abs(model.b)} 작다`;
  const explanation = `"${model.bIsMore ? "more than" : "less than"}"은 기준값(${model.a}x)에 ${Math.abs(model.b)}를 ${model.bIsMore ? "더하는" : "빼는"} 관계다. 즉 ${relationKo}는 ${model.a}x ${model.b >= 0 ? "+" : "-"} ${Math.abs(model.b)}로 쓰고, 이것이 ${model.c}와 같으므로 ${model.correctAnswer}이다.`;
  const explanationEn = `"${model.bIsMore ? "more than" : "less than"}" means adding (or subtracting) ${Math.abs(model.b)} relative to the base value ${model.a}x. So "${model.b >= 0 ? Math.abs(model.b) + " more than" : Math.abs(model.b) + " less than"} ${model.a} times x" translates to ${model.a}x ${model.b >= 0 ? "+" : "-"} ${Math.abs(model.b)}, which equals ${model.c}. That gives ${model.correctAnswer}.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 문장을 서로 다르게(그러나 그럴듯하게) 번역한 결과다.",
    matches: "같은 문장에서 나온 표현식이다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}

export function renderLinearOneVarProblem(model: LinearOneVarModel): CompiledMathProblem {
  if (model.kind === "word_problem_translate") return renderWordProblemTranslateProblem(model);
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
  const explanationEn = `Subtracting ${sideExpr(model.c, 0)} from both sides gives ${sideExpr(diffAC, model.b)} = ${fmt(model.d)}. Moving ${fmt(model.b)} to the other side gives (${fmt(diffAC)})x = ${fmt(diffDB)}. So x = ${fmt(diffDB)} ÷ (${fmt(diffAC)}) = ${model.correctAnswer}.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 방정식에서 나올 수 있는 실제 이항·소거 오류다.",
    matches: "같은 방정식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
