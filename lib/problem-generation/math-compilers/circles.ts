// 2026-09-17(제품 오너 지시) — 결정적(Zero-AI) Math 컴파일러: "Circles".
// 원의 둘레, 호의 길이, 부채꼴의 넓이, 중심각·원주각 관계를 코드로 계산한다. AI는
// 전혀 부르지 않는다 — 정답·오답·그림 데이터를 전부 이 모듈이 확정한 값에서만 만든다.
import type { CircleSpec } from "@/lib/problem-figures/templates/circle";
import type { DistractorRationale, DistractorKind } from "../review";

export type CirclesQuestionKind = "circumference_radius" | "circumference_diameter" | "arc_length" | "sector_area" | "central_from_inscribed" | "inscribed_from_central";
export type CirclesDifficulty = "easy" | "medium" | "hard";

// 각(도)-반지름 조합을 항상 깔끔한 계수로 만들기 위한 표: angle / 360 의 분모.
const NICE_ANGLES: { angle: number; denom: number }[] = [
  { angle: 60, denom: 6 }, { angle: 90, denom: 4 }, { angle: 120, denom: 3 }, { angle: 180, denom: 2 },
];

export type CirclesModel = {
  skillCode: "circles";
  difficulty: CirclesDifficulty;
  questionKind: CirclesQuestionKind;
  radius?: number;
  diameter?: number;
  centralAngle?: number;
  inscribedAngle?: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
function fmtPi(coeff: number): string {
  return Number.isInteger(coeff) ? `${fmt(coeff)}π` : `${fmt(coeff)}π`;
}

const KINDS_BY_DIFFICULTY: Record<CirclesDifficulty, CirclesQuestionKind[]> = {
  easy: ["circumference_radius"],
  medium: ["arc_length", "central_from_inscribed"],
  hard: ["circumference_diameter", "sector_area", "inscribed_from_central"],
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

export function generateCirclesModel(params: {
  difficulty: CirclesDifficulty;
  questionKind?: CirclesQuestionKind;
}): CirclesModel {
  const pool = KINDS_BY_DIFFICULTY[params.difficulty];
  const questionKind = params.questionKind ?? pool[randInt(0, pool.length - 1)];

  for (let attempt = 0; attempt < 30; attempt++) {
    if (questionKind === "circumference_radius") {
      const radius = randInt(2, 20);
      const coeff = 2 * radius;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmtPi(radius), kind: "formula_misuse", reason: "둘레 공식에서 2를 곱하는 것을 잊었다(반지름을 지름으로 착각)." },
        { value: fmtPi(radius * radius), kind: "geometry_misapplied", reason: "둘레 대신 넓이 공식(πr²)의 형태로 계산했다." },
        { value: fmt(2 * radius), kind: "unit_error", reason: "π를 빼먹고 지름(2r)만 답으로 썼다." },
      ];
      const distractors = pickUnique(cands, fmtPi(coeff));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "circles", difficulty: params.difficulty, questionKind, radius, correctAnswer: fmtPi(coeff), distractors };
    }

    if (questionKind === "circumference_diameter") {
      const radius = randInt(2, 15);
      const diameter = radius * 2;
      const coeff = diameter; // circumference = π * d
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmtPi(2 * diameter), kind: "geometry_misapplied", reason: "지름을 반지름으로 착각해 다시 2를 곱했다(반지름·지름 혼동)." },
        { value: fmtPi(diameter * diameter), kind: "geometry_misapplied", reason: "둘레 대신 넓이 공식의 형태로 계산했다." },
        { value: fmt(diameter), kind: "unit_error", reason: "π를 빼먹고 지름만 답으로 썼다." },
      ];
      const distractors = pickUnique(cands, fmtPi(coeff));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "circles", difficulty: params.difficulty, questionKind, radius, diameter, correctAnswer: fmtPi(coeff), distractors };
    }

    if (questionKind === "arc_length") {
      const { angle, denom } = NICE_ANGLES[randInt(0, NICE_ANGLES.length - 1)];
      const radius = denom * randInt(1, 4);
      const coeff = (2 * radius) / denom; // arc length = (angle/360) * 2πr
      const sectorCoeff = (radius * radius) / denom; // 혼동용(부채꼴 넓이 공식)
      const fullCircumCoeff = 2 * radius;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmtPi(sectorCoeff), kind: "geometry_misapplied", reason: "호의 길이 대신 부채꼴 넓이 공식((angle/360)×πr²)을 사용했다." },
        { value: fmtPi(fullCircumCoeff), kind: "condition_ignored", reason: "중심각 비율(angle/360)을 곱하지 않고 원 전체 둘레를 답으로 썼다." },
        { value: fmtPi((2 * radius * (360 - angle)) / 360), kind: "condition_ignored", reason: "주어진 중심각이 아니라 나머지 각(360°−angle)의 비율로 계산했다." },
      ];
      const distractors = pickUnique(cands, fmtPi(coeff));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "circles", difficulty: params.difficulty, questionKind, radius, centralAngle: angle, correctAnswer: fmtPi(coeff), distractors };
    }

    if (questionKind === "sector_area") {
      const { angle, denom } = NICE_ANGLES[randInt(0, NICE_ANGLES.length - 1)];
      const radius = denom * randInt(1, 4);
      const coeff = (radius * radius) / denom; // sector area = (angle/360) * πr²
      const arcCoeff = (2 * radius) / denom; // 혼동용(호의 길이 공식)
      const fullAreaCoeff = radius * radius;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmtPi(arcCoeff), kind: "geometry_misapplied", reason: "부채꼴 넓이 대신 호의 길이 공식((angle/360)×2πr)을 사용했다." },
        { value: fmtPi(fullAreaCoeff), kind: "condition_ignored", reason: "중심각 비율(angle/360)을 곱하지 않고 원 전체 넓이를 답으로 썼다." },
        { value: fmtPi((radius * radius * (360 - angle)) / 360), kind: "condition_ignored", reason: "주어진 중심각이 아니라 나머지 각(360°−angle)의 비율로 계산했다." },
      ];
      const distractors = pickUnique(cands, fmtPi(coeff));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "circles", difficulty: params.difficulty, questionKind, radius, centralAngle: angle, correctAnswer: fmtPi(coeff), distractors };
    }

    if (questionKind === "central_from_inscribed") {
      const inscribedAngle = randInt(10, 80);
      const centralAngle = inscribedAngle * 2;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(inscribedAngle), kind: "condition_ignored", reason: "중심각이 원주각과 같다고 착각했다(2배 관계를 놓침)." },
        { value: fmt(inscribedAngle / 2), kind: "formula_misuse", reason: "원주각에 2를 곱하지 않고 오히려 2로 나눴다." },
        { value: fmt(180 - centralAngle), kind: "condition_ignored", reason: "중심각과 원주각의 관계 대신 보각(180°에서 뺀 값) 관계를 사용했다." },
      ];
      const distractors = pickUnique(cands, fmt(centralAngle));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "circles", difficulty: params.difficulty, questionKind, inscribedAngle, centralAngle, correctAnswer: fmt(centralAngle), distractors };
    }

    // inscribed_from_central
    const centralAngle = randInt(10, 89) * 2; // 짝수 → 원주각은 항상 정수.
    const inscribedAngle = centralAngle / 2;
    const cands2: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: fmt(centralAngle), kind: "condition_ignored", reason: "원주각이 중심각과 같다고 착각했다(1/2배 관계를 놓침)." },
      { value: fmt(centralAngle * 2), kind: "formula_misuse", reason: "중심각을 2로 나누지 않고 오히려 2를 곱했다." },
      { value: fmt(180 - inscribedAngle), kind: "condition_ignored", reason: "중심각·원주각 관계 대신 보각(180°에서 뺀 값) 관계를 사용했다." },
    ];
    const distractors2 = pickUnique(cands2, fmt(inscribedAngle));
    if (distractors2.length < 3 && attempt < 29) continue;
    return { skillCode: "circles", difficulty: params.difficulty, questionKind, inscribedAngle, centralAngle, correctAnswer: fmt(inscribedAngle), distractors: distractors2 };
  }
  throw new Error("circles: 오답 후보 생성에 실패했습니다.");
}

