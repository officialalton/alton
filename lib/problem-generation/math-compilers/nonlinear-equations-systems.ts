// 2026-09-17(제품 오너 지시) — 식·함수 공통 엔진(A) 네 번째 세부 기술:
// "Nonlinear equations and systems". x² + bx + c = 0(정수 근으로 인수분해되는
// 이차방정식)의 근·근의 합/곱, 그리고 판별식 부호로 실근 개수를 판정한다. 일차식
// 엔진과 달리 "정수 근 두 개를 먼저 고르고 계수를 역산" 방식으로 항상 깔끔한
// 근을 보장한다 — 분수근이나 복소근은 이 1차 범위 밖이다.
import type { DistractorRationale, DistractorKind } from "../review";

export type NonlinearEqQuestionKind =
  | "root" | "sum_of_roots" | "product_of_roots" | "num_real_solutions"
  // 2026-09-17(제품 오너 지시, Step 4 고빈도 공백 7번) — "무리수 근을 포함한
  // 이차방정식"(ax²+bx+c=0, 판별식이 완전제곱수가 아닌 양수 → 근이 무리수).
  // 실제 SAT는 무리수 개별 근을 직접 묻지 않고 "합/곱"(항상 유리수, -b/a, c/a)을
  // 묻거나, 근을 단순화된 근호 형태 문자열로 물을 때만 개별 근을 묻는다.
  | "irrational_sum_of_roots" | "irrational_product_of_roots" | "irrational_root_radical_form"
  // 2026-09-17(제품 오너 지시, Step 4 항목 3) — "일차식과 이차식의 연립·교점"
  // (y=mx+k와 y=ax²+bx+c의 교점 개수/좌표). 같은 "Nonlinear equations and systems"
  // 세부 기술 코드를 재사용한다(연립방정식이므로 이 스킬 코드의 범위 안).
  | "linear_quadratic_intersection";
export type NonlinearEqDifficulty = "easy" | "medium" | "hard";
/** linear_quadratic_intersection 전용 서브 질문 종류. */
export type IntersectionSubKind = "count" | "x_coord" | "sum_x";

