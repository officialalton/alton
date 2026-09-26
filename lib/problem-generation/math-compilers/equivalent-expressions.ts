// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 세 번째 세부 기술:
// "Equivalent expressions". a(x+b) + c(x+d) 형태를 전개·동류항 정리해 mx+n 형태로
// 만들고, 그 결과와 동치인 선택지를 고르게 한다. 오답은 분배·동류항 정리에서 실제로
// 나올 수 있는 오류(음수 분배 부호 누락, 상수항에만 분배, 동류항을 잘못 더함)에서
// 계산한다.
//
// 2026-09-17(제품 오너 지시, 중간 우선순위 서브타입 추가) — "유리식 동치"
// (rational expression equivalence): 분모가 다른 두 유리식을 더해 공통분모로
// 결합한 결과와 동치인 선택지를 고르게 한다. 실제 SAT 패턴대로 두 번째 항은
// y(x-p) / (x²y - pxy) 형태로 주어 xy(x-p)로 인수분해해 약분해야 B/x로
// 단순화되는 것이 핵심이다(공통분모를 못 찾으면 못 푼다). 정답은 항상 하나의
// 정규화된(공통분모로 결합·정리된) 형태로만 제시하고, 오답은 전부 실제로
// 동치가 아닌 값으로 만든다(문자열 비교로 충분 — 대수적 동치 검사기를 따로
// 만들지 않음). 오답 4종(공통분모 없이 분자만 더함/분모 인수분해 부호 오류/
// 분배 누락/결합 시 부호 오류) 중 매 생성마다 서로 다른 값 3개를 뽑는다.
import type { DistractorRationale, DistractorKind } from "../review";

export type EquivalentExpressionsDifficulty = "easy" | "medium" | "hard";

type Distractor = { value: string; kind: DistractorKind; reason: string };

/** 불변 정답 모델(다항식) — a(x+b) + c(x+d) ≡ (a+c)x + (a*b+c*d). */
export type PolynomialDistributionModel = {
  kind: "polynomial_distribution";
  skillCode: "equivalent_expressions";
  difficulty: EquivalentExpressionsDifficulty;
  a: number; b: number; c: number; d: number;
  m: number; n: number;
  correctAnswer: string;
  distractors: Distractor[];
};

/** 불변 정답 모델(유리식) — A/(x-p) + B·y(x-p)/(x²y-pxy) ≡ A/(x-p) + B/x
 *  ≡ [(A+B)x - B*p] / [x(x-p)]. */
export type RationalEquivalenceModel = {
  kind: "rational_equivalence";
  skillCode: "equivalent_expressions";
  difficulty: EquivalentExpressionsDifficulty;
  A: number; B: number; p: number;
  numM: number; numN: number; // 결합 분자 = numM*x + numN
  correctAnswer: string;
  distractors: Distractor[];
};

export type EquivalentExpressionsModel = PolynomialDistributionModel | RationalEquivalenceModel;

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

function generatePolynomialModel(difficulty: EquivalentExpressionsDifficulty): PolynomialDistributionModel {
  const range = RANGE_BY_DIFFICULTY[difficulty];
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
    const distractors: Distractor[] = [];
    for (const cand of rawCandidates) {
      if (distractors.length >= 3) break;
      const text = linearExpr(cand.value[0], cand.value[1]);
      if (seen.has(text)) continue;
      seen.add(text);
      distractors.push({ value: text, kind: cand.kind, reason: cand.reason });
    }
    if (distractors.length < 3 && attempt < 29) continue;
    return { kind: "polynomial_distribution", skillCode: "equivalent_expressions", difficulty, a, b, c, d, m, n, correctAnswer, distractors: distractors.slice(0, 3) };
  }
  throw new Error("equivalent_expressions(polynomial_distribution): 오답 후보 생성에 실패했습니다.");
}

/** x(x-p) 형태의 공통분모 문자열(plain text — LaTeX \frac{}{} 안에 그대로 넣을 수 있다). */
function commonDenomText(p: number): string {
  return `x(x ${p >= 0 ? "-" : "+"} ${fmt(Math.abs(p))})`;
}
/** (x-p) 단독 분모 문자열(오답 1의 "공통분모 못 찾음" 경로에 쓰는 원래 첫 항의 분모). */
function firstDenomText(p: number): string {
  return `x ${p >= 0 ? "-" : "+"} ${fmt(Math.abs(p))}`;
}
/** 유리식 결합 분자·분모를 "분자@@분모" 형태의 불변 값 문자열로 인코딩한다 — 정답/오답의
 * 동등성 비교(Set 중복 검사)에는 이 문자열을 그대로 쓰고, 실제 렌더링 시점에만
 * toLatexFrac()으로 KaTeX \frac{}{}로 바꾼다. 분모 문자열 자체에 괄호가 섞여 있어
 * (예: "x(x - 5)") "(num)/(denom)" 패턴으로는 정규식으로 안전하게 되짤 수 없어
 * "@@" 구분자를 쓴다. */
