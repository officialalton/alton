// 2026-09-17(제품 오너 지시) — SAT Math "Linear equations in two variables"의 첫 계산형
// 컴파일러. 기존 범용 파이프라인(AI가 문제·정답·오답·해설을 함께 생성하고 별도 AI가
// 검토·재생성하는 방식)과 달리, 이 모듈은 **정답·오답·그래프 좌표를 전부 코드로
// 계산**한다. AI를 전혀 부르지 않는다 — "AI는 지문·해설의 문장화만 맡고 참값을
// 바꿀 수 없다"는 요구를, AI 자체를 쓰지 않음으로써 가장 안전하게 만족시킨다(문장화가
// 필요해지면 이 모듈이 이미 확정한 값만 참조하는 별도 얇은 레이어로 나중에 추가한다).
//
// 범위(1차): 두 직선(y = m1 x + b1, y = m2 x + b2)의 교점 — 교점의 x/y좌표, 좌표 합,
// 기울기, 절편, 해의 개수. 계수는 항상 정수이고, 교점이 존재하는 유형은 교점 좌표도
// 항상 정수가 되도록 계수를 고른다(선택지가 지저분한 분수가 되지 않게).
import type { PlaneSpec, PlaneObject } from "@/lib/problem-figures/templates/coordinate-plane";
import type { DistractorRationale, DistractorKind } from "../review";

export type LinearTwoVarQuestionKind =
  | "intersection_x"
  | "intersection_y"
  | "intersection_sum"
  | "slope"
  | "intercept"
  | "num_solutions";

export type LinearTwoVarDifficulty = "easy" | "medium" | "hard";

/** 두 직선의 관계 — 해의 개수 문항의 정답 범주. */
type SystemKind = "one_solution" | "no_solution" | "infinite_solutions";

/**
 * 불변 정답 모델(Problem Model) — 이후 어떤 단계도 이 값을 바꿀 수 없다. 지문·선택지·
 * 정답·해설·그래프는 전부 이 객체 하나를 그대로 읽어서만 만든다.
 */