/** 불변 정답 모델 — x² + bx + c = 0, 근은 r1, r2(정수). b = -(r1+r2), c = r1*r2. */
export type NonlinearEqModel = {
  skillCode: "nonlinear_equations_systems";
  difficulty: NonlinearEqDifficulty;
  questionKind: NonlinearEqQuestionKind;
  /** 무리수 근 문항에서만 1이 아닐 수 있다(ax²+bx+c=0). 정수근 문항은 항상 1. */
  a?: number;
  b: number;
  c: number;
  /** root/sum/product 문항 — 실근 두 개(중근이면 r1=r2). */
  r1?: number;
  r2?: number;
  /** num_real_solutions 문항 — 판별식 값(부호만 의미 있음). */
  discriminant?: number;
  /** 무리수 근 문항 — 판별식(D = b²-4ac, a=이 모델의 a). 완전제곱수가 아니다. */
  irrationalDiscriminant?: number;
  /** 근 p ± q√n (n은 제곱인수 없는 정수, n>=2) — a=1로 축약했을 때의 근 표현. */
  radicalForm?: { p: number; q: number; n: number };
  /**
   * linear_quadratic_intersection 전용 — y = quadA·x² + quadB·x + quadC 와
   * y = lineM·x + lineK 의 교점. b/c는 이 모델에서 quadB/quadC와 같은 값을 넣어
   * 둔다(다른 유형과 타입을 공유하기 위한 필드 재사용, 의미상 이 유형 전용 필드는
   * quadA/quadB/quadC/lineM/lineK를 쓴다).
   */
  quadA?: number;
  quadB?: number;
  quadC?: number;
  lineM?: number;
  lineK?: number;
  intersectionSubKind?: IntersectionSubKind;
  intersectionCount?: 0 | 1 | 2;
  /** 교점의 x좌표들 — count=1이면 [r], count=2면 [r1, r2], count=0이면 []. */
  intersectionXs?: number[];
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
/** a가 1이 아닐 수 있는 "$ax^2 + bx + c = 0$" 전체 수식 블록(무리수 근 문항용). */
function quadEquationA(a: number, b: number, c: number): string {
  if (a === 1) return quadEquation(b, c);
  const aTerm = a === -1 ? "-x^2" : `${fmt(a)}x^2`;
  const bTerm = b === 0 ? "" : ` ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}x`;
  const cTerm = c === 0 ? "" : ` ${c >= 0 ? "+" : "-"} ${fmt(Math.abs(c))}`;
  return `$${aTerm}${bTerm}${cTerm} = 0$`;
}

const ROOT_RANGE_BY_DIFFICULTY: Record<NonlinearEqDifficulty, number> = { easy: 5, medium: 7, hard: 9 };

const IRRATIONAL_KINDS = [
  "irrational_sum_of_roots", "irrational_product_of_roots", "irrational_root_radical_form",
] as const satisfies readonly NonlinearEqQuestionKind[];

/** n을 제곱인수 없는 형태로 축약한다: n = q² * squareFreePart. q>=1 반환. */
function extractSquareFactor(n: number): { q: number; squareFree: number } {
  let q = 1;
  let rest = n;
  for (let k = 2; k * k <= rest; k++) {
    while (rest % (k * k) === 0) { rest /= k * k; q *= k; }
  }
  return { q, squareFree: rest };
}

export function generateNonlinearEqModel(params: {
  difficulty: NonlinearEqDifficulty;
  questionKind?: NonlinearEqQuestionKind;
}): NonlinearEqModel {
  const range = ROOT_RANGE_BY_DIFFICULTY[params.difficulty];
  const kinds: NonlinearEqQuestionKind[] = ["root", "sum_of_roots", "product_of_roots", "num_real_solutions", ...IRRATIONAL_KINDS];
  // 2026-09-17 — linear_quadratic_intersection은 기존 목록과 별도로 20% 확률로 섞는다
  // (linear-equations-one-var.ts의 word_problem_translate와 같은 확률적 서브타입 도입 방식).
  const questionKind = params.questionKind ?? (Math.random() < 0.2 ? "linear_quadratic_intersection" : kinds[randInt(0, kinds.length - 1)]);

  if (questionKind === "linear_quadratic_intersection") {
    return generateLinearQuadraticIntersection(params.difficulty);
  }

  if ((IRRATIONAL_KINDS as readonly string[]).includes(questionKind)) {
    return generateIrrationalQuadraticModel(params.difficulty, questionKind as (typeof IRRATIONAL_KINDS)[number]);
  }

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
        correctAnswer = "Two distinct real solutions";
      } else if (roll === 1) {
        // 중근 하나 — D = 0, c = (b/2)^2 (b가 짝수여야 정수 중근).
        b = b % 2 === 0 ? b : b + 1;
        c = (b / 2) * (b / 2);
        discriminant = b * b - 4 * c;
        correctAnswer = "One real solution";
      } else {
        // 실근 없음 — D < 0.
        c = range * range + Math.abs(b) + 1; // 충분히 크게 잡아 b^2-4c < 0 보장.
        discriminant = b * b - 4 * c;
        correctAnswer = "No real solutions";
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

const AMULT_BY_DIFFICULTY: Record<NonlinearEqDifficulty, number[]> = {
  easy: [1], medium: [1, 1, 2], hard: [1, 2, 3],
};
const RADICAL_RANGE_BY_DIFFICULTY: Record<NonlinearEqDifficulty, { pRange: number; qRange: number; nMax: number }> = {
  easy: { pRange: 5, qRange: 3, nMax: 7 },
  medium: { pRange: 7, qRange: 4, nMax: 11 },
  hard: { pRange: 9, qRange: 5, nMax: 13 },
};
const SQUAREFREE_N = [2, 3, 5, 6, 7, 10, 11, 13]; // 완전제곱수가 아닌 제곱인수 없는 정수.

/**
 * 무리수 근 x = p ± q√n (n은 제곱인수 없음, n>=2)에서 monic 이차방정식을 역산한 뒤,
 * aMult를 곱해 ax²+bx+c=0(a=aMult)으로 만든다. 근·합(2p)·곱(p²-q²n)은 항상 유리수다.
 * 판별식 D = b²-4ac = 4·aMult²·q²·n — aMult=1이면 √D = 2q√n(단순화된 형태)이다.
 */
function generateIrrationalQuadraticModel(
  difficulty: NonlinearEqDifficulty,
  questionKind: "irrational_sum_of_roots" | "irrational_product_of_roots" | "irrational_root_radical_form"
): NonlinearEqModel {
  const { pRange, qRange, nMax } = RADICAL_RANGE_BY_DIFFICULTY[difficulty];
  // radical_form 문항은 a=1(monic)으로 고정해 근 표현이 지저분해지지 않게 한다.
  const aMultOptions = questionKind === "irrational_root_radical_form" ? [1] : AMULT_BY_DIFFICULTY[difficulty];

  for (let attempt = 0; attempt < 50; attempt++) {
    const p = randInt(-pRange, pRange);
    const q = randInt(2, qRange);
    const n = SQUAREFREE_N[randInt(0, Math.min(SQUAREFREE_N.length - 1, Math.floor(nMax / 2)))];
    const aMult = aMultOptions[randInt(0, aMultOptions.length - 1)];

    const monicB = -2 * p; // x^2 + monicB x + monicC = 0
    const monicC = p * p - q * q * n;
    const b = aMult * monicB;
    const c = aMult * monicC;
    const a = aMult;
    const discriminant = b * b - 4 * a * c; // = 4*aMult^2*q^2*n
    if (discriminant <= 0) continue;
    const { squareFree } = extractSquareFactor(discriminant);
    if (squareFree === 1) continue; // 완전제곱수면 유리수 근 — 이 기술 범위 밖.

    const sum = -b / a; // = 2p
    const product = c / a; // = p^2 - q^2 n
    if (!Number.isInteger(sum) || !Number.isInteger(product)) continue;

    if (questionKind === "irrational_sum_of_roots") {
      // 2026-09-17 — a=1이면 "-b"(나눗셈을 잊음)가 정답(-b/a=-b)과 같아지고, "b/a"도
      // 정답의 부호 반전값과 같아 후보가 부족해질 수 있다. 4개를 후보로 두고
      // pickUnique로 실제 중복만 걸러 항상 3개를 채운다.
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: -b, kind: "formula_misuse", reason: "합 공식(-b/a)에서 a로 나누는 것을 잊고 -b를 그대로 답으로 썼다." },
        { value: b / a, kind: "sign_error", reason: "합 공식의 부호를 반대로 계산했다(-b/a가 아니라 b/a)." },
        { value: product, kind: "condition_ignored", reason: "근의 합 대신 근의 곱(c/a)을 답으로 썼다." },
        { value: -product, kind: "condition_ignored", reason: "근의 곱 공식(c/a)과 헷갈리면서 부호까지 반대로 썼다." },
      ];
      const distractors = pickUnique(cands, fmt(sum));
      if (distractors.length < 3) continue;
      return { skillCode: "nonlinear_equations_systems", difficulty, questionKind, a, b, c, irrationalDiscriminant: discriminant, correctAnswer: fmt(sum), distractors };
    }

    if (questionKind === "irrational_product_of_roots") {
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: c, kind: "formula_misuse", reason: "곱 공식(c/a)에서 a로 나누는 것을 잊고 c를 그대로 답으로 썼다." },
        { value: -product, kind: "sign_error", reason: "곱 공식의 부호를 반대로 계산했다(c/a가 아니라 -c/a)." },
        { value: sum, kind: "condition_ignored", reason: "근의 곱 대신 근의 합(-b/a)을 답으로 썼다." },
        { value: -sum, kind: "condition_ignored", reason: "근의 합 공식(-b/a)과 헷갈리면서 부호까지 반대로 썼다." },
      ];
      const distractors = pickUnique(cands, fmt(product));
      if (distractors.length < 3) continue;
      return { skillCode: "nonlinear_equations_systems", difficulty, questionKind, a, b, c, irrationalDiscriminant: discriminant, correctAnswer: fmt(product), distractors };
    }

    // irrational_root_radical_form(a=1 고정) — 근은 p ± q√n. "더 큰 근"(부호가 +인 쪽,
    // q>0이므로 항상 p+q√n)을 묻는다.
    const correctAnswer = radicalString(p, q, n, 1);
    const nonSimplifiedN = q * q * n; // 단순화하지 않은 채 √(q²n)로 잘못 쓴 형태.
    const cands: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: radicalString(p, q, n, -1), kind: "sign_error", reason: "± 중 -√ 쪽만 택해 더 작은 근을 답으로 썼다(부호 선택 오류)." },
      { value: `${fmt(p)} + √${nonSimplifiedN}`, kind: "formula_misuse", reason: `근호 안의 계수(${fmt(q)}²)를 밖으로 꺼내 단순화하지 않았다(√${nonSimplifiedN} = ${fmt(q)}√${fmt(n)}인데 단순화 전 형태를 그대로 두었다).` },
      { value: `${fmt(-p)} + ${fmt(q)}√${fmt(n)}`, kind: "sign_error", reason: "2a로 나누기 전 -b의 부호를 반대로 계산해 p의 부호가 뒤집혔다." },
      { value: `${fmt(-p)} - ${fmt(q)}√${fmt(n)}`, kind: "sign_error", reason: "-b의 부호와 ± 선택 둘 다 반대로 계산했다." },
    ];
    const seen = new Set<string>([correctAnswer]);
    const distractors: { value: string; kind: DistractorKind; reason: string }[] = [];
    for (const cand of cands) {
      if (seen.has(cand.value)) continue;
      seen.add(cand.value);
      distractors.push(cand);
    }
    if (distractors.length < 3) continue;
    return {
      skillCode: "nonlinear_equations_systems", difficulty, questionKind, a, b, c,
      irrationalDiscriminant: discriminant, radicalForm: { p, q, n }, correctAnswer, distractors: distractors.slice(0, 3),
    };
  }
  throw new Error("nonlinear_equations_systems(irrational): 오답 후보 생성에 실패했습니다.");
}