function ratioAnswer(numM: number, numN: number, denom: string): string {
  return `${linearExpr(numM, numN)}@@${denom}`;
}

function generateRationalModel(difficulty: EquivalentExpressionsDifficulty): RationalEquivalenceModel {
  const range = RANGE_BY_DIFFICULTY[difficulty];
  for (let attempt = 0; attempt < 30; attempt++) {
    const A = nonZero(-range, range);
    const B = nonZero(-range, range);
    const p = nonZero(-range, range);
    // A/(x-p) + B*y(x-p)/(x²y-pxy) ≡ A/(x-p) + B/x ≡ [(A+B)x - B*p] / [x(x-p)]
    const numM = A + B;
    const numN = -B * p;
    if (numM === 0 && attempt < 29) continue; // x항이 사라지면 취지가 없어진다.
    const denom = commonDenomText(p);
    const correctAnswer = ratioAnswer(numM, numN, denom);

    // 실제 오류 경로 4종 — 매번 3개를 뽑는다.
    // (1) 공통분모를 구하지 않고 분자만 더해 원래 분모(x-p) 위에 그대로 얹음
    //     (두 번째 항을 B/x로 단순화한 뒤에도 분모가 다르다는 걸 무시).
    const d1: Distractor = { value: ratioAnswer(0, A + B, firstDenomText(p)), kind: "step_missing", reason: "공통분모를 구하지 않고, 두 번째 항을 B/x로 단순화한 뒤 분자만 그대로 더해 첫 번째 항의 분모(x-p) 위에 얹었다." };
    // (2) x²y-pxy를 xy(x-p)가 아니라 xy(p-x)로 잘못 인수분해해 두 번째 항이
    //     B/x가 아니라 -B/x로 약분됨(부호가 반대인 인수를 뽑아냄).
    const d2: Distractor = { value: ratioAnswer(A - B, B * p, denom), kind: "formula_misuse", reason: "분모 x²y-pxy를 xy(x-p)가 아니라 xy(p-x)로 잘못 인수분해해, 두 번째 항이 B/x가 아니라 -B/x로 약분됐다." };
    // (3) 공통분모는 맞게 구했지만 B(x-p)를 분배할 때 상수항에는 B를 곱하지
    //     않음(Bx - p로 계산, Bx - Bp가 아님).
    const d3: Distractor = { value: ratioAnswer(numM, -p, denom), kind: "step_missing", reason: "공통분모 x(x-p)는 맞게 구했지만, B(x-p)를 분배할 때 상수항 p에는 B를 곱하지 않고 그대로 뺐다." };
    // (4) 공통분모로 결합하는 과정에서 상수항의 부호를 반대로 계산함.
    const d4: Distractor = { value: ratioAnswer(numM, B * p, denom), kind: "sign_error", reason: "공통분모로 결합할 때 -B*p의 부호를 반대로 계산해 상수항 부호가 뒤집혔다." };

    const rawCandidates: Distractor[] = [d1, d2, d3, d4];
    const seen = new Set<string>([correctAnswer]);
    const distractors: Distractor[] = [];
    for (const cand of rawCandidates) {
      if (distractors.length >= 3) break;
      if (seen.has(cand.value)) continue;
      seen.add(cand.value);
      distractors.push(cand);
    }
    if (distractors.length < 3 && attempt < 29) continue;
    return { kind: "rational_equivalence", skillCode: "equivalent_expressions", difficulty, A, B, p, numM, numN, correctAnswer, distractors: distractors.slice(0, 3) };
  }
  throw new Error("equivalent_expressions(rational_equivalence): 오답 후보 생성에 실패했습니다.");
}

export function generateEquivalentExpressionsModel(params: { difficulty: EquivalentExpressionsDifficulty; kind?: EquivalentExpressionsModel["kind"] }): EquivalentExpressionsModel {
  const kind = params.kind ?? (Math.random() < 0.5 ? "rational_equivalence" : "polynomial_distribution");
  return kind === "rational_equivalence" ? generateRationalModel(params.difficulty) : generatePolynomialModel(params.difficulty);
}

function validateCommon(model: EquivalentExpressionsModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  return { ok: true };
}

