// 2026-09-17(제품 오너 지시) — 결정적(Zero-AI) Math 컴파일러: "Right triangles and trigonometry".
// 피타고라스 정리(빗변/직각변 구하기)와 삼각비(sin/cos/tan)를 코드로 계산한다.
// 항상 정수 변을 갖는 피타고라스 삼조(triple)를 기본 배수로 써서 답이 항상 깔끔한
// 정수 또는 기약분수가 되게 한다 — 무리수(제곱근) 결과는 이 1차 범위 밖이다.
import type { TriangleSpec } from "@/lib/problem-figures/templates/triangle";
import type { DistractorRationale, DistractorKind } from "../review";

export type RightTriDifficulty = "easy" | "medium" | "hard";
export type RightTriQuestionKind = "pythagorean_hypotenuse" | "pythagorean_leg" | "trig_ratio";
export type TrigFn = "sin" | "cos" | "tan";

export type RightTriModel = {
  skillCode: "right_triangles_trigonometry";
  difficulty: RightTriDifficulty;
  questionKind: RightTriQuestionKind;
  /** 피타고라스 삼조(직각변1, 직각변2, 빗변) — scale 적용 후 값. */
  leg1: number;
  leg2: number;
  hyp: number;
  trigFn?: TrigFn;
  /** trig_ratio에서 각을 어느 꼭짓점(B|C, 직각 아님)에 두는가. */
  atVertex?: "B" | "C";
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

const PRIMITIVE_TRIPLES: [number, number, number][] = [
  [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41],
];

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}
function fmtFrac(num: number, den: number): string {
  const g = gcd(num, den) || 1;
  const n = num / g, d = den / g;
  return d === 1 ? fmt(n) : `${fmt(n)}/${fmt(d)}`;
}

const SCALE_RANGE_BY_DIFFICULTY: Record<RightTriDifficulty, [number, number]> = {
  easy: [1, 1],
  medium: [1, 2],
  hard: [2, 4],
};

function pickTriple(difficulty: RightTriDifficulty): { leg1: number; leg2: number; hyp: number } {
  const [a, b, c] = PRIMITIVE_TRIPLES[randInt(0, PRIMITIVE_TRIPLES.length - 1)];
  const [smin, smax] = SCALE_RANGE_BY_DIFFICULTY[difficulty];
  const scale = randInt(smin, smax);
  return { leg1: a * scale, leg2: b * scale, hyp: c * scale };
}

const KINDS_BY_DIFFICULTY: Record<RightTriDifficulty, RightTriQuestionKind[]> = {
  easy: ["pythagorean_hypotenuse"],
  medium: ["pythagorean_leg", "trig_ratio"],
  hard: ["trig_ratio", "pythagorean_hypotenuse"],
};