/** "p + q√n" / "p - q√n" 문자열(단순화된 근호 표기, 유니코드 √). */
function radicalString(p: number, q: number, n: number, sign: 1 | -1): string {
  const qStr = q === 1 ? "" : fmt(q);
  return `${fmt(p)} ${sign > 0 ? "+" : "-"} ${qStr}√${fmt(n)}`;
}

const INTERSECTION_A_POOL = [1, -1, 2, -2];

/**
 * 2026-09-17(제품 오너 지시, Step 4 항목 3) — y=quadA·x²+quadB·x+quadC 와 y=lineM·x+lineK
 * 의 교점. "정수 교점 좌표를 먼저 고르고 계수를 역산"하는 이 파일의 기존 관행을 그대로
 * 따른다: 두 식을 같다고 놓으면 quadA·x² + (quadB-lineM)·x + (quadC-lineK) = 0 이 되므로,
 * 그 결합 이차식의 근(r1, r2 또는 중근 r)을 먼저 고르고 B=-(quadA)(r1+r2), C=quadA·r1·r2로
 * 역산한 뒤, m·k는 자유롭게 뽑고 quadB=B+m, quadC=C+k로 되돌린다 — 교점 x좌표는 그대로
 * r1, r2로 보장된다(m, k가 무엇이든 상관없다).
 */
