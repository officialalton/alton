// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 네 번째 세부 기술:
// "Nonlinear equations and systems". x² + bx + c = 0(정수 근으로 인수분해되는
// 이차방정식)의 근·근의 합/곱, 그리고 판별식 부호로 실근 개수를 판정한다. 일차식
// 엔진과 달리 "정수 근 두 개를 먼저 고르고 계수를 역산" 방식으로 항상 깔끔한
// 근을 보장한다 — 분수근이나 복소근은 이 1차 범위 밖이다.
import type { DistractorRationale, DistractorKind } from "../review";

export type NonlinearEqQuestionKind = "root" | "sum_of_roots" | "product_of_roots" | "num_real_solutions";
export type NonlinearEqDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — x² + bx + c = 0, 근은 r1, r2(정수). b = -(r1+r2), c = r1*r2. */
export type NonlinearEqModel = {
  skillCode: "nonlinear_equations_systems";
  difficulty: NonlinearEqDifficulty;
  questionKind: NonlinearEqQuestionKind;
  b: number;
  c: number;
  /** root/sum/product 문항 — 실근 두 개(중근이면 r1=r2). */
  r1?: number;
  r2?: number;
  /** num_real_solutions 문항 — 판별식 값(부호만 의미 있음). */
  discriminant?: number;
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
 * "$x^2 + bx + c$" — SAT 표기(계수 1 생략, 부호 정리, b/c=0이면 항 생략).
 * 2026-09-17(실측, 아침 UAT) — "^2"는 $…$ 수식 기호 밖에서는 위첨자로 조판되지
 * 않고 캐럿 글자 그대로 노출된다("x^2" 문자 그대로) — 반드시 $…$로 감싼다.
 */
function quadExpr(b: number, c: number): string {
  const bTerm = b === 0 ? "" : ` ${b >= 0 ? "+" : "-"} ${b === 1 || b === -1 ? "" : fmt(Math.abs(b))}x`;
  const cTerm = c === 0 ? "" : ` ${c >= 0 ? "+" : "-"} ${fmt(Math.abs(c))}`;
  return `x^2${bTerm}${cTerm}`;
}
/** "$x^2 + bx + c = 0$" 전체를 하나의 수식 블록으로. */
function quadEquation(b: number, c: number): string {
  return `$${quadExpr(b, c)} = 0$`;
}

const ROOT_RANGE_BY_DIFFICULTY: Record<NonlinearEqDifficulty, number> = { easy: 5, medium: 7, hard: 9 };

export function generateNonlinearEqModel(params: {
  difficulty: NonlinearEqDifficulty;
  questionKind?: NonlinearEqQuestionKind;
}): NonlinearEqModel {
  const range = ROOT_RANGE_BY_DIFFICULTY[params.difficulty];
  const kinds: NonlinearEqQuestionKind[] = ["root", "sum_of_roots", "product_of_roots", "num_real_solutions"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];

  if (questionKind === "num_real_solutions") {
    // 판별식 D = b^2 - 4c 부호로 실근 개수를 정한다(a=1 고정 — 항상 부호만 문제).
    const roll = randInt(0, 2);
    for (let attempt = 0; attempt < 30; attempt++) {
      let b = nonZero(-range, range);
      let c: number;
      let discriminant: number;
      let correctAnswer: string;
      if (roll === 0) {
        // 서로 다른 실근 두 개 — D > 0. r1 != r2 두 정수를 먼저 고르고 역산.
        const r1 = randInt(-range, range);
        let r2 = randInt(-range, range);
        if (r2 === r1) r2 = r1 + 1;
        c = r1 * r2;
        discriminant = b * b - 4 * c;
        if (discriminant <= 0) continue;
        correctAnswer = "서로 다른 두 실근";
      } else if (roll === 1) {
        // 중근 하나 — D = 0, c = (b/2)^2 (b가 짝수여야 정수 중근).
        b = b % 2 === 0 ? b : b + 1;
        c = (b / 2) * (b / 2);
        discriminant = b * b - 4 * c;
        correctAnswer = "중근 하나";
      } else {
        // 실근 없음 — D < 0.
        c = range * range + Math.abs(b) + 1; // 충분히 크게 잡아 b^2-4c < 0 보장.
        discriminant = b * b - 4 * c;
        correctAnswer = "실근 없음";
      }
      const result = finishNumRealSolutions(params.difficulty, b, c, discriminant, correctAnswer);
      if (result) return result;
    }
    throw new Error("nonlinear_equations_systems(num_real_solutions): 생성 실패");
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const r1 = randInt(-range, range);
    let r2 = randInt(-range, range);
    if (r2 === r1) r2 = r1 + (r1 >= range ? -1 : 1);
    const b = -(r1 + r2);
    const c = r1 * r2;

    if (questionKind === "root") {
      // 항상 "더 큰 근"을 묻는다 — 어느 근인지 애매하지 않게.
      const bigger = Math.max(r1, r2);
      const smaller = Math.min(r1, r2);
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: smaller, kind: "condition_ignored", reason: "더 큰 근이 아니라 작은 근을 답으로 골랐다." },
        { value: -bigger, kind: "sign_error", reason: "인수분해 후 부호를 반대로 계산했다(x-r이 아니라 x+r로 착각)." },
        { value: -smaller, kind: "sign_error", reason: "작은 근의 부호까지 반대로 계산했다." },
      ];
      const distractors = pickUnique(cands, fmt(bigger));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "nonlinear_equations_systems", difficulty: params.difficulty, questionKind, b, c, r1, r2, correctAnswer: fmt(bigger), distractors };
    }

    if (questionKind === "sum_of_roots") {
      const sum = r1 + r2;
      // 2026-09-17 — b는 정의상 항상 -(r1+r2) = -sum이므로 "-sum"과 "b를 그대로 씀"은
      // 같은 값이라 서로 다른 오답이 될 수 없다(실측으로 발견). b(=-sum, 부호 반전
      // 오류)·근의 곱(c)·근을 빼서 계산(부호를 놓침)한 값 셋으로 바꾼다.
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: b, kind: "sign_error", reason: "근의 합이 -b라는 공식에서 부호를 반대로 계산했다." },
        { value: c, kind: "condition_ignored", reason: "근의 합 대신 근의 곱(c)을 답으로 썼다." },
        { value: r1 - r2, kind: "formula_misuse", reason: "두 근을 더하지 않고 빼서 계산했다." },
      ];
      const distractors = pickUnique(cands, fmt(sum));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "nonlinear_equations_systems", difficulty: params.difficulty, questionKind, b, c, r1, r2, correctAnswer: fmt(sum), distractors };
    }

    // product_of_roots
    const product = r1 * r2;
    // 2026-09-17 — 위와 같은 이유로 "-product"와 "b"가 우연히 같은 값이 되는 경우는
    // 없지만(c와 b는 독립), 근의 곱을 두 근의 차로 착각하는 실제 오류를 대신 쓴다.
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: -product, kind: "sign_error", reason: "근의 곱 공식(c)의 부호를 반대로 계산했다." },
      { value: b, kind: "condition_ignored", reason: "근의 곱 대신 근의 합에 관련된 값(-b)을 답으로 썼다." },
      { value: r1 - r2, kind: "formula_misuse", reason: "두 근을 곱하지 않고 빼서 계산했다." },
    ];
    const distractors = pickUnique(cands, fmt(product));
    if (distractors.length < 3 && attempt < 29) continue;
    return { skillCode: "nonlinear_equations_systems", difficulty: params.difficulty, questionKind, b, c, r1, r2, correctAnswer: fmt(product), distractors };
  }
  throw new Error("nonlinear_equations_systems: 오답 후보 생성에 실패했습니다.");
}