export function validateEquivalentExpressionsModel(model: EquivalentExpressionsModel): { ok: true } | { ok: false; reason: string } {
  if (model.kind === "rational_equivalence") {
    if (model.numM !== model.A + model.B) return { ok: false, reason: "결합 분자의 x계수가 A+B와 일치하지 않습니다." };
    if (model.numN !== -model.B * model.p) return { ok: false, reason: "결합 분자의 상수항이 -B*p와 일치하지 않습니다." };
    if (model.p === 0) return { ok: false, reason: "p가 0이면 분모가 x-p가 아니라 x가 됩니다." };
    return validateCommon(model);
  }
  if (model.m !== model.a + model.c) return { ok: false, reason: "x의 계수가 a+c와 일치하지 않습니다." };
  if (model.n !== model.a * model.b + model.c * model.d) return { ok: false, reason: "상수항이 a*b+c*d와 일치하지 않습니다." };
  return validateCommon(model);
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

/** ratioAnswer()가 만든 "분자@@분모" 문자열을 KaTeX \frac{}{}로 바꾼다. */
function toLatexFrac(ratio: string): string {
  const idx = ratio.indexOf("@@");
  if (idx < 0) return ratio;
  return `\\frac{${ratio.slice(0, idx)}}{${ratio.slice(idx + 2)}}`;
}

function renderRationalProblem(model: RationalEquivalenceModel): CompiledMathProblem {
  const pAbsY = fmt(Math.abs(model.p));
  const pCoefMag = coefMagnitude(model.p); // 분모 계수 1은 찍지 않는다("1xy"가 아니라 "xy").
  const denomOp = model.p >= 0 ? "-" : "+";
  const firstTerm = `\\frac{${fmt(model.A)}}{${firstDenomText(model.p)}}`;
  const secondNumMag = coefMagnitude(model.B);
  const secondOp = model.B >= 0 ? "+" : "-";
  const secondTerm = `\\frac{${secondNumMag}y(x ${denomOp} ${pAbsY})}{x^2y ${denomOp} ${pCoefMag}xy}`;
  const passage = `Consider the expression shown, where x is not equal to 0${model.p !== 0 ? ` or ${fmt(model.p)}` : ""} and y is not equal to 0.\n\n$${firstTerm} ${secondOp} ${secondTerm}$`;
  const question = "Which of the following is equivalent to the expression shown?";

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => `$${toLatexFrac(options[i])}$`);
  const correctIndex = order.indexOf(0);

  const denomPlain = `x(x ${denomOp} ${pAbsY})`;
  const bMag = fmt(Math.abs(model.B));
  const bOp = model.B >= 0 ? "+" : "-";
  const reducedSecondTerm = `${model.B >= 0 ? "" : "-"}${fmt(Math.abs(model.B))}/x`;
  const explanation = `x²y ${denomOp} ${pCoefMag}xy = xy(x ${denomOp} ${pAbsY})이므로, 두 번째 항의 분자·분모를 xy(x ${denomOp} ${pAbsY})로 약분하면 ${reducedSecondTerm}이다. 두 항의 분모가 서로 달라(x ${denomOp} ${pAbsY}과 x) 공통분모 ${denomPlain}로 통일하면 첫 번째 항은 ${fmt(model.A)}x/[${denomPlain}], 두 번째 항은 ${bMag}(x ${denomOp} ${pAbsY})/[${denomPlain}]이다. 분자를 더하면 ${fmt(model.A)}x ${bOp} ${bMag}(x ${denomOp} ${pAbsY}) = ${fmt(model.numM)}x ${model.numN >= 0 ? "+" : "-"} ${fmt(Math.abs(model.numN))}이다. 따라서 답은 (${linearExpr(model.numM, model.numN)})/(${denomPlain})이다.`;
  const explanationEn = `Since x²y ${denomOp} ${pCoefMag}xy = xy(x ${denomOp} ${pAbsY}), reducing the second term's numerator and denominator by xy(x ${denomOp} ${pAbsY}) gives ${reducedSecondTerm}. Rewriting both terms over the common denominator ${denomPlain} gives ${fmt(model.A)}x/[${denomPlain}] ${bOp} ${bMag}(x ${denomOp} ${pAbsY})/[${denomPlain}]. Adding the numerators: ${fmt(model.A)}x ${bOp} ${bMag}(x ${denomOp} ${pAbsY}) = ${fmt(model.numM)}x ${model.numN >= 0 ? "+" : "-"} ${fmt(Math.abs(model.numN))}. So the answer is (${linearExpr(model.numM, model.numN)})/(${denomPlain}).`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 유리식을 공통분모로 결합하는 과정에서 나올 수 있는 실제 오류다.",
    matches: "같은 식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}

function renderPolynomialProblem(model: PolynomialDistributionModel): CompiledMathProblem {
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

export function renderEquivalentExpressionsProblem(model: EquivalentExpressionsModel): CompiledMathProblem {
  return model.kind === "rational_equivalence" ? renderRationalProblem(model) : renderPolynomialProblem(model);
}