function generateLinearQuadraticIntersection(difficulty: NonlinearEqDifficulty): NonlinearEqModel {
  const range = ROOT_RANGE_BY_DIFFICULTY[difficulty];
  const subKind: IntersectionSubKind = (["count", "x_coord", "sum_x"] as const)[randInt(0, 2)];

  for (let attempt = 0; attempt < 40; attempt++) {
    const a = INTERSECTION_A_POOL[randInt(0, INTERSECTION_A_POOL.length - 1)];
    const m = nonZero(-range, range);
    const k = randInt(-range, range);

    let intersectionCount: 0 | 1 | 2;
    let r1: number | undefined;
    let r2: number | undefined;
    let B: number;
    let C: number;

    if (subKind === "x_coord") {
      intersectionCount = 1;
      const r = randInt(-range, range);
      r1 = r; r2 = r;
      B = -a * (2 * r);
      C = a * r * r;
    } else if (subKind === "sum_x") {
      intersectionCount = 2;
      const rr1 = randInt(-range, range);
      let rr2 = randInt(-range, range);
      if (rr2 === rr1) rr2 = rr1 + (rr1 >= range ? -1 : 1);
      r1 = rr1; r2 = rr2;
      B = -a * (rr1 + rr2);
      C = a * rr1 * rr2;
    } else {
      const roll = randInt(0, 2);
      if (roll === 0) {
        const rr1 = randInt(-range, range);
        let rr2 = randInt(-range, range);
        if (rr2 === rr1) rr2 = rr1 + (rr1 >= range ? -1 : 1);
        r1 = rr1; r2 = rr2; intersectionCount = 2;
        B = -a * (rr1 + rr2); C = a * rr1 * rr2;
      } else if (roll === 1) {
        const r = randInt(-range, range);
        r1 = r; r2 = r; intersectionCount = 1;
        B = -a * (2 * r); C = a * r * r;
      } else {
        intersectionCount = 0;
        // D = B^2 - 4aC < 0 이 되도록 C를 충분히 큰 방향으로 잡는다(a 부호에 맞춰 방향 결정).
        B = nonZero(-range, range);
        const need = (B * B) / (4 * a);
        C = a > 0 ? Math.ceil(need) + randInt(1, range) : Math.floor(need) - randInt(1, range);
      }
    }

    const discriminant = B * B - 4 * a * C;
    if (intersectionCount === 2 && discriminant <= 0) continue;
    if (intersectionCount === 1 && discriminant !== 0) continue;
    if (intersectionCount === 0 && discriminant >= 0) continue;

    const quadB = B + m;
    const quadC = C + k;
    const model = buildIntersectionModel({ difficulty, subKind, a, quadB, quadC, m, k, intersectionCount, r1, r2, discriminant });
    if (model) return model;
  }
  throw new Error("nonlinear_equations_systems(linear_quadratic_intersection): 오답 후보 생성에 실패했습니다.");
}