function pickUnique(
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

export function generateRightTriModel(params: {
  difficulty: RightTriDifficulty;
  questionKind?: RightTriQuestionKind;
}): RightTriModel {
  const pool = KINDS_BY_DIFFICULTY[params.difficulty];
  const questionKind = params.questionKind ?? pool[randInt(0, pool.length - 1)];

  for (let attempt = 0; attempt < 30; attempt++) {
    const { leg1, leg2, hyp } = pickTriple(params.difficulty);

    if (questionKind === "pythagorean_hypotenuse") {
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(leg1 + leg2), kind: "formula_misuse", reason: "제곱합의 제곱근을 구하지 않고 두 직각변을 그냥 더했다." },
        { value: fmt(leg1 * leg1 + leg2 * leg2), kind: "formula_misuse", reason: "제곱의 합까지만 구하고 제곱근을 취하는 것을 잊었다." },
        { value: fmt(Math.abs(leg1 - leg2)), kind: "geometry_misapplied", reason: "한 직각변을 빗변으로 착각해 나머지 변을 빼서 계산했다." },
      ];
      const distractors = pickUnique(cands, fmt(hyp));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "right_triangles_trigonometry", difficulty: params.difficulty, questionKind, leg1, leg2, hyp, correctAnswer: fmt(hyp), distractors };
    }

    if (questionKind === "pythagorean_leg") {
      // 빗변과 leg1을 주고 leg2를 구한다.
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(Math.round(Math.sqrt(hyp * hyp + leg1 * leg1))), kind: "sign_error", reason: "빗변에서 직각변을 빼야 하는데 오히려 더해서 계산했다." },
        { value: fmt(hyp - leg1), kind: "formula_misuse", reason: "제곱·제곱근을 쓰지 않고 단순히 두 변을 뺐다." },
        { value: fmt(leg1), kind: "condition_ignored", reason: "구해야 할 다른 직각변이 주어진 직각변과 같다고 착각했다." },
      ];
      const distractors = pickUnique(cands, fmt(leg2));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "right_triangles_trigonometry", difficulty: params.difficulty, questionKind, leg1, leg2, hyp, correctAnswer: fmt(leg2), distractors };
    }

    // trig_ratio — 각은 B 또는 C(직각이 아닌 꼭짓점)에 둔다. B의 대변 = leg2(A-C 변), 인접변 = leg1(A-B 변).
    const trigFns: TrigFn[] = ["sin", "cos", "tan"];
    const trigFn = trigFns[randInt(0, 2)];
    const atVertex: "B" | "C" = randInt(0, 1) === 0 ? "B" : "C";
    // atVertex B: 대변 = leg2, 인접변 = leg1, 빗변 = hyp. atVertex C: 대변 = leg1, 인접변 = leg2, 빗변 = hyp.
    const opp = atVertex === "B" ? leg2 : leg1;
    const adj = atVertex === "B" ? leg1 : leg2;
    const sinVal: [number, number] = [opp, hyp];
    const cosVal: [number, number] = [adj, hyp];
    const tanVal: [number, number] = [opp, adj];
    const [correctNum, correctDen] = trigFn === "sin" ? sinVal : trigFn === "cos" ? cosVal : tanVal;
    const correctAnswer = fmtFrac(correctNum, correctDen);
    const others: { fn: TrigFn; pair: [number, number] }[] =
      trigFn === "sin" ? [{ fn: "cos", pair: cosVal }, { fn: "tan", pair: tanVal }]
      : trigFn === "cos" ? [{ fn: "sin", pair: sinVal }, { fn: "tan", pair: tanVal }]
      : [{ fn: "sin", pair: sinVal }, { fn: "cos", pair: cosVal }];

    const cands: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: fmtFrac(others[0].pair[0], others[0].pair[1]), kind: "geometry_misapplied", reason: `${trigFn} 대신 ${others[0].fn}을 계산했다(대변·인접변·빗변 혼동).` },
      { value: fmtFrac(others[1].pair[0], others[1].pair[1]), kind: "geometry_misapplied", reason: `${trigFn} 대신 ${others[1].fn}을 계산했다(대변·인접변·빗변 혼동).` },
      { value: fmtFrac(correctDen, correctNum), kind: "formula_misuse", reason: "분자와 분모를 뒤집어(역수) 계산했다." },
    ];
    const distractors = pickUnique(cands, correctAnswer);
    if (distractors.length < 3 && attempt < 29) continue;
    return {
      skillCode: "right_triangles_trigonometry", difficulty: params.difficulty, questionKind,
      leg1, leg2, hyp, trigFn, atVertex, correctAnswer, distractors,
    };
  }
  throw new Error("right_triangles_trigonometry: 오답 후보 생성에 실패했습니다.");
}

