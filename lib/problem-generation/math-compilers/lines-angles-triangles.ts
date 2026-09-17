// 2026-09-17(제품 오너 지시) — 결정적(Zero-AI) Math 컴파일러: "Lines, angles, and triangles".
// 삼각형 내각의 합, 삼각형 외각, 이등변삼각형 밑각을 코드로 계산한다. AI는 전혀
// 부르지 않는다 — 정답·오답·그림 데이터를 전부 이 모듈이 확정한 값에서만 만든다.
import type { TriangleSpec } from "@/lib/problem-figures/templates/triangle";
import type { DistractorRationale, DistractorKind } from "../review";

export type LinesAnglesQuestionKind = "triangle_angle_sum" | "exterior_angle" | "isosceles_base_angle";
export type LinesAnglesDifficulty = "easy" | "medium" | "hard";

export type LinesAnglesModel = {
  skillCode: "lines_angles_triangles";
  difficulty: LinesAnglesDifficulty;
  questionKind: LinesAnglesQuestionKind;
  angleA?: number;
  angleB?: number;
  apexAngle?: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const KINDS_BY_DIFFICULTY: Record<LinesAnglesDifficulty, LinesAnglesQuestionKind[]> = {
  easy: ["triangle_angle_sum"],
  medium: ["triangle_angle_sum", "exterior_angle"],
  hard: ["exterior_angle", "isosceles_base_angle"],
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

export function generateLinesAnglesModel(params: {
  difficulty: LinesAnglesDifficulty;
  questionKind?: LinesAnglesQuestionKind;
}): LinesAnglesModel {
  const pool = KINDS_BY_DIFFICULTY[params.difficulty];
  const questionKind = params.questionKind ?? pool[randInt(0, pool.length - 1)];

  for (let attempt = 0; attempt < 30; attempt++) {
    if (questionKind === "triangle_angle_sum") {
      const angleA = randInt(20, 100);
      const angleB = randInt(20, 150 - angleA);
      const angleC = 180 - angleA - angleB;
      if (angleC <= 0 || angleC >= 160) continue;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(angleA + angleB), kind: "formula_misuse", reason: "180에서 빼는 것을 잊고 두 각의 합을 그대로 답으로 썼다." },
        { value: fmt(90 - angleA - angleB), kind: "condition_ignored", reason: "직각삼각형이라고 착각해 180이 아니라 90에서 뺐다." },
        { value: fmt(180 - angleA), kind: "formula_misuse", reason: "두 각 중 하나(B)를 빠뜨리고 180에서 A만 뺐다." },
      ];
      const distractors = pickUnique(cands, fmt(angleC));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "lines_angles_triangles", difficulty: params.difficulty, questionKind, angleA, angleB, correctAnswer: fmt(angleC), distractors };
    }

    if (questionKind === "exterior_angle") {
      const angleA = randInt(20, 100);
      const angleB = randInt(20, 150 - angleA);
      const exterior = angleA + angleB;
      const interiorThird = 180 - exterior;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(interiorThird), kind: "geometry_misapplied", reason: "외각이 아니라 세 번째 내각을 계산했다(외각-내각 혼동)." },
        { value: fmt(angleA), kind: "condition_ignored", reason: "두 원격 내각 중 하나(B)를 빠뜨리고 하나만 더했다." },
        { value: fmt(180 - angleA), kind: "formula_misuse", reason: "원격 내각의 합이 아니라 한 각의 보각을 계산했다." },
      ];
      const distractors = pickUnique(cands, fmt(exterior));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "lines_angles_triangles", difficulty: params.difficulty, questionKind, angleA, angleB, correctAnswer: fmt(exterior), distractors };
    }

    // isosceles_base_angle
    const apexAngle = randInt(10, 34) * 4; // 4의 배수 → (180-apex)는 항상 짝수 → 밑각은 항상 정수.
    const baseAngle = (180 - apexAngle) / 2;
    const cands: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: fmt(180 - apexAngle), kind: "formula_misuse", reason: "두 밑각으로 나누지 않고(÷2를 잊고) 나머지 전체를 답으로 썼다." },
      { value: fmt(apexAngle), kind: "condition_ignored", reason: "이등변삼각형에서 밑각이 꼭지각과 같다고 착각했다." },
      { value: fmt((180 + apexAngle) / 2), kind: "sign_error", reason: "180에서 꼭지각을 빼지 않고 오히려 더한 뒤 2로 나눴다." },
    ];
    const distractors = pickUnique(cands, fmt(baseAngle));
    if (distractors.length < 3 && attempt < 29) continue;
    return { skillCode: "lines_angles_triangles", difficulty: params.difficulty, questionKind, apexAngle, correctAnswer: fmt(baseAngle), distractors };
  }
  throw new Error("lines_angles_triangles: 오답 후보 생성에 실패했습니다.");
}