function buildIntersectionModel(p: {
  difficulty: NonlinearEqDifficulty; subKind: IntersectionSubKind; a: number; quadB: number; quadC: number;
  m: number; k: number; intersectionCount: 0 | 1 | 2; r1?: number; r2?: number; discriminant: number;
}): NonlinearEqModel | null {
  const { difficulty, subKind, a, quadB, quadC, m, k, intersectionCount, r1, r2, discriminant } = p;
  const B = quadB - m;
  const base = {
    skillCode: "nonlinear_equations_systems" as const, difficulty, questionKind: "linear_quadratic_intersection" as const,
    b: quadB, c: quadC, quadA: a, quadB, quadC, lineM: m, lineK: k, intersectionSubKind: subKind,
    intersectionCount, discriminant,
  };

  if (subKind === "count") {
    const correctAnswer = intersectionCount === 2 ? "Two intersection points" : intersectionCount === 1 ? "One intersection point" : "No intersection points";
    const rawCands: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: "Two intersection points", kind: "condition_ignored", reason: "판별식의 부호를 잘못 읽어 교점이 두 개라고 착각했다." },
      { value: "One intersection point", kind: "condition_ignored", reason: "판별식이 0이 아닌데 0이라고 착각했다." },
      { value: "No intersection points", kind: "condition_ignored", reason: "판별식이 음수가 아닌데 음수라고 착각해 교점이 없다고 답했다." },
      { value: "Infinitely many intersection points", kind: "other", reason: "직선과 포물선이 항상 여러 점에서 만난다고 잘못 일반화했다 — 포물선과 직선은 무수히 많은 점에서 만날 수 없다." },
    ];
    const distractors = rawCands.filter((c) => c.value !== correctAnswer).slice(0, 3);
    if (distractors.length !== 3) return null;
    const intersectionXs = intersectionCount === 0 ? [] : intersectionCount === 1 ? [r1!] : [r1!, r2!];
    return { ...base, intersectionXs, correctAnswer, distractors };
  }

  if (subKind === "x_coord") {
    const r = r1!;
    const correctAnswer = fmt(r);
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: -r, kind: "sign_error", reason: "교점의 x좌표 부호를 반대로 계산했다." },
      { value: m, kind: "condition_ignored", reason: "x좌표 대신 직선의 기울기 m을 답으로 썼다(다른 변수를 답했다)." },
      { value: k, kind: "condition_ignored", reason: "x좌표 대신 직선의 y절편 k를 답으로 썼다." },
      { value: quadB, kind: "formula_misuse", reason: "두 식을 같다고 놓고 정리하지 않은 채, 이차식의 x계수를 그대로 답으로 썼다." },
    ];
    const distractors = pickUnique(cands, correctAnswer);
    if (distractors.length < 3) return null;
    return { ...base, intersectionXs: [r], correctAnswer, distractors };
  }

  // sum_x
  const sum = r1! + r2!;
  const correctAnswer = fmt(sum);
  const cands: { value: number; kind: DistractorKind; reason: string }[] = [
    { value: r1!, kind: "condition_ignored", reason: "두 교점 중 하나의 x좌표만 답으로 쓰고, 합을 구하라는 조건을 놓쳤다." },
    { value: r2!, kind: "condition_ignored", reason: "두 교점 중 다른 하나의 x좌표만 답으로 썼다." },
    { value: -sum, kind: "sign_error", reason: "근의 합 공식 -B/a에서 부호를 반대로 계산했다." },
    { value: B, kind: "formula_misuse", reason: "결합한 이차식의 계수를 a로 나누지 않고 그대로 답으로 써서 계산을 끝맺지 않았다." },
  ];
  const distractors = pickUnique(cands, correctAnswer);
  if (distractors.length < 3) return null;
  return { ...base, intersectionXs: [r1!, r2!], correctAnswer, distractors };
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
    { value: "Two distinct real solutions", kind: "condition_ignored", reason: "판별식의 부호를 잘못 읽어 실근이 두 개라고 착각했다." },
    { value: "One real solution", kind: "condition_ignored", reason: "판별식이 0이 아닌데 0이라고 착각했다." },
    { value: "No real solutions", kind: "condition_ignored", reason: "판별식이 음수가 아닌데 음수라고 착각해 실근이 없다고 답했다." },
    { value: "Infinitely many solutions", kind: "other", reason: "일차방정식처럼 이차방정식도 근이 무수히 많을 수 있다고 착각했다." },
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
    const expected = d > 0 ? "Two distinct real solutions" : d === 0 ? "One real solution" : "No real solutions";
    if (expected !== model.correctAnswer) return { ok: false, reason: "판별식과 정답 범주가 일치하지 않습니다." };
    return { ok: true };
  }
  if (model.questionKind === "irrational_sum_of_roots" || model.questionKind === "irrational_product_of_roots" || model.questionKind === "irrational_root_radical_form") {
    const a = model.a ?? 1;
    const d = model.irrationalDiscriminant;
    if (d === undefined || d <= 0) return { ok: false, reason: "무리수 근 판별식이 양수가 아닙니다." };
    const { squareFree } = extractSquareFactor(d);
    if (squareFree === 1) return { ok: false, reason: "판별식이 완전제곱수라 근이 유리수입니다(무리수 근 범위 밖)." };
    if (model.questionKind === "irrational_sum_of_roots") {
      const sum = -model.b / a;
      if (!Number.isInteger(sum) || String(model.correctAnswer) !== fmt(sum)) return { ok: false, reason: "근의 합이 -b/a와 일치하지 않습니다." };
      return { ok: true };
    }
    if (model.questionKind === "irrational_product_of_roots") {
      const product = model.c / a;
      if (!Number.isInteger(product) || String(model.correctAnswer) !== fmt(product)) return { ok: false, reason: "근의 곱이 c/a와 일치하지 않습니다." };
      return { ok: true };
    }
    // irrational_root_radical_form
    const rf = model.radicalForm;
    if (!rf) return { ok: false, reason: "근호 형태 데이터가 없습니다." };
    if (a !== 1) return { ok: false, reason: "근호 형태 문항은 a=1(monic)이어야 합니다." };
    // 실제로 (p+q√n)이 x^2+bx+c=0을 만족하는지 대수적으로 확인: 합=2p=-b, 곱=p²-q²n=c.
    if (2 * rf.p !== -model.b) return { ok: false, reason: "근의 합이 -b와 일치하지 않습니다." };
    if (rf.p * rf.p - rf.q * rf.q * rf.n !== model.c) return { ok: false, reason: "근의 곱이 c와 일치하지 않습니다." };
    if (model.correctAnswer !== radicalString(rf.p, rf.q, rf.n, 1)) return { ok: false, reason: "정답 문자열이 근호 형태와 일치하지 않습니다." };
    return { ok: true };
  }
  if (model.questionKind === "linear_quadratic_intersection") {
    if (model.quadA === undefined || model.quadB === undefined || model.quadC === undefined || model.lineM === undefined || model.lineK === undefined) {
      return { ok: false, reason: "교점 모델의 계수가 없습니다." };
    }
    const a = model.quadA, qb = model.quadB, qc = model.quadC, m = model.lineM, k = model.lineK;
    const B = qb - m, C = qc - k;
    const discriminant = B * B - 4 * a * C;
    const expectedCount = discriminant > 0 ? 2 : discriminant === 0 ? 1 : 0;
    if (expectedCount !== model.intersectionCount) return { ok: false, reason: "판별식과 교점 개수가 일치하지 않습니다." };
    if (model.intersectionSubKind === "count") {
      const expectedAnswer = expectedCount === 2 ? "Two intersection points" : expectedCount === 1 ? "One intersection point" : "No intersection points";
      if (expectedAnswer !== model.correctAnswer) return { ok: false, reason: "교점 개수와 정답 범주가 일치하지 않습니다." };
      return { ok: true };
    }
    const xs = model.intersectionXs ?? [];
    for (const x of xs) {
      const onQuad = a * x * x + qb * x + qc;
      const onLine = m * x + k;
      if (Math.abs(onQuad - onLine) > 1e-9) return { ok: false, reason: "교점 x좌표가 두 식을 동시에 만족하지 않습니다." };
    }
    if (model.intersectionSubKind === "x_coord") {
      if (xs.length !== 1 || fmt(xs[0]) !== model.correctAnswer) return { ok: false, reason: "x좌표 정답이 실제 교점과 다릅니다." };
    } else if (model.intersectionSubKind === "sum_x") {
      if (xs.length !== 2 || fmt(xs[0] + xs[1]) !== model.correctAnswer) return { ok: false, reason: "x좌표 합 정답이 실제 교점 합과 다릅니다." };
    }
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
  explanationEn: string;
  figure: null;
  distractorRationales: DistractorRationale[];
};