export type LinearTwoVarModel = {
  skillCode: "linear_equations_two_var";
  difficulty: LinearTwoVarDifficulty;
  questionKind: LinearTwoVarQuestionKind;
  /** line1: y = m1 x + b1, line2: y = m2 x + b2. */
  m1: number; b1: number; m2: number; b2: number;
  systemKind: SystemKind;
  /** systemKind === "one_solution"일 때만 값이 있다. */
  intersection: { x: number; y: number } | null;
  /** 정답 문자열(선택지 표기와 동일한 형식). */
  correctAnswer: string;
  /** 오답 3개 — 각각 실제 계산 오류 경로에서 나온 값과 오류 종류. */
  distractors: { value: string; kind: DistractorKind; reason: string }[];
  /**
   * slope/intercept 문항에서 실제로 묻는 식이 몇 번째인가(2026-09-17, 난이도 실질
   * 분리). medium은 항상 첫 번째 식을 묻고, hard는 두 번째 식을 묻는다 — 학생이
   * "어느 식을 봐야 하는지"부터 식별해야 하는 단계가 하나 더 필요해진다(계수 크기만
   * 키우는 것과는 다른 실제 난이도 차이).
   */
  askedLine?: 1 | 2;
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * "y = 3x - 16" 형태로 부호를 정리한다 — "+ -16" 같은 어색한 표기를 막는다.
 * 2026-09-17(품질 보완) — 계수 1/-1/0을 "1x"/"-1x"/"0x"로 그대로 찍으면 실제 SAT
 * 표기와 달라 학생이 낯설어한다. x항은 "x"/"-x"로, 기울기 0이면 x항 자체를 뺀다.
 */
function rhsExpr(m: number, b: number): string {
  if (m === 0) return fmt(b);
  const xTerm = m === 1 ? "x" : m === -1 ? "-x" : `${fmt(m)}x`;
  // 2026-09-17(품질 보완, 실제 배치 표본 확인) — 절편이 0이면 "+ 0"을 그대로 붙여
  // "y = -x + 0" 같은 불필요한 항이 나갔다. 0이면 상수항 자체를 뺀다.
  if (b === 0) return xTerm;
  const bTerm = `${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
  return `${xTerm} ${bTerm}`;
}
function fmtLine(m: number, b: number): string {
  return `y = ${rhsExpr(m, b)}`;
}

// 2026-09-17(품질 보완) — range(좌표·절편 범위)만으로는 medium·hard가 사실상 같은
// 난이도로 보였다(둘 다 기울기가 |m|≤6로 같이 잘렸다). 기울기 크기 하한을 난이도별로
// 둬서 easy는 계산이 쉬운 작은 기울기, hard는 |m|=1 같은 자명한 값을 배제한다.
const MIN_SLOPE_MAGNITUDE_BY_DIFFICULTY: Record<LinearTwoVarDifficulty, number> = { easy: 1, medium: 1, hard: 2 };
const MAX_SLOPE_MAGNITUDE_BY_DIFFICULTY: Record<LinearTwoVarDifficulty, number> = { easy: 3, medium: 5, hard: 6 };

function randSlope(difficulty: LinearTwoVarDifficulty): number {
  const min = MIN_SLOPE_MAGNITUDE_BY_DIFFICULTY[difficulty];
  const max = MAX_SLOPE_MAGNITUDE_BY_DIFFICULTY[difficulty];
  const magnitude = randInt(min, max);
  return Math.random() < 0.5 ? magnitude : -magnitude;
}

/** 정수 교점을 갖는 두 직선을 계수 범위 안에서 찾는다(최대 200회 시도 — 정수해 밀도가 높아 보통 몇 회 안에 찾는다). */
function pickIntersectingLines(range: number, difficulty: LinearTwoVarDifficulty): { m1: number; b1: number; m2: number; b2: number; x: number; y: number } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = randInt(-range, range);
    const y = randInt(-range, range);
    const m1 = randSlope(difficulty);
    let m2 = randSlope(difficulty);
    if (m2 === m1) m2 = -m1; // 기울기가 같으면 교점이 하나로 정해지지 않는다.
    const b1 = y - m1 * x;
    const b2 = y - m2 * x;
    // 2026-09-17(checkFigure 실측) — 절편이 좌표 범위를 크게 벗어나면(예: range=10인데
    // b=30) 그 직선의 y절편이 화면 밖에 있어, 보이는 구간이 짧아 라벨을 놓을 자리가
    // 없어진다("label_collision"). 절편도 좌표 범위 안에 실제로 보이도록 좁힌다.
    // 2026-09-17(checkFigure 실측) — 교점이 원점이면 라벨 P가 원점 표시 O·축과
    // 겹칠 자리밖에 없다("label_collision"). 원점 교점은 걸러 다시 고른다.
    if (x === 0 && y === 0) continue;
    // 2026-09-17(checkFigure 실측, 300회 반복 스트레스 테스트에서 드물게 발견) —
    // 교점이 좌표 범위의 가장자리에 붙으면(예: range=10인데 x=8·y=0) 축 눈금
    // 숫자(예: "10")와 점 라벨 "P"가 놓일 자리가 겹칠 수 있다. 교점은 항상 축
    // 가장자리에서 최소 2칸 안쪽에 있도록 한다.
    if (Math.abs(x) > range - 2 || Math.abs(y) > range - 2) continue;
    if (Math.abs(b1) <= range && Math.abs(b2) <= range) return { m1, b1, m2, b2, x, y };
  }
  // 이론상 도달하지 않는다(위 구성 자체가 항상 정수해를 만든다) — 폴백만 둔다.
  return { m1: 1, b1: 0, m2: -1, b2: 2, x: 1, y: 1 };
}

/**
 * 2026-09-17(품질 보완) — 오답 사유 문장은 실제로 무엇을 물었는지(좌표 / 기울기 /
 * y절편)에 맞아야 한다. 세 문맥이 같은 함수를 공유하다 보니 좌표 문항이 아닌데도
 * "묻는 좌표가 아니라 다른 좌표값을…" 같은 문구가 나가던 것을 바로잡는다.
 */
type CoordinateContext = "coordinate" | "slope" | "intercept";

function buildDistractorsForCoordinate(
  correctValue: number,
  otherValue: number,
  m1: number, b1: number, m2: number, b2: number,
  context: CoordinateContext = "coordinate"
): { value: string; kind: DistractorKind; reason: string }[] {
  // 실제 오류 경로 — 부호 오류, 두 식을 바꿔 계산(다른 값을 답으로 착각), 절편을 빠뜨림.
  // 우선순위 후보가 서로 겹치면(작은 범위에서는 흔하다) offset 시리즈로 계속 채운다 —
  // 항상 서로 다른 정수 3개를 낼 때까지 확장한다(무한 루프 방지용 상한만 둔다).
  const otherReason =
    context === "slope" ? "첫 번째 식이 아니라 두 번째 식의 기울기를 답으로 골랐다."
    : context === "intercept" ? "첫 번째 식이 아니라 두 번째 식의 y절편을 답으로 골랐다."
    : "묻는 좌표가 아니라 다른 좌표값을 답으로 골랐다.";
  const formulaMisuseReason =
    context === "slope" ? "기울기를 구하면서 두 식의 y절편 차를 그대로 더해 계산했다(무관한 값을 섞은 오류)."
    : context === "intercept" ? "y절편을 구하면서 두 식의 y절편 차를 다시 그 위에 더해 계산했다(중복 반영 오류)."
    : "두 식의 절편 차를 answer에 그대로 더해 계산했다(소거 과정 오류).";
  // 2026-09-17(제품 오너 지시) — "실제 오류 경로가 아닌 임의 수치 오답"을 없앤다.
  // 예전에는 다섯 후보가 서로 겹칠 때 "정답 ± 1..50" 같은 임의 오프셋으로 채웠다 —
  // 이는 실제 학생이 밟을 만한 계산 경로가 아니다. 대신 실제로 있을 법한 오류
  // 경로만 후보로 두고, 그래도 3개가 안 모이면(드묾) 그대로 반환해 검증에서
  // 걸리게 한다 — 호출자가 다른 무작위 계수로 다시 시도한다(임의값을 끼워 넣지 않는다).
  const candidates: { value: number; kind: DistractorKind; reason: string }[] = [
    { value: -correctValue, kind: "sign_error", reason: "부호를 반대로 계산했다." },
    { value: otherValue, kind: "condition_ignored", reason: otherReason },
    { value: -otherValue, kind: "sign_error", reason: `${otherReason} 그 값의 부호까지 반대로 계산했다.` },
    { value: correctValue + (b1 - b2), kind: "formula_misuse", reason: formulaMisuseReason },
    { value: correctValue - (b1 - b2), kind: "formula_misuse", reason: formulaMisuseReason.replace("더해", "반대 부호로 반영해") },
  ];
  const seen = new Set<number>([correctValue]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of candidates) {
    if (out.length >= 3) break;
    if (seen.has(c.value)) continue;
    seen.add(c.value);
    out.push({ value: fmt(c.value), kind: c.kind, reason: c.reason });
  }
  return out;
}

/**
 * 두 직선의 그래프를 결정적으로 렌더링한다 — AI가 좌표를 따로 만들거나 보정하지
 * 않는다. 두 직선과(해가 있으면) 교점 표시를 모델의 값 그대로 그린다.
 */
function buildFigure(model: Pick<LinearTwoVarModel, "m1" | "b1" | "m2" | "b2" | "systemKind" | "intersection">): PlaneSpec {
  const xs: number[] = [-8, 8];
  const objects: PlaneObject[] = [
    // 2026-09-17(checkFigure 실측) — 식 전체("y = -5x + 6")를 그림 라벨로 쓰면 두 직선이
    // 가까울 때 놓을 자리가 없어 label_collision이 잦다. 식은 이미 지문에 그대로
    // 적혀 있으므로, 그림에는 어느 선인지만 구분하는 짧은 라벨(l1/l2)만 붙인다.
    { id: "l1", kind: "line", slope: model.m1, intercept: model.b1, label: "l1" },
    { id: "l2", kind: "line", slope: model.m2, intercept: model.b2, label: "l2" },
  ];
  if (model.systemKind === "one_solution" && model.intersection) {
    objects.push({ id: "p", kind: "point", at: [model.intersection.x, model.intersection.y], label: "P" });
  }
  const range = Math.max(8, ...xs.map(Math.abs), Math.abs(model.intersection?.x ?? 0) + 2, Math.abs(model.intersection?.y ?? 0) + 2);
  return {
    type: "plane",
    axes: { x: { min: -range, max: range }, y: { min: -range, max: range } },
    objects,
  };
}

const RANGE_BY_DIFFICULTY: Record<LinearTwoVarDifficulty, number> = { easy: 6, medium: 8, hard: 10 };

/** 문제 모델 하나를 생성한다 — 전부 결정적 계산이다(무작위는 계수를 고르는 데만 쓰고, 정답·오답은 그 계수에서 항상 같은 방식으로 계산된다). */
export function generateLinearTwoVarModel(params: {
  difficulty: LinearTwoVarDifficulty;
  /** 지정하지 않으면 난이도에 맞는 분포에서 고른다. */
  questionKind?: LinearTwoVarQuestionKind;
}): LinearTwoVarModel {
  const range = RANGE_BY_DIFFICULTY[params.difficulty];
  const kinds: LinearTwoVarQuestionKind[] =
    params.difficulty === "easy"
      ? ["intersection_x", "intersection_y", "slope", "intercept"]
      : ["intersection_x", "intersection_y", "intersection_sum", "slope", "intercept", "num_solutions"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];

  if (questionKind === "num_solutions") {
    // 해의 개수 문항 — 세 경우(하나/없음/무한)를 균등하게 낸다.
    const roll = randInt(0, 2);
    const m1 = randSlope(params.difficulty);
    if (roll === 0) {
      const lines = pickIntersectingLines(range, params.difficulty);
      return {
        skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
        m1: lines.m1, b1: lines.b1, m2: lines.m2, b2: lines.b2, systemKind: "one_solution",
        intersection: { x: lines.x, y: lines.y },
        correctAnswer: "Exactly one",
        distractors: [
          { value: "No solution", kind: "condition_ignored", reason: "두 직선이 평행(기울기 같음, 절편 다름)이라고 착각했다." },
          { value: "Infinitely many", kind: "condition_ignored", reason: "두 식이 같은 직선이라고 착각했다." },
          { value: "Exactly two", kind: "other", reason: "일차식 두 개의 교점이 여러 개일 수 있다고 착각했다." },
        ],
      };
    }
    const b1 = randInt(-range, range);
    if (roll === 1) {
      let b2 = randInt(-range, range);
      if (b2 === b1) b2 = b1 + 1; // 평행(기울기 같음, 절편 다름) → 해 없음.
      return {
        skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
        m1, b1, m2: m1, b2, systemKind: "no_solution", intersection: null,
        correctAnswer: "No solution",
        distractors: [
          { value: "Exactly one", kind: "condition_ignored", reason: "기울기가 같으면 항상 교점이 없다는 것을 놓쳤다." },
          { value: "Infinitely many", kind: "condition_ignored", reason: "절편도 같다고 잘못 읽었다." },
          { value: "Exactly two", kind: "other", reason: "일차식 두 개의 교점이 여러 개일 수 있다고 착각했다." },
        ],
      };
    }
    // 같은 직선(무한히 많음).
    return {
      skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
      m1, b1, m2: m1, b2: b1, systemKind: "infinite_solutions", intersection: null,
      correctAnswer: "Infinitely many",
      distractors: [
        { value: "Exactly one", kind: "condition_ignored", reason: "두 식이 완전히 같은 직선임을 놓쳤다." },
        { value: "No solution", kind: "condition_ignored", reason: "같은 직선을 평행한 서로 다른 직선으로 착각했다." },
        { value: "Exactly two", kind: "other", reason: "일차식 두 개의 교점이 여러 개일 수 있다고 착각했다." },
      ],
    };
  }

  // 2026-09-17 — 실제 오류 경로 후보(5개)가 작은 좌표 범위에서는 서로 겹쳐 3개
  // 미만이 나올 수 있다(임의 오프셋으로 채우지 않기로 했으므로). 그럴 때는 임의
  // 값을 끼워 넣는 대신 계수를 다시 뽑아 재시도한다 — 최대 30회, 그래도 안 되면
  // (사실상 발생하지 않는다) 마지막 시도 결과를 그대로 반환해 validate에서 걸린다.
  for (let attempt = 0; attempt < 30; attempt++) {
    const lines = pickIntersectingLines(range, params.difficulty);
    const { m1, b1, m2, b2, x, y } = lines;

    if (questionKind === "slope" || questionKind === "intercept") {
      // 2026-09-17(난이도 실질 분리) — medium은 첫 번째 식, hard는 두 번째 식을
      // 묻는다. 계수 크기만이 아니라 "어느 식을 봐야 하는지 식별"이라는 단계가
      // hard에 하나 더 필요해진다.
      const askedLine: 1 | 2 = params.difficulty === "hard" ? 2 : 1;
      const value = questionKind === "slope" ? (askedLine === 1 ? m1 : m2) : (askedLine === 1 ? b1 : b2);
      const other = questionKind === "slope" ? (askedLine === 1 ? m2 : m1) : (askedLine === 1 ? b2 : b1);
      const distractors = buildDistractorsForCoordinate(value, other, m1, b1, m2, b2, questionKind);
      if (distractors.length < 3 && attempt < 29) continue;
      return {
        skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
        m1, b1, m2, b2, systemKind: "one_solution", intersection: { x, y }, askedLine,
        correctAnswer: fmt(value),
        distractors: distractors.slice(0, 3),
      };
    }

    const correctValue = questionKind === "intersection_x" ? x : questionKind === "intersection_y" ? y : x + y;
    const otherValue = questionKind === "intersection_x" ? y : questionKind === "intersection_y" ? x : x - y;
    const distractors = buildDistractorsForCoordinate(correctValue, otherValue, m1, b1, m2, b2);
    if (distractors.length < 3 && attempt < 29) continue;
    return {
      skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
      m1, b1, m2, b2, systemKind: "one_solution", intersection: { x, y },
      correctAnswer: fmt(correctValue),
      distractors: distractors.slice(0, 3),
    };
  }
  // 도달하지 않는다(위 루프가 항상 return한다) — TS의 반환 흐름 분석용 폴백.
  throw new Error("linear_equations_two_var: 오답 후보 생성에 실패했습니다.");
}

const QUESTION_TEXT: Record<LinearTwoVarQuestionKind, string> = {
  intersection_x: "What is the x-coordinate of the solution to the system of equations shown?",
  intersection_y: "What is the y-coordinate of the solution to the system of equations shown?",
  intersection_sum: "What is the sum of the x-coordinate and y-coordinate of the solution to the system of equations shown?",
  slope: "What is the slope of the line represented by the __LINE__ equation shown?",
  intercept: "What is the y-intercept of the line represented by the __LINE__ equation shown?",
  num_solutions: "How many solutions does the system of equations shown have?",
};

function questionText(model: LinearTwoVarModel): string {
  const t = QUESTION_TEXT[model.questionKind];
  if (!t.includes("__LINE__")) return t;
  return t.replace("__LINE__", model.askedLine === 2 ? "second" : "first");
}

/** 해설 — 오직 모델의 계산값만 참조한다. 해설의 결론이 정답 키를 바꾸는 일은 없다(정답은 이미 모델에 고정돼 있다). */
function buildExplanation(model: LinearTwoVarModel): string {
  const eq1 = fmtLine(model.m1, model.b1);
  if (model.questionKind === "num_solutions") {
    if (model.systemKind === "one_solution") return `두 식의 기울기(${fmt(model.m1)}, ${fmt(model.m2)})가 서로 달라 두 직선은 정확히 한 점에서 만난다. 따라서 해는 정확히 하나다.`;
    if (model.systemKind === "no_solution") return `두 식의 기울기가 ${fmt(model.m1)}로 같지만 y절편(${fmt(model.b1)} ≠ ${fmt(model.b2)})이 달라 두 직선은 평행하고 만나지 않는다. 따라서 해가 없다.`;
    return `두 식의 기울기와 y절편이 모두 같아(${fmt(model.m1)}, ${fmt(model.b1)}) 두 식은 완전히 같은 직선을 나타낸다. 따라서 해가 무한히 많다.`;
  }
  if (model.questionKind === "slope" || model.questionKind === "intercept") {
    const askedM = model.askedLine === 2 ? model.m2 : model.m1;
    const askedB = model.askedLine === 2 ? model.b2 : model.b1;
    const eqAsked = fmtLine(askedM, askedB);
    const lineWord = model.askedLine === 2 ? "두 번째" : "첫 번째";
    return model.questionKind === "slope"
      ? `${lineWord} 식(${eqAsked})의 형태에서 x의 계수가 기울기이므로 기울기는 ${fmt(askedM)}이다.`
      : `${lineWord} 식(${eqAsked})의 형태에서 상수항이 y절편이므로 y절편은 ${fmt(askedB)}이다.`;
  }
  const { x, y } = model.intersection!;
  // 2026-09-17(제품 오너 지시) — 결론만 말하지 않고 실제 소거·대입 단계를 보여준다.
  // m1x+b1 = m2x+b2 → (m1-m2)x = b2-b1 → x = … → 원래 식에 대입해 y = ….
  const diffM = model.m1 - model.m2;
  const diffB = model.b2 - model.b1;
  const base = `두 식의 우변이 같으므로 ${rhsExpr(model.m1, model.b1)} = ${rhsExpr(model.m2, model.b2)}이다. 양변에서 정리하면 (${fmt(diffM)})x = ${fmt(diffB)}이므로 x = ${fmt(diffB)} ÷ (${fmt(diffM)}) = ${fmt(x)}이다. 이를 ${eq1}에 대입하면 y = ${fmt(model.m1)} × ${fmt(x)} ${model.b1 >= 0 ? "+" : "-"} ${fmt(Math.abs(model.b1))} = ${fmt(y)}이다.`;
  if (model.questionKind === "intersection_x") return `${base} 따라서 x좌표는 ${fmt(x)}이다.`;
  if (model.questionKind === "intersection_y") return `${base} 따라서 y좌표는 ${fmt(y)}이다.`;
  return `${base} 따라서 x좌표와 y좌표의 합은 ${fmt(x)} + ${fmt(y)} = ${fmt(x + y)}이다.`;
}

/** 2026-09-17(사용자 지시) — 해설의 영어 버전. buildExplanation과 같은 계산값만 참조한다(번역이 아니라 같은 값으로 별도 작성). */
function buildExplanationEn(model: LinearTwoVarModel): string {
  const eq1 = fmtLine(model.m1, model.b1);
  if (model.questionKind === "num_solutions") {
    if (model.systemKind === "one_solution") return `The two equations have different slopes (${fmt(model.m1)} and ${fmt(model.m2)}), so the lines intersect at exactly one point. So there is exactly one solution.`;
    if (model.systemKind === "no_solution") return `The two equations have the same slope (${fmt(model.m1)}) but different y-intercepts (${fmt(model.b1)} ≠ ${fmt(model.b2)}), so the lines are parallel and never meet. So there is no solution.`;
    return `The two equations have the same slope and y-intercept (${fmt(model.m1)}, ${fmt(model.b1)}), so they represent the same line. So there are infinitely many solutions.`;
  }
  if (model.questionKind === "slope" || model.questionKind === "intercept") {
    const askedM = model.askedLine === 2 ? model.m2 : model.m1;
    const askedB = model.askedLine === 2 ? model.b2 : model.b1;
    const eqAsked = fmtLine(askedM, askedB);
    const lineWord = model.askedLine === 2 ? "second" : "first";
    return model.questionKind === "slope"
      ? `In the ${lineWord} equation (${eqAsked}), the coefficient of x is the slope, so the slope is ${fmt(askedM)}.`
      : `In the ${lineWord} equation (${eqAsked}), the constant term is the y-intercept, so the y-intercept is ${fmt(askedB)}.`;
  }
  const { x, y } = model.intersection!;
  const diffM = model.m1 - model.m2;
  const diffB = model.b2 - model.b1;
  const baseEn = `Since the right-hand sides are equal, ${rhsExpr(model.m1, model.b1)} = ${rhsExpr(model.m2, model.b2)}. Rearranging gives (${fmt(diffM)})x = ${fmt(diffB)}, so x = ${fmt(diffB)} ÷ (${fmt(diffM)}) = ${fmt(x)}. Substituting into ${eq1} gives y = ${fmt(model.m1)} × ${fmt(x)} ${model.b1 >= 0 ? "+" : "-"} ${fmt(Math.abs(model.b1))} = ${fmt(y)}.`;
  if (model.questionKind === "intersection_x") return `${baseEn} So the x-coordinate is ${fmt(x)}.`;
  if (model.questionKind === "intersection_y") return `${baseEn} So the y-coordinate is ${fmt(y)}.`;
  return `${baseEn} So the sum of the x-coordinate and y-coordinate is ${fmt(x)} + ${fmt(y)} = ${fmt(x + y)}.`;
}

/** 결정적 검사 — 답의 유일성, 선택지 중복, 그래프-식 일치. 이 검사에서 걸리면 후보를 버리고 새로 만든다(재시도는 호출자가 한다). */
export function validateLinearTwoVarModel(model: LinearTwoVarModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.systemKind === "one_solution" && model.questionKind !== "num_solutions") {
    if (!model.intersection) return { ok: false, reason: "교점이 계산되지 않았습니다." };
    // 그래프-식 일치: 교점이 실제로 두 직선 위에 있는지 대입해 확인한다.
    const onLine1 = model.m1 * model.intersection.x + model.b1 === model.intersection.y;
    const onLine2 = model.m2 * model.intersection.x + model.b2 === model.intersection.y;
    if (!onLine1 || !onLine2) return { ok: false, reason: "교점이 두 직선의 식과 일치하지 않습니다." };
    // 원점 교점은 그래프에서 라벨 P가 원점 표시 O·축과 겹칠 자리밖에 없다.
    if (model.intersection.x === 0 && model.intersection.y === 0) return { ok: false, reason: "교점이 원점이라 그래프에서 라벨을 놓을 자리가 없습니다." };
    // 2026-09-17(checkFigure 실측) — 교점이 축 가장자리에 붙으면 눈금 숫자와 점
    // 라벨이 겹칠 수 있다(defense-in-depth — 생성 단계에서도 이미 걸러진다).
    const range = RANGE_BY_DIFFICULTY[model.difficulty];
    if (Math.abs(model.intersection.x) > range - 2 || Math.abs(model.intersection.y) > range - 2) {
      return { ok: false, reason: "교점이 축 가장자리에 가까워 그래프에서 라벨이 겹칠 수 있습니다." };
    }
  }
  return { ok: true };
}

export type CompiledMathProblem = {
  passage: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** 2026-09-17(사용자 지시) — 해설의 영어 버전. 관리자·학생 화면의 한국어/영어 토글에 쓰인다. */
  explanationEn: string;
  figure: PlaneSpec | null;
  distractorRationales: DistractorRationale[];
};

/** 모델 → 실제 문제 렌더링(지문·선택지·해설·그래프). 전부 모델 값을 그대로 읽기만 한다 — 여기서 값을 만들지 않는다. */
export function renderLinearTwoVarProblem(model: LinearTwoVarModel): CompiledMathProblem {
  const passage =
    model.questionKind === "num_solutions" || model.questionKind === "slope" || model.questionKind === "intercept"
      ? `Consider the system of equations shown.\n\n${fmtLine(model.m1, model.b1)}\n${fmtLine(model.m2, model.b2)}`
      : `The solution to the system of equations shown is (x, y).\n\n${fmtLine(model.m1, model.b1)}\n${fmtLine(model.m2, model.b2)}`;
  const question = questionText(model);

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  // 정답 위치를 매번 첫 자리로 고정하지 않는다 — 순서를 섞어 correctIndex로만 추적한다.
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "계산 과정의 실제 오류 경로에서 나온 값이라 얼핏 보면 그럴듯하다.",
    matches: "같은 두 식에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return {
    passage,
    question,
    options: shuffled,
    correctIndex,
    explanation: buildExplanation(model),
    explanationEn: buildExplanationEn(model),
    figure: model.questionKind === "num_solutions" ? null : buildFigure(model),
    distractorRationales,
  };
}