export function validateRightTriModel(model: RightTriModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  const check = model.leg1 * model.leg1 + model.leg2 * model.leg2 === model.hyp * model.hyp;
  if (!check) return { ok: false, reason: "세 변이 피타고라스 정리를 만족하지 않습니다." };
  if (model.questionKind === "pythagorean_hypotenuse" && model.correctAnswer !== fmt(model.hyp)) return { ok: false, reason: "빗변 정답이 일치하지 않습니다." };
  if (model.questionKind === "pythagorean_leg" && model.correctAnswer !== fmt(model.leg2)) return { ok: false, reason: "직각변 정답이 일치하지 않습니다." };
  if (model.questionKind === "trig_ratio") {
    if (!model.trigFn || !model.atVertex) return { ok: false, reason: "삼각비 문항에 필요한 값이 없습니다." };
    const opp = model.atVertex === "B" ? model.leg2 : model.leg1;
    const adj = model.atVertex === "B" ? model.leg1 : model.leg2;
    const expected = model.trigFn === "sin" ? fmtFrac(opp, model.hyp) : model.trigFn === "cos" ? fmtFrac(adj, model.hyp) : fmtFrac(opp, adj);
    if (model.correctAnswer !== expected) return { ok: false, reason: "삼각비 정답이 일치하지 않습니다." };
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
  figure: TriangleSpec | null;
  distractorRationales: DistractorRationale[];
};

export function renderRightTriProblem(model: RightTriModel): CompiledMathProblem {
  const question =
    model.questionKind === "pythagorean_hypotenuse" ? "What is the length of the hypotenuse of the right triangle shown?"
    : model.questionKind === "pythagorean_leg" ? "What is the length of side AC of the right triangle shown?"
    : `What is ${model.trigFn}(angle ${model.atVertex}) in the right triangle shown?`;

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 직각삼각형에서 실제로 나올 수 있는 계산 오류다.",
    matches: "같은 변 길이에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  // 삼각형 표준: A = 직각, B = 오른쪽 아래(leg1과 인접), C = 위(leg2와 인접). AB = leg1, AC = leg2, BC = hyp.
  let passage: string;
  let explanation: string;
  let explanationEn: string;
  let figure: TriangleSpec;

  if (model.questionKind === "pythagorean_hypotenuse") {
    passage = `In right triangle ABC, the right angle is at A, AB = ${model.leg1}, and AC = ${model.leg2}, as shown in the figure.`;
    explanation = `피타고라스 정리에 따라 빗변² = 직각변1² + 직각변2² = ${model.leg1}² + ${model.leg2}² = ${model.leg1 * model.leg1} + ${model.leg2 * model.leg2} = ${model.leg1 * model.leg1 + model.leg2 * model.leg2}이다. 따라서 빗변 = √${model.leg1 * model.leg1 + model.leg2 * model.leg2} = ${fmt(model.hyp)}이다.`;
    explanationEn = `By the Pythagorean theorem, hypotenuse² = leg1² + leg2² = ${model.leg1}² + ${model.leg2}² = ${model.leg1 * model.leg1} + ${model.leg2 * model.leg2} = ${model.leg1 * model.leg1 + model.leg2 * model.leg2}. So the hypotenuse = √${model.leg1 * model.leg1 + model.leg2 * model.leg2} = ${fmt(model.hyp)}.`;
    figure = { type: "triangle", vertices: ["A", "B", "C"], kind: "right", rightAngleAt: "A", sides: [
      { between: ["A", "B"], label: fmt(model.leg1) },
      { between: ["A", "C"], label: fmt(model.leg2) },
    ] };
  } else if (model.questionKind === "pythagorean_leg") {
    passage = `In right triangle ABC, the right angle is at A, AB = ${model.leg1}, and BC = ${model.hyp}, as shown in the figure.`;
    explanation = `피타고라스 정리에 따라 AC² = BC² − AB² = ${model.hyp}² − ${model.leg1}² = ${model.hyp * model.hyp} − ${model.leg1 * model.leg1} = ${model.hyp * model.hyp - model.leg1 * model.leg1}이다. 따라서 AC = √${model.hyp * model.hyp - model.leg1 * model.leg1} = ${fmt(model.leg2)}이다.`;
    explanationEn = `By the Pythagorean theorem, AC² = BC² − AB² = ${model.hyp}² − ${model.leg1}² = ${model.hyp * model.hyp} − ${model.leg1 * model.leg1} = ${model.hyp * model.hyp - model.leg1 * model.leg1}. So AC = √${model.hyp * model.hyp - model.leg1 * model.leg1} = ${fmt(model.leg2)}.`;
    figure = { type: "triangle", vertices: ["A", "B", "C"], kind: "right", rightAngleAt: "A", sides: [
      { between: ["A", "B"], label: fmt(model.leg1) },
      { between: ["B", "C"], label: fmt(model.hyp) },
    ] };
  } else {
    const opp = model.atVertex === "B" ? model.leg2 : model.leg1;
    const adj = model.atVertex === "B" ? model.leg1 : model.leg2;
    const oppSide = model.atVertex === "B" ? "AC" : "AB";
    const adjSide = model.atVertex === "B" ? "AB" : "AC";
    passage = `In right triangle ABC, the right angle is at A, AB = ${model.leg1}, and AC = ${model.leg2}, as shown in the figure.`;
    const ratioWord = model.trigFn === "sin" ? "대변/빗변" : model.trigFn === "cos" ? "인접변/빗변" : "대변/인접변";
    const ratioWordEn = model.trigFn === "sin" ? "opposite/hypotenuse" : model.trigFn === "cos" ? "adjacent/hypotenuse" : "opposite/adjacent";
    const denVal = model.trigFn === "tan" ? adj : model.hyp;
    explanation = `각 ${model.atVertex}에서 대변은 ${oppSide}(= ${opp}), 인접변은 ${adjSide}(= ${adj}), 빗변은 BC(= ${model.hyp})이다. ${model.trigFn}(${model.atVertex}) = ${ratioWord} = ${opp}/${denVal} = ${model.correctAnswer}이다.`;
    explanationEn = `At angle ${model.atVertex}, the opposite side is ${oppSide}(= ${opp}), the adjacent side is ${adjSide}(= ${adj}), and the hypotenuse is BC(= ${model.hyp}). ${model.trigFn}(${model.atVertex}) = ${ratioWordEn} = ${opp}/${denVal} = ${model.correctAnswer}.`;
    figure = { type: "triangle", vertices: ["A", "B", "C"], kind: "right", rightAngleAt: "A", sides: [
      { between: ["A", "B"], label: fmt(model.leg1) },
      { between: ["A", "C"], label: fmt(model.leg2) },
    ], angles: [{ at: model.atVertex! }] };
  }

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}