function pickUnique(
  cands: { value: number; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    const text = fmt(c.value);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ value: text, kind: c.kind, reason: c.reason });
  }
  return out;
}

function finishNumRealSolutions(
  difficulty: NonlinearEqDifficulty,
  b: number,
  c: number,
  discriminant: number,
  correctAnswer: string
): NonlinearEqModel | null {
  // 2026-09-17 — 실제 범주는 3개(두 실근/중근/실근 없음)뿐이라 정답을 뺀 나머지가
  // 2개밖에 안 나온다. 일차방정식(무한히 많은 해가 가능)과 혼동하는 실제 오개념을
  // 4번째 범주로 추가해 오답 3개를 항상 채운다.
  const rawCands: { value: string; kind: DistractorKind; reason: string }[] = [
    { value: "서로 다른 두 실근", kind: "condition_ignored", reason: "판별식의 부호를 잘못 읽어 실근이 두 개라고 착각했다." },
    { value: "중근 하나", kind: "condition_ignored", reason: "판별식이 0이 아닌데 0이라고 착각했다." },
    { value: "실근 없음", kind: "condition_ignored", reason: "판별식이 음수가 아닌데 음수라고 착각해 실근이 없다고 답했다." },
    { value: "근이 무수히 많음", kind: "other", reason: "일차방정식처럼 이차방정식도 근이 무수히 많을 수 있다고 착각했다." },
  ];
  const distractors = rawCands.filter((c) => c.value !== correctAnswer).slice(0, 3);
  if (distractors.length !== 3) return null;
  return {
    skillCode: "nonlinear_equations_systems", difficulty, questionKind: "num_real_solutions",
    b, c, discriminant, correctAnswer, distractors,
  };
}