export function validateLinesAnglesModel(model: LinesAnglesModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "triangle_angle_sum") {
    if (model.angleA === undefined || model.angleB === undefined) return { ok: false, reason: "두 각 값이 없습니다." };
    const angleC = 180 - model.angleA - model.angleB;
    if (angleC <= 0 || angleC >= 180) return { ok: false, reason: "세 번째 각이 유효한 삼각형 각이 아닙니다." };
    if (model.correctAnswer !== fmt(angleC)) return { ok: false, reason: "세 번째 각 값이 일치하지 않습니다." };
  } else if (model.questionKind === "exterior_angle") {
    if (model.angleA === undefined || model.angleB === undefined) return { ok: false, reason: "원격 내각 값이 없습니다." };
    if (model.correctAnswer !== fmt(model.angleA + model.angleB)) return { ok: false, reason: "외각 값이 일치하지 않습니다." };
  } else if (model.questionKind === "isosceles_base_angle") {
    if (model.apexAngle === undefined) return { ok: false, reason: "꼭지각 값이 없습니다." };
    if (model.apexAngle <= 0 || model.apexAngle >= 180) return { ok: false, reason: "꼭지각이 유효하지 않습니다." };
    if (model.correctAnswer !== fmt((180 - model.apexAngle) / 2)) return { ok: false, reason: "밑각 값이 일치하지 않습니다." };
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

const QUESTION_TEXT: Record<LinesAnglesQuestionKind, string> = {
  triangle_angle_sum: "What is the measure of angle C, in degrees, in the triangle shown?",
  exterior_angle: "What is the measure of the exterior angle at the third vertex, in degrees?",
  isosceles_base_angle: "What is the measure of each base angle, in degrees, of the isosceles triangle described?",
};

export function renderLinesAnglesProblem(model: LinesAnglesModel): CompiledMathProblem {
  const question = QUESTION_TEXT[model.questionKind];
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 삼각형에서 실제로 나올 수 있는 계산·개념 오류다.",
    matches: "같은 조건에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  let passage: string;
  let explanation: string;
  let explanationEn: string;
  let figure: TriangleSpec | null;

  if (model.questionKind === "triangle_angle_sum") {
    const { angleA, angleB } = model as { angleA: number; angleB: number };
    const angleC = 180 - angleA - angleB;
    passage = `In triangle ABC, angle A measures ${angleA}° and angle B measures ${angleB}°, as shown in the figure.`;
    explanation = `삼각형의 세 내각의 합은 180°이므로 각 C = 180° − ${angleA}° − ${angleB}° = ${fmt(angleC)}°이다.`;
    explanationEn = `The three interior angles of a triangle sum to 180°, so angle C = 180° − ${angleA}° − ${angleB}° = ${fmt(angleC)}°.`;
    figure = { type: "triangle", vertices: ["A", "B", "C"], kind: "scalene", angles: [
      { at: "A", label: `${angleA}°` },
      { at: "B", label: `${angleB}°` },
    ] };
  } else if (model.questionKind === "exterior_angle") {
    const { angleA, angleB } = model as { angleA: number; angleB: number };
    const exterior = angleA + angleB;
    passage = `In a triangle, the two remote interior angles at vertices A and B measure ${angleA}° and ${angleB}°. Side BC is extended beyond C to form an exterior angle at vertex C.`;
    explanation = `삼각형의 한 외각은 그와 이웃하지 않는 두 내각(원격 내각)의 합과 같으므로 외각 = ${angleA}° + ${angleB}° = ${fmt(exterior)}°이다.`;
    explanationEn = `The exterior angle of a triangle equals the sum of the two remote (non-adjacent) interior angles, so the exterior angle = ${angleA}° + ${angleB}° = ${fmt(exterior)}°.`;
    figure = null;
  } else {
    const { apexAngle } = model as { apexAngle: number };
    const baseAngle = (180 - apexAngle) / 2;
    passage = `Isosceles triangle ABC has apex angle A measuring ${apexAngle}°, and sides AB and AC are congruent, as shown in the figure.`;
    explanation = `이등변삼각형의 두 밑각은 서로 같으므로 (180° − ${apexAngle}°) ÷ 2 = ${fmt(baseAngle)}°이다.`;
    explanationEn = `The two base angles of an isosceles triangle are equal, so (180° − ${apexAngle}°) ÷ 2 = ${fmt(baseAngle)}°.`;
    figure = { type: "triangle", vertices: ["A", "B", "C"], kind: "isosceles", angles: [{ at: "A", label: `${apexAngle}°` }], sides: [{ between: ["A", "B"], tick: 1 }, { between: ["A", "C"], tick: 1 }] };
  }

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}