const QUESTION_TEXT: Record<NonlinearEqQuestionKind, string> = {
  root: "What is the larger solution to the equation shown?",
  sum_of_roots: "What is the sum of the solutions to the equation shown?",
  product_of_roots: "What is the product of the solutions to the equation shown?",
  num_real_solutions: "How many distinct real solutions does the equation shown have?",
  irrational_sum_of_roots: "What is the sum of the solutions to the equation shown?",
  irrational_product_of_roots: "What is the product of the solutions to the equation shown?",
  irrational_root_radical_form: "What is the larger solution to the equation shown, expressed in simplified radical form?",
  // 실제로는 renderIntersectionProblem이 서브종류별로 다시 정하므로 이 값은 쓰이지 않는다
  // (타입을 Record<NonlinearEqQuestionKind, string>로 exhaustive하게 유지하기 위한 자리표시).
  linear_quadratic_intersection: "How many points of intersection do the graphs of the equations shown have?",
};

/** "y = ax² + bx + c" 우변 — a가 1/-1/그 외 모두 지원(교점 문항은 a가 ±1이 아닐 수 있다). */
function quadRhsGeneral(a: number, b: number, c: number): string {
  const aTerm = a === 1 ? "x^2" : a === -1 ? "-x^2" : `${fmt(a)}x^2`;
  const bTerm = b === 0 ? "" : ` ${b >= 0 ? "+" : "-"} ${b === 1 || b === -1 ? "" : fmt(Math.abs(b))}x`;
  const cTerm = c === 0 ? "" : ` ${c >= 0 ? "+" : "-"} ${fmt(Math.abs(c))}`;
  return `${aTerm}${bTerm}${cTerm}`;
}
/** "y = mx + k" 우변. */
function lineRhsGeneral(m: number, k: number): string {
  const mTerm = m === 1 ? "x" : m === -1 ? "-x" : `${fmt(m)}x`;
  if (k === 0) return mTerm;
  return `${mTerm} ${k >= 0 ? "+" : "-"} ${fmt(Math.abs(k))}`;
}