export function validateNonlinearEqModel(model: NonlinearEqModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "num_real_solutions") {
    if (model.discriminant === undefined) return { ok: false, reason: "판별식이 없습니다." };
    const d = model.discriminant;
    const expected = d > 0 ? "서로 다른 두 실근" : d === 0 ? "중근 하나" : "실근 없음";
    if (expected !== model.correctAnswer) return { ok: false, reason: "판별식과 정답 범주가 일치하지 않습니다." };
    return { ok: true };
  }
  if (model.r1 === undefined || model.r2 === undefined) return { ok: false, reason: "근이 계산되지 않았습니다." };
  // 근이 실제로 x^2+bx+c=0을 만족하는지 확인.
  const check = (r: number) => r * r + model.b * r + model.c === 0;
  if (!check(model.r1) || !check(model.r2)) return { ok: false, reason: "근이 방정식을 만족하지 않습니다." };
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

const QUESTION_TEXT: Record<NonlinearEqQuestionKind, string> = {
  root: "이 방정식의 해 중 더 큰 값은?",
  sum_of_roots: "이 방정식의 두 근의 합은?",
  product_of_roots: "이 방정식의 두 근의 곱은?",
  num_real_solutions: "이 방정식의 서로 다른 실근의 개수는?",
};

export function renderNonlinearEqProblem(model: NonlinearEqModel): CompiledMathProblem {
  const passage = `다음 방정식을 보자.\n\n${quadEquation(model.b, model.c)}`;
  const question = QUESTION_TEXT[model.questionKind];
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  let explanation: string;
  if (model.questionKind === "num_real_solutions") {
    explanation = `판별식은 $b^2 - 4c = ${fmt(model.b)}^2 - 4×${fmt(model.c)} = ${fmt(model.discriminant!)}$이다. ${model.discriminant! > 0 ? "0보다 크므로 서로 다른 두 실근을 갖는다." : model.discriminant === 0 ? "0이므로 중근을 하나 갖는다." : "0보다 작으므로 실근이 없다."} 따라서 ${model.correctAnswer}이다.`;
  } else {
    const bSign = -model.b >= 0 ? "+" : "-";
    explanation = `$${quadExpr(model.b, model.c)} = (x ${model.r1! >= 0 ? "-" : "+"} ${fmt(Math.abs(model.r1!))})(x ${model.r2! >= 0 ? "-" : "+"} ${fmt(Math.abs(model.r2!))})$로 인수분해되므로 근은 ${fmt(model.r1!)}, ${fmt(model.r2!)}이다. `;
    if (model.questionKind === "root") explanation += `더 큰 값은 ${model.correctAnswer}이다.`;
    else if (model.questionKind === "sum_of_roots") explanation += `두 근의 합은 -b = ${bSign}${fmt(Math.abs(model.b))} 이므로 ${model.correctAnswer}이다.`;
    else explanation += `두 근의 곱은 c = ${model.correctAnswer}이다.`;
  }

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 방정식에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 방정식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, figure: null, distractorRationales };
}