export function validateCirclesModel(model: CirclesModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "circumference_radius") {
    if (model.radius === undefined || model.correctAnswer !== fmtPi(2 * model.radius)) return { ok: false, reason: "둘레 정답이 일치하지 않습니다." };
  } else if (model.questionKind === "circumference_diameter") {
    if (model.diameter === undefined || model.radius === undefined || model.diameter !== model.radius * 2) return { ok: false, reason: "지름이 반지름의 2배가 아닙니다." };
    if (model.correctAnswer !== fmtPi(model.diameter)) return { ok: false, reason: "둘레 정답이 일치하지 않습니다." };
  } else if (model.questionKind === "arc_length") {
    if (model.radius === undefined || model.centralAngle === undefined) return { ok: false, reason: "호의 길이 계산에 필요한 값이 없습니다." };
    if (model.correctAnswer !== fmtPi((model.centralAngle / 360) * 2 * model.radius)) return { ok: false, reason: "호의 길이 정답이 일치하지 않습니다." };
  } else if (model.questionKind === "sector_area") {
    if (model.radius === undefined || model.centralAngle === undefined) return { ok: false, reason: "부채꼴 넓이 계산에 필요한 값이 없습니다." };
    if (model.correctAnswer !== fmtPi((model.centralAngle / 360) * model.radius * model.radius)) return { ok: false, reason: "부채꼴 넓이 정답이 일치하지 않습니다." };
  } else if (model.questionKind === "central_from_inscribed") {
    if (model.inscribedAngle === undefined || model.centralAngle === undefined || model.centralAngle !== model.inscribedAngle * 2) return { ok: false, reason: "중심각이 원주각의 2배가 아닙니다." };
    if (model.correctAnswer !== fmt(model.centralAngle)) return { ok: false, reason: "중심각 정답이 일치하지 않습니다." };
  } else if (model.questionKind === "inscribed_from_central") {
    if (model.inscribedAngle === undefined || model.centralAngle === undefined || model.centralAngle !== model.inscribedAngle * 2) return { ok: false, reason: "중심각이 원주각의 2배가 아닙니다." };
    if (model.correctAnswer !== fmt(model.inscribedAngle)) return { ok: false, reason: "원주각 정답이 일치하지 않습니다." };
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
  figure: CircleSpec | null;
  distractorRationales: DistractorRationale[];
};