function renderIntersectionProblem(model: NonlinearEqModel): CompiledMathProblem {
  const a = model.quadA!, qb = model.quadB!, qc = model.quadC!, m = model.lineM!, k = model.lineK!;
  const passage = `Consider the system of equations shown.\n\n$y = ${quadRhsGeneral(a, qb, qc)}$\n$y = ${lineRhsGeneral(m, k)}$`;
  const B = qb - m, C = qc - k;
  const combinedEqKo = `${quadRhsGeneral(a, B, C).replace("x^2", "x²")} = 0`;
  const quadKo = quadRhsGeneral(a, qb, qc).replace("x^2", "x²");
  const lineKo = lineRhsGeneral(m, k);

  let question: string;
  let explanation: string;
  let explanationEn: string;
  if (model.intersectionSubKind === "count") {
    question = "How many points of intersection do the graphs of the equations shown have?";
    const d = model.discriminant!;
    const verdictKo = d > 0 ? "0보다 크므로 서로 다른 두 교점을 갖는다." : d === 0 ? "0이므로 교점을 하나 갖는다(직선이 포물선에 접한다)." : "0보다 작으므로 교점이 없다.";
    const verdictEn = d > 0 ? "Since it is greater than 0, there are two distinct intersection points." : d === 0 ? "Since it equals 0, there is exactly one intersection point (the line is tangent to the parabola)." : "Since it is less than 0, there are no intersection points.";
    explanation = `두 식을 같다고 놓으면 ${quadKo} = ${lineKo}이고, 정리하면 ${combinedEqKo}이다. 판별식은 B² - 4AC = ${fmt(B)}² - 4×${fmt(a)}×${fmt(C)} = ${fmt(d)}이다. ${verdictKo} 따라서 ${model.correctAnswer}이다.`;
    explanationEn = `Setting the two expressions equal gives ${quadKo} = ${lineKo}, which simplifies to ${combinedEqKo}. The discriminant is B² - 4AC = ${fmt(B)}² - 4×${fmt(a)}×${fmt(C)} = ${fmt(d)}. ${verdictEn} So the answer is ${model.correctAnswer}.`;
  } else if (model.intersectionSubKind === "x_coord") {
    const r = model.intersectionXs![0];
    question = "What is the x-coordinate of the intersection point of the graphs of the equations shown?";
    explanation = `두 식을 같다고 놓으면 ${quadKo} = ${lineKo}이고, 정리하면 ${combinedEqKo}이다. 이 식은 (x ${r >= 0 ? "-" : "+"} ${fmt(Math.abs(r))})² = 0 형태로 인수분해되어 중근 x = ${model.correctAnswer}을 갖는다(직선이 포물선에 한 점에서 접한다). 따라서 교점의 x좌표는 ${model.correctAnswer}이다.`;
    explanationEn = `Setting the two expressions equal gives ${quadKo} = ${lineKo}, which simplifies to ${combinedEqKo}. This factors as (x ${r >= 0 ? "-" : "+"} ${fmt(Math.abs(r))})² = 0, a repeated root x = ${model.correctAnswer} (the line is tangent to the parabola at one point). So the x-coordinate of the intersection point is ${model.correctAnswer}.`;
  } else {
    const [r1, r2] = model.intersectionXs!;
    question = "What is the sum of the x-coordinates of the two intersection points of the graphs of the equations shown?";
    explanation = `두 식을 같다고 놓으면 ${quadKo} = ${lineKo}이고, 정리하면 ${combinedEqKo}이다. 이 식의 두 근은 ${fmt(r1)}, ${fmt(r2)}이며, 두 근의 합은 -B/A = -(${fmt(B)})/${fmt(a)} = ${model.correctAnswer}이다(개별 교점을 따로 구하지 않아도 된다).`;
    explanationEn = `Setting the two expressions equal gives ${quadKo} = ${lineKo}, which simplifies to ${combinedEqKo}. The two roots are ${fmt(r1)} and ${fmt(r2)}, and their sum is -B/A = -(${fmt(B)})/${fmt(a)} = ${model.correctAnswer} (no need to find each intersection point separately).`;
  }

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 연립에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 두 식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));
  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}

