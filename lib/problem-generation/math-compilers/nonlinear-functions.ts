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

/** 불변 정답 모델 — f(x) = a(x-h)^2 + k. */
export type NonlinearFnModel = {
  skillCode: "nonlinear_functions";
  difficulty: NonlinearFnDifficulty;
  questionKind: NonlinearFnQuestionKind;
  a: number; h: number; k: number;
  /** evaluate 전용. */
  x0?: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
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

export function generateNonlinearFnModel(params: {
  difficulty: NonlinearFnDifficulty;
  questionKind?: NonlinearFnQuestionKind;
}): NonlinearFnModel {
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
      return { skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, h, k, correctAnswer: fmt(correctValue), distractors };
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
    return { skillCode: "nonlinear_functions", difficulty: params.difficulty, questionKind, a, h, k, x0, correctAnswer: fmt(value), distractors };
  }
  throw new Error("nonlinear_functions: 오답 후보 생성에 실패했습니다.");
}

export function validateNonlinearFnModel(model: NonlinearFnModel): { ok: true } | { ok: false; reason: string } {
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