export function renderCirclesProblem(model: CirclesModel): CompiledMathProblem {
  const question =
    model.questionKind === "circumference_radius" || model.questionKind === "circumference_diameter" ? "What is the circumference of the circle shown, in terms of π?"
    : model.questionKind === "arc_length" ? "What is the length of arc AB, in terms of π?"
    : model.questionKind === "sector_area" ? "What is the area of the shaded sector, in terms of π?"
    : model.questionKind === "central_from_inscribed" ? "What is the measure of central angle AOB, in degrees?"
    : "What is the measure of inscribed angle ACB, in degrees?";

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 원에서 실제로 나올 수 있는 계산·공식 혼동 오류다.",
    matches: "같은 조건에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  let passage: string;
  let explanation: string;
  let explanationEn: string;
  let figure: CircleSpec;

  if (model.questionKind === "circumference_radius") {
    const { radius } = model as { radius: number };
    passage = `A circle with center O has radius ${radius}, as shown in the figure.`;
    explanation = `원의 둘레는 2πr이므로 2π × ${radius} = ${fmtPi(2 * radius)}이다.`;
    explanationEn = `The circumference of a circle is 2πr, so 2π × ${radius} = ${fmtPi(2 * radius)}.`;
    figure = { type: "circle", center: "O", points: [{ id: "A", angle: 0 }], radii: [{ to: "A", label: fmt(radius) }] };
  } else if (model.questionKind === "circumference_diameter") {
    const { radius, diameter } = model as { radius: number; diameter: number };
    passage = `A circle with center O has diameter ${diameter}, as shown in the figure.`;
    explanation = `지름이 ${diameter}이므로 반지름은 ${diameter} ÷ 2 = ${radius}이다. 원의 둘레는 2πr이므로 2π × ${radius} = ${fmtPi(diameter)}이다.`;
    explanationEn = `Since the diameter is ${diameter}, the radius is ${diameter} ÷ 2 = ${radius}. The circumference of a circle is 2πr, so 2π × ${radius} = ${fmtPi(diameter)}.`;
    figure = { type: "circle", center: "O", points: [{ id: "A", angle: 0 }, { id: "B", angle: 180 }], chords: [{ between: ["A", "B"], label: fmt(diameter), diameter: true }] };
  } else if (model.questionKind === "arc_length") {
    const { radius, centralAngle } = model as { radius: number; centralAngle: number };
    const coeff = (centralAngle / 360) * 2 * radius;
    passage = `In the circle with center O shown, the radius is ${radius} and central angle AOB measures ${centralAngle}°.`;
    explanation = `호의 길이는 (중심각/360°) × 2πr이므로 (${centralAngle}/360) × 2π × ${radius} = ${fmtPi(coeff)}이다.`;
    explanationEn = `Arc length is (central angle/360°) × 2πr, so (${centralAngle}/360) × 2π × ${radius} = ${fmtPi(coeff)}.`;
    figure = { type: "circle", center: "O", points: [{ id: "A", angle: 0 }, { id: "B", angle: centralAngle }], arcs: [{ from: "A", to: "B" }], centralAngles: [{ between: ["A", "B"], label: `${centralAngle}°` }] };
  } else if (model.questionKind === "sector_area") {
    const { radius, centralAngle } = model as { radius: number; centralAngle: number };
    const coeff = (centralAngle / 360) * radius * radius;
    passage = `In the circle with center O shown, the radius is ${radius} and central angle AOB measures ${centralAngle}°. The sector AOB is shaded.`;
    explanation = `부채꼴의 넓이는 (중심각/360°) × πr²이므로 (${centralAngle}/360) × π × ${radius}² = ${fmtPi(coeff)}이다.`;
    explanationEn = `Sector area is (central angle/360°) × πr², so (${centralAngle}/360) × π × ${radius}² = ${fmtPi(coeff)}.`;
    figure = { type: "circle", center: "O", points: [{ id: "A", angle: 0 }, { id: "B", angle: centralAngle }], sector: { from: "A", to: "B" }, centralAngles: [{ between: ["A", "B"], label: `${centralAngle}°` }] };
  } else if (model.questionKind === "central_from_inscribed") {
    const { inscribedAngle, centralAngle } = model as { inscribedAngle: number; centralAngle: number };
    passage = `In the circle with center O shown, inscribed angle ACB (vertex C on the circle) intercepts the same arc AB as central angle AOB, and angle ACB measures ${inscribedAngle}°.`;
    explanation = `같은 호를 지나는 중심각은 원주각의 2배이므로 중심각 = 2 × ${inscribedAngle}° = ${fmt(centralAngle)}°이다.`;
    explanationEn = `A central angle is twice the inscribed angle that subtends the same arc, so the central angle = 2 × ${inscribedAngle}° = ${fmt(centralAngle)}°.`;
    figure = { type: "circle", center: "O", points: [{ id: "A", angle: 0 }, { id: "B", angle: 100 }, { id: "C", angle: 220 }], radii: [{ to: "A" }, { to: "B" }], inscribedAngles: [{ at: "C", between: ["A", "B"], label: `${inscribedAngle}°` }] };
  } else {
    const { inscribedAngle, centralAngle } = model as { inscribedAngle: number; centralAngle: number };
    passage = `In the circle with center O shown, inscribed angle ACB (vertex C on the circle) intercepts the same arc AB as central angle AOB, and angle AOB measures ${centralAngle}°.`;
    explanation = `같은 호를 지나는 원주각은 중심각의 절반이므로 원주각 = ${centralAngle}° ÷ 2 = ${fmt(inscribedAngle)}°이다.`;
    explanationEn = `An inscribed angle is half the central angle that subtends the same arc, so the inscribed angle = ${centralAngle}° ÷ 2 = ${fmt(inscribedAngle)}°.`;
    figure = { type: "circle", center: "O", points: [{ id: "A", angle: 0 }, { id: "B", angle: 100 }, { id: "C", angle: 220 }], radii: [{ to: "A" }, { to: "B" }], centralAngles: [{ between: ["A", "B"], label: `${centralAngle}°` }] };
  }

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}