export function renderNonlinearEqProblem(model: NonlinearEqModel): CompiledMathProblem {
  if (model.questionKind === "linear_quadratic_intersection") return renderIntersectionProblem(model);
  const isIrrational = model.questionKind === "irrational_sum_of_roots" || model.questionKind === "irrational_product_of_roots" || model.questionKind === "irrational_root_radical_form";
  const passage = isIrrational
    ? `Consider the equation shown.\n\n${quadEquationA(model.a ?? 1, model.b, model.c)}`
    : `Consider the equation shown.\n\n${quadEquation(model.b, model.c)}`;
  const question = QUESTION_TEXT[model.questionKind];
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  // 2026-09-17(실측, 아침 UAT) — 해설(explanation) 칸은 지문과 달리 $…$를 KaTeX로
  // 조판하지 않고 그대로 노출한다(app/admin/ProblemDraftEditor.tsx의
  // PublishedContentView가 해설만 원문 그대로 <p>로 찍는다). 해설에는 $…$ 대신
  // 유니코드 위첨자(²)를 써서 $ 기호가 그대로 노출되지 않게 한다.
  let explanation: string;
  let explanationEn: string;
  if (isIrrational) {
    const a = model.a ?? 1;
    const d = model.irrationalDiscriminant!;
    const { q: dq, squareFree: dn } = extractSquareFactor(d);
    const sqrtDStr = dq === 1 ? `√${fmt(dn)}` : `${fmt(dq)}√${fmt(dn)}`;
    const quadForm = `x = (-(${fmt(model.b)}) ± √(${fmt(model.b)}² - 4×${fmt(a)}×${fmt(model.c)})) / (2×${fmt(a)}) = (${fmt(-model.b)} ± √${fmt(d)}) / ${fmt(2 * a)} = (${fmt(-model.b)} ± ${sqrtDStr}) / ${fmt(2 * a)}`;
    if (model.questionKind === "irrational_sum_of_roots") {
      explanation = `판별식 D = b² - 4ac = ${fmt(d)}는 완전제곱수가 아니므로 두 근은 무리수다. 하지만 근의 합은 항상 유리수인 -b/a로 구할 수 있다: -(${fmt(model.b)})/${fmt(a)} = ${model.correctAnswer}. 근을 직접 구해 더할 필요가 없다.`;
      explanationEn = `The discriminant D = b² - 4ac = ${fmt(d)} is not a perfect square, so the two roots are irrational. But the sum of the roots is always the rational value -b/a: -(${fmt(model.b)})/${fmt(a)} = ${model.correctAnswer}. There is no need to compute the individual roots.`;
    } else if (model.questionKind === "irrational_product_of_roots") {
      explanation = `판별식 D = b² - 4ac = ${fmt(d)}는 완전제곱수가 아니므로 두 근은 무리수다. 하지만 근의 곱은 항상 유리수인 c/a로 구할 수 있다: ${fmt(model.c)}/${fmt(a)} = ${model.correctAnswer}. 근을 직접 구해 곱할 필요가 없다.`;
      explanationEn = `The discriminant D = b² - 4ac = ${fmt(d)} is not a perfect square, so the two roots are irrational. But the product of the roots is always the rational value c/a: ${fmt(model.c)}/${fmt(a)} = ${model.correctAnswer}. There is no need to compute the individual roots.`;
    } else {
      const rf = model.radicalForm!;
      explanation = `근의 공식 x = (-b ± √(b² - 4ac)) / (2a)에 대입하면 ${quadForm}이다. 근호 안의 ${fmt(dq * dq)}(=${fmt(dq)}²)를 밖으로 꺼내 √${fmt(d)} = ${sqrtDStr}로 단순화하고 분모 ${fmt(2 * a)}로 약분하면 근은 ${fmt(rf.p)} ± ${fmt(rf.q)}√${fmt(rf.n)}이다. 더 큰 근은 ${model.correctAnswer}이다.`;
      explanationEn = `Substituting into the quadratic formula x = (-b ± √(b² - 4ac)) / (2a) gives ${quadForm}. Pulling the factor ${fmt(dq * dq)} (= ${fmt(dq)}²) out of the radical simplifies √${fmt(d)} to ${sqrtDStr}, and dividing by ${fmt(2 * a)} gives roots ${fmt(rf.p)} ± ${fmt(rf.q)}√${fmt(rf.n)}. The larger root is ${model.correctAnswer}.`;
    }
  } else if (model.questionKind === "num_real_solutions") {
    explanation = `판별식은 b² - 4c = ${fmt(model.b)}² - 4×${fmt(model.c)} = ${fmt(model.discriminant!)}이다. ${model.discriminant! > 0 ? "0보다 크므로 서로 다른 두 실근을 갖는다." : model.discriminant === 0 ? "0이므로 중근을 하나 갖는다." : "0보다 작으므로 실근이 없다."} 따라서 ${model.correctAnswer}이다.`;
    explanationEn = `The discriminant is b² - 4c = ${fmt(model.b)}² - 4×${fmt(model.c)} = ${fmt(model.discriminant!)}. ${model.discriminant! > 0 ? "Since it is greater than 0, there are two distinct real solutions." : model.discriminant === 0 ? "Since it equals 0, there is one real solution." : "Since it is less than 0, there are no real solutions."} So the answer is ${model.correctAnswer}.`;
  } else {
    const bSign = -model.b >= 0 ? "+" : "-";
    explanation = `${quadExpr(model.b, model.c).replace("x^2", "x²")} = (x ${model.r1! >= 0 ? "-" : "+"} ${fmt(Math.abs(model.r1!))})(x ${model.r2! >= 0 ? "-" : "+"} ${fmt(Math.abs(model.r2!))})로 인수분해되므로 근은 ${fmt(model.r1!)}, ${fmt(model.r2!)}이다. `;
    explanationEn = `${quadExpr(model.b, model.c).replace("x^2", "x²")} factors as (x ${model.r1! >= 0 ? "-" : "+"} ${fmt(Math.abs(model.r1!))})(x ${model.r2! >= 0 ? "-" : "+"} ${fmt(Math.abs(model.r2!))}), so the solutions are ${fmt(model.r1!)} and ${fmt(model.r2!)}. `;
    if (model.questionKind === "root") {
      explanation += `더 큰 값은 ${model.correctAnswer}이다.`;
      explanationEn += `The larger value is ${model.correctAnswer}.`;
    } else if (model.questionKind === "sum_of_roots") {
      explanation += `두 근의 합은 -b = ${bSign}${fmt(Math.abs(model.b))} 이므로 ${model.correctAnswer}이다.`;
      explanationEn += `The sum of the solutions is -b = ${bSign}${fmt(Math.abs(model.b))}, so the answer is ${model.correctAnswer}.`;
    } else {
      explanation += `두 근의 곱은 c = ${model.correctAnswer}이다.`;
      explanationEn += `The product of the solutions is c = ${model.correctAnswer}.`;
    }
  }

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 방정식에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 방정식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
