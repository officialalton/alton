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
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** "y = 3x - 16" 형태로 부호를 정리한다 — "+ -16" 같은 어색한 표기를 막는다. */
function fmtLine(m: number, b: number): string {
  return `y = ${fmt(m)}x ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
}

// 2026-09-17(checkFigure 실측) — 기울기가 가파르면(예: |m|=10) 직선이 그래프 안에서
// 거의 수직에 가까워 두 직선의 라벨이 겹칠 자리가 없어진다("label_collision"). 좌표·
// 절편 범위(range)와 별개로 기울기 크기는 항상 legible한 값(최대 6)으로 제한한다.
const MAX_SLOPE_MAGNITUDE = 6;

/** 정수 교점을 갖는 두 직선을 계수 범위 안에서 찾는다(최대 200회 시도 — 정수해 밀도가 높아 보통 몇 회 안에 찾는다). */
function pickIntersectingLines(range: number): { m1: number; b1: number; m2: number; b2: number; x: number; y: number } {
  const slopeRange = Math.min(range, MAX_SLOPE_MAGNITUDE);
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = randInt(-range, range);
    const y = randInt(-range, range);
    const m1 = randInt(-slopeRange, slopeRange);
    let m2 = randInt(-slopeRange, slopeRange);
    if (m2 === m1) m2 = m1 + (m1 >= 0 ? -1 : 1); // 기울기가 같으면 교점이 하나로 정해지지 않는다.
    const b1 = y - m1 * x;
    const b2 = y - m2 * x;
    // 2026-09-17(checkFigure 실측) — 절편이 좌표 범위를 크게 벗어나면(예: range=10인데
    // b=30) 그 직선의 y절편이 화면 밖에 있어, 보이는 구간이 짧아 라벨을 놓을 자리가
    // 없어진다("label_collision"). 절편도 좌표 범위 안에 실제로 보이도록 좁힌다.
    // 2026-09-17(checkFigure 실측) — 교점이 원점이면 라벨 P가 원점 표시 O·축과
    // 겹칠 자리밖에 없다("label_collision"). 원점 교점은 걸러 다시 고른다.
    if (x === 0 && y === 0) continue;
    if (Math.abs(b1) <= range && Math.abs(b2) <= range) return { m1, b1, m2, b2, x, y };
  }
  // 이론상 도달하지 않는다(위 구성 자체가 항상 정수해를 만든다) — 폴백만 둔다.
  return { m1: 1, b1: 0, m2: -1, b2: 2, x: 1, y: 1 };
}

function buildDistractorsForCoordinate(
  correctValue: number,
  otherValue: number,
  m1: number, b1: number, m2: number, b2: number
): { value: string; kind: DistractorKind; reason: string }[] {
  // 실제 오류 경로 — 부호 오류, 두 식을 바꿔 계산(다른 좌표값을 답으로 착각), 절편을 빠뜨림.
  // 우선순위 후보가 서로 겹치면(작은 범위에서는 흔하다) offset 시리즈로 계속 채운다 —
  // 항상 서로 다른 정수 3개를 낼 때까지 확장한다(무한 루프 방지용 상한만 둔다).
  const candidates: { value: number; kind: DistractorKind; reason: string }[] = [
    { value: -correctValue, kind: "sign_error", reason: "부호를 반대로 계산했다." },
    { value: otherValue, kind: "condition_ignored", reason: "묻는 좌표가 아니라 다른 좌표값을 답으로 골랐다." },
    { value: correctValue + b1 - b2, kind: "formula_misuse", reason: "두 식의 절편 차를 answer에 그대로 더해 계산했다(소거 과정 오류)." },
  ];
  for (let offset = 1; offset <= 50; offset++) {
    candidates.push({ value: correctValue + offset, kind: "other", reason: `계산 과정에서 ${offset}만큼 어긋났다.` });
    candidates.push({ value: correctValue - offset, kind: "other", reason: `계산 과정에서 ${offset}만큼 어긋났다.` });
  }
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
    const m1 = randInt(-range, range) || 1;
    if (roll === 0) {
      const { m2: _drop, ...rest } = pickIntersectingLines(range);
      void _drop;
      const lines = pickIntersectingLines(range);
      return {
        skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
        m1: lines.m1, b1: lines.b1, m2: lines.m2, b2: lines.b2, systemKind: "one_solution",
        intersection: { x: lines.x, y: lines.y },
        correctAnswer: "정확히 하나",
        distractors: [
          { value: "없음", kind: "condition_ignored", reason: "두 직선이 평행(기울기 같음, 절편 다름)이라고 착각했다." },
          { value: "무한히 많음", kind: "condition_ignored", reason: "두 식이 같은 직선이라고 착각했다." },
          { value: "정확히 둘", kind: "other", reason: "일차식 두 개의 교점이 여러 개일 수 있다고 착각했다." },
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
        correctAnswer: "없음",
        distractors: [
          { value: "정확히 하나", kind: "condition_ignored", reason: "기울기가 같으면 항상 교점이 없다는 것을 놓쳤다." },
          { value: "무한히 많음", kind: "condition_ignored", reason: "절편도 같다고 잘못 읽었다." },
          { value: "정확히 둘", kind: "other", reason: "일차식 두 개의 교점이 여러 개일 수 있다고 착각했다." },
        ],
      };
    }
    // 같은 직선(무한히 많음).
    return {
      skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
      m1, b1, m2: m1, b2: b1, systemKind: "infinite_solutions", intersection: null,
      correctAnswer: "무한히 많음",
      distractors: [
        { value: "정확히 하나", kind: "condition_ignored", reason: "두 식이 완전히 같은 직선임을 놓쳤다." },
        { value: "없음", kind: "condition_ignored", reason: "같은 직선을 평행한 서로 다른 직선으로 착각했다." },
        { value: "정확히 둘", kind: "other", reason: "일차식 두 개의 교점이 여러 개일 수 있다고 착각했다." },
      ],
    };
  }

  const lines = pickIntersectingLines(range);
  const { m1, b1, m2, b2, x, y } = lines;

  if (questionKind === "slope" || questionKind === "intercept") {
    // 둘 중 어느 직선을 물을지 — 매번 첫 번째 식으로 고정한다(일관성).
    const value = questionKind === "slope" ? m1 : b1;
    const other = questionKind === "slope" ? m2 : b2;
    return {
      skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
      m1, b1, m2, b2, systemKind: "one_solution", intersection: { x, y },
      correctAnswer: fmt(value),
      distractors: buildDistractorsForCoordinate(value, other, m1, b1, m2, b2).slice(0, 3),
    };
  }

  const correctValue = questionKind === "intersection_x" ? x : questionKind === "intersection_y" ? y : x + y;
  const otherValue = questionKind === "intersection_x" ? y : questionKind === "intersection_y" ? x : x - y;
  return {
    skillCode: "linear_equations_two_var", difficulty: params.difficulty, questionKind,
    m1, b1, m2, b2, systemKind: "one_solution", intersection: { x, y },
    correctAnswer: fmt(correctValue),
    distractors: buildDistractorsForCoordinate(correctValue, otherValue, m1, b1, m2, b2).slice(0, 3),
  };
}

const QUESTION_TEXT: Record<LinearTwoVarQuestionKind, string> = {
  intersection_x: "이 연립방정식의 해에서 x좌표의 값은?",
  intersection_y: "이 연립방정식의 해에서 y좌표의 값은?",
  intersection_sum: "이 연립방정식의 해에서 x좌표와 y좌표의 합은?",
  slope: "첫 번째 식이 나타내는 직선의 기울기는?",
  intercept: "첫 번째 식이 나타내는 직선의 y절편은?",
  num_solutions: "이 연립방정식의 해의 개수는?",
};

/** 해설 — 오직 모델의 계산값만 참조한다. 해설의 결론이 정답 키를 바꾸는 일은 없다(정답은 이미 모델에 고정돼 있다). */
function buildExplanation(model: LinearTwoVarModel): string {
  const eq1 = fmtLine(model.m1, model.b1);
  const eq2 = fmtLine(model.m2, model.b2);
  if (model.questionKind === "num_solutions") {
    if (model.systemKind === "one_solution") return `두 식의 기울기(${fmt(model.m1)}, ${fmt(model.m2)})가 서로 달라 두 직선은 정확히 한 점에서 만난다. 따라서 해는 정확히 하나다.`;
    if (model.systemKind === "no_solution") return `두 식의 기울기가 ${fmt(model.m1)}로 같지만 y절편(${fmt(model.b1)} ≠ ${fmt(model.b2)})이 달라 두 직선은 평행하고 만나지 않는다. 따라서 해가 없다.`;
    return `두 식의 기울기와 y절편이 모두 같아(${fmt(model.m1)}, ${fmt(model.b1)}) 두 식은 완전히 같은 직선을 나타낸다. 따라서 해가 무한히 많다.`;
  }
  if (model.questionKind === "slope") return `${eq1}의 형태에서 x의 계수가 기울기이므로 기울기는 ${fmt(model.m1)}이다.`;
  if (model.questionKind === "intercept") return `${eq1}의 형태에서 상수항이 y절편이므로 y절편은 ${fmt(model.b1)}이다.`;
  const { x, y } = model.intersection!;
  const base = `두 식을 연립하면 ${fmtLine(model.m1, model.b1)}과 ${fmtLine(model.m2, model.b2)}에서 x = ${fmt(x)}, y = ${fmt(y)}이다.`;
  if (model.questionKind === "intersection_x") return `${base} 따라서 x좌표는 ${fmt(x)}이다.`;
  if (model.questionKind === "intersection_y") return `${base} 따라서 y좌표는 ${fmt(y)}이다.`;
  return `${base} 따라서 x좌표와 y좌표의 합은 ${fmt(x)} + ${fmt(y)} = ${fmt(x + y)}이다.`;
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
  }
  return { ok: true };
}

export type CompiledMathProblem = {
  passage: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  figure: PlaneSpec | null;
  distractorRationales: DistractorRationale[];
};

/** 모델 → 실제 문제 렌더링(지문·선택지·해설·그래프). 전부 모델 값을 그대로 읽기만 한다 — 여기서 값을 만들지 않는다. */
export function renderLinearTwoVarProblem(model: LinearTwoVarModel): CompiledMathProblem {
  const passage =
    model.questionKind === "num_solutions" || model.questionKind === "slope" || model.questionKind === "intercept"
      ? `다음 연립방정식을 보자.\n\n${fmtLine(model.m1, model.b1)}\n${fmtLine(model.m2, model.b2)}`
      : `다음 연립방정식의 해를 (x, y)라고 하자.\n\n${fmtLine(model.m1, model.b1)}\n${fmtLine(model.m2, model.b2)}`;
  const question = QUESTION_TEXT[model.questionKind];

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
    figure: model.questionKind === "num_solutions" ? null : buildFigure(model),
    distractorRationales,
  };
}
