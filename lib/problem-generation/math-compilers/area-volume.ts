// 2026-09-17(제품 오너 지시) — 결정적(Zero-AI) Math 컴파일러: "Area and volume".
// 직사각형·삼각형 넓이, 직육면체·원기둥 부피를 코드로 계산한다. AI는 전혀 부르지
// 않는다 — 정답·오답·그림 데이터를 전부 이 모듈이 확정한 값에서만 만든다.
import type { PolygonSpec } from "@/lib/problem-figures/templates/polygon";
import type { TriangleSpec } from "@/lib/problem-figures/templates/triangle";
import type { SolidSpec } from "@/lib/problem-figures/templates/solid";
import type { DistractorRationale, DistractorKind } from "../review";

export type AreaVolumeQuestionKind =
  | "rectangle_area"
  | "triangle_area"
  | "prism_volume"
  | "prism_missing_dimension"
  | "cylinder_volume_radius"
  | "cylinder_volume_diameter";

export type AreaVolumeDifficulty = "easy" | "medium" | "hard";

export type AreaVolumeModel = {
  skillCode: "area_volume";
  difficulty: AreaVolumeDifficulty;
  questionKind: AreaVolumeQuestionKind;
  // rectangle_area
  length?: number;
  width?: number;
  // triangle_area
  base?: number;
  height?: number;
  // prism_volume / prism_missing_dimension
  l?: number;
  w?: number;
  h?: number;
  missingDim?: "l" | "w" | "h";
  volume?: number;
  // cylinder
  radius?: number;
  diameter?: number;
  cylHeight?: number;
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
  return `${fmt(coeff)}π`;
}

const KINDS_BY_DIFFICULTY: Record<AreaVolumeDifficulty, AreaVolumeQuestionKind[]> = {
  easy: ["rectangle_area", "prism_volume"],
  medium: ["triangle_area", "cylinder_volume_radius"],
  hard: ["prism_missing_dimension", "cylinder_volume_diameter"],
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

export function generateAreaVolumeModel(params: {
  difficulty: AreaVolumeDifficulty;
  questionKind?: AreaVolumeQuestionKind;
}): AreaVolumeModel {
  const pool = KINDS_BY_DIFFICULTY[params.difficulty];
  const questionKind = params.questionKind ?? pool[randInt(0, pool.length - 1)];

  for (let attempt = 0; attempt < 30; attempt++) {
    if (questionKind === "rectangle_area") {
      const length = randInt(3, 20);
      const width = randInt(3, 20);
      const area = length * width;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(2 * (length + width)), kind: "formula_misuse", reason: "넓이 대신 둘레 공식 2(l+w)을 사용했다." },
        { value: fmt(length + width), kind: "formula_misuse", reason: "곱하지 않고 두 변을 더했다." },
        { value: fmt(length * length), kind: "geometry_misapplied", reason: "다른 변은 쓰지 않고 한 변만 제곱했다(정사각형으로 착각)." },
      ];
      const distractors = pickUnique(cands, fmt(area));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "area_volume", difficulty: params.difficulty, questionKind, length, width, correctAnswer: fmt(area), distractors };
    }

    if (questionKind === "triangle_area") {
      // 2026-09-17(checkFigure 실측) — 밑변이 너무 짧으면(예: 8) 높이 발 근처에서
      // 변 라벨이 삼각형의 변·꼭짓점 이름과 겹칠 자리가 없다("label_collision").
      // 밑변 하한을 넉넉히 둬 라벨이 항상 놓일 공간을 확보한다.
      const base = randInt(8, 24) * 2; // 짝수 → 1/2 계산이 항상 정수.
      const height = randInt(3, 20);
      const area = (base * height) / 2;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(base * height), kind: "formula_misuse", reason: "밑변×높이를 구하고 1/2을 곱하는 것을 잊었다." },
        { value: fmt(base + height), kind: "geometry_misapplied", reason: "곱하지 않고 밑변과 높이를 더했다." },
        { value: fmt(base * height * 2), kind: "formula_misuse", reason: "1/2을 곱하지 않고 오히려 2를 곱했다." },
      ];
      const distractors = pickUnique(cands, fmt(area));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "area_volume", difficulty: params.difficulty, questionKind, base, height, correctAnswer: fmt(area), distractors };
    }

    if (questionKind === "prism_volume") {
      const l = randInt(2, 9);
      const w = randInt(2, 9);
      const h = randInt(2, 9);
      const volume = l * w * h;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(l * w), kind: "formula_misuse", reason: "높이를 곱하지 않고 밑면 넓이(l×w)만 계산했다." },
        { value: fmt(2 * (l * w + l * h + w * h)), kind: "geometry_misapplied", reason: "부피 대신 겉넓이 공식을 사용했다." },
        { value: fmt(l + w + h), kind: "formula_misuse", reason: "세 변을 곱하지 않고 더했다." },
      ];
      const distractors = pickUnique(cands, fmt(volume));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "area_volume", difficulty: params.difficulty, questionKind, l, w, h, correctAnswer: fmt(volume), distractors };
    }

    if (questionKind === "prism_missing_dimension") {
      const l = randInt(2, 9);
      const w = randInt(2, 9);
      const h = randInt(2, 9);
      const volume = l * w * h;
      const missingDims: ("l" | "w" | "h")[] = ["l", "w", "h"];
      const missingDim = missingDims[randInt(0, 2)];
      const known = missingDim === "l" ? [w, h] : missingDim === "w" ? [l, h] : [l, w];
      const answer = missingDim === "l" ? l : missingDim === "w" ? w : h;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(volume / known[0]), kind: "formula_misuse", reason: "알려진 두 변으로 나누지 않고 한 변으로만 나눴다." },
        { value: fmt(volume - known[0] - known[1]), kind: "formula_misuse", reason: "나누는 대신 부피에서 두 변을 뺐다." },
        { value: fmt(known[0] * known[1]), kind: "geometry_misapplied", reason: "부피를 알려진 두 변으로 나누지 않고 그 두 변을 곱한 값을 답으로 썼다." },
      ];
      const distractors = pickUnique(cands, fmt(answer));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "area_volume", difficulty: params.difficulty, questionKind, l, w, h, missingDim, volume, correctAnswer: fmt(answer), distractors };
    }

    if (questionKind === "cylinder_volume_radius") {
      const radius = randInt(2, 10);
      const cylHeight = randInt(3, 15);
      const coeff = radius * radius * cylHeight;
      const cands: { value: string; kind: DistractorKind; reason: string }[] = [
        { value: fmt(4 * coeff), kind: "geometry_misapplied", reason: "반지름 대신 지름을 제곱해 계산했다(2r을 그대로 제곱)." },
        { value: fmt(radius * radius), kind: "unit_error", reason: "높이를 곱하지 않아 원기둥이 아니라 원의 넓이만 계산했다." },
        { value: fmt(2 * radius * cylHeight), kind: "geometry_misapplied", reason: "부피 대신 옆면 겉넓이(2πrh) 공식을 사용했다." },
      ];
      const distractors = pickUnique(cands, fmtPi(coeff));
      if (distractors.length < 3 && attempt < 29) continue;
      return { skillCode: "area_volume", difficulty: params.difficulty, questionKind, radius, cylHeight, correctAnswer: fmtPi(coeff), distractors };
    }

    // cylinder_volume_diameter
    const radius = randInt(2, 8);
    const diameter = radius * 2;
    const cylHeight = randInt(3, 15);
    const coeff = radius * radius * cylHeight;
    const cands: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: fmtPi(diameter * diameter * cylHeight), kind: "geometry_misapplied", reason: "지름을 반으로 나누지 않고 그대로 반지름처럼 제곱해 계산했다(반지름·지름 혼동)." },
      { value: fmt(radius * radius), kind: "unit_error", reason: "높이를 곱하지 않아 부피가 아니라 밑면 넓이만 계산했다." },
      { value: fmt(2 * radius * cylHeight), kind: "geometry_misapplied", reason: "부피 대신 옆면 겉넓이(2πrh) 공식을 사용했다." },
    ];
    const distractors = pickUnique(cands, fmtPi(coeff));
    if (distractors.length < 3 && attempt < 29) continue;
    return { skillCode: "area_volume", difficulty: params.difficulty, questionKind, radius, diameter, cylHeight, correctAnswer: fmtPi(coeff), distractors };
  }
  throw new Error("area_volume: 오답 후보 생성에 실패했습니다.");
}

export function validateAreaVolumeModel(model: AreaVolumeModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  if (model.questionKind === "rectangle_area") {
    if (model.length === undefined || model.width === undefined) return { ok: false, reason: "가로·세로 값이 없습니다." };
    if (model.correctAnswer !== fmt(model.length * model.width)) return { ok: false, reason: "직사각형 넓이가 일치하지 않습니다." };
  } else if (model.questionKind === "triangle_area") {
    if (model.base === undefined || model.height === undefined) return { ok: false, reason: "밑변·높이 값이 없습니다." };
    if (model.correctAnswer !== fmt((model.base * model.height) / 2)) return { ok: false, reason: "삼각형 넓이가 일치하지 않습니다." };
  } else if (model.questionKind === "prism_volume") {
    if (model.l === undefined || model.w === undefined || model.h === undefined) return { ok: false, reason: "직육면체 치수가 없습니다." };
    if (model.correctAnswer !== fmt(model.l * model.w * model.h)) return { ok: false, reason: "직육면체 부피가 일치하지 않습니다." };
  } else if (model.questionKind === "prism_missing_dimension") {
    if (model.l === undefined || model.w === undefined || model.h === undefined || model.volume === undefined || model.missingDim === undefined) {
      return { ok: false, reason: "직육면체 미지 치수 계산에 필요한 값이 없습니다." };
    }
    if (model.volume !== model.l * model.w * model.h) return { ok: false, reason: "부피가 세 치수의 곱과 일치하지 않습니다." };
    const answer = model.missingDim === "l" ? model.l : model.missingDim === "w" ? model.w : model.h;
    if (model.correctAnswer !== fmt(answer)) return { ok: false, reason: "미지 치수 정답이 일치하지 않습니다." };
  } else if (model.questionKind === "cylinder_volume_radius" || model.questionKind === "cylinder_volume_diameter") {
    if (model.radius === undefined || model.cylHeight === undefined) return { ok: false, reason: "원기둥 치수가 없습니다." };
    if (model.correctAnswer !== fmtPi(model.radius * model.radius * model.cylHeight)) return { ok: false, reason: "원기둥 부피가 일치하지 않습니다." };
    if (model.questionKind === "cylinder_volume_diameter" && model.diameter !== model.radius * 2) return { ok: false, reason: "지름이 반지름의 2배가 아닙니다." };
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
  figure: PolygonSpec | TriangleSpec | SolidSpec | null;
  distractorRationales: DistractorRationale[];
};

const QUESTION_TEXT: Record<AreaVolumeQuestionKind, string> = {
  rectangle_area: "What is the area of rectangle ABCD?",
  triangle_area: "What is the area of the triangle shown?",
  prism_volume: "What is the volume of the rectangular prism shown?",
  prism_missing_dimension: "What is the missing dimension of the rectangular prism shown?",
  cylinder_volume_radius: "What is the volume, in terms of π, of the cylinder shown?",
  cylinder_volume_diameter: "What is the volume, in terms of π, of the cylinder shown?",
};

function dimWord(d: "l" | "w" | "h"): string {
  return d === "l" ? "length" : d === "w" ? "width" : "height";
}

export function renderAreaVolumeProblem(model: AreaVolumeModel): CompiledMathProblem {
  const question = QUESTION_TEXT[model.questionKind];
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);
  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 도형에서 실제로 나올 수 있는 계산 오류다.",
    matches: "같은 치수에서 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  let passage: string;
  let explanation: string;
  let explanationEn: string;
  let figure: PolygonSpec | TriangleSpec | SolidSpec | null;

  if (model.questionKind === "rectangle_area") {
    const { length, width } = model as { length: number; width: number };
    passage = `Rectangle ABCD has length ${length} and width ${width}, as shown in the figure.`;
    explanation = `직사각형의 넓이는 가로×세로이므로 ${length} × ${width} = ${fmt(length * width)}이다.`;
    explanationEn = `The area of a rectangle is length × width, so ${length} × ${width} = ${fmt(length * width)}.`;
    figure = { type: "polygon", kind: "rectangle", vertices: ["A", "B", "C", "D"], sideLabels: [
      { between: ["A", "B"], label: fmt(length) },
      { between: ["B", "C"], label: fmt(width) },
    ] };
  } else if (model.questionKind === "triangle_area") {
    const { base, height } = model as { base: number; height: number };
    passage = `A triangle has base ${base} and height ${height}, as shown in the figure.`;
    explanation = `삼각형의 넓이는 (밑변×높이)÷2이므로 (${base} × ${height}) ÷ 2 = ${fmt((base * height) / 2)}이다.`;
    explanationEn = `The area of a triangle is (base × height) ÷ 2, so (${base} × ${height}) ÷ 2 = ${fmt((base * height) / 2)}.`;
    figure = {
      type: "triangle", vertices: ["A", "B", "C"], kind: "scalene",
      sides: [{ between: ["B", "C"], label: fmt(base) }],
      altitude: { from: "A", foot: "D", label: fmt(height) },
    };
  } else if (model.questionKind === "prism_volume") {
    const { l, w, h } = model as { l: number; w: number; h: number };
    passage = `A rectangular prism has length ${l}, width ${w}, and height ${h}, as shown in the figure.`;
    explanation = `직육면체의 부피는 길이×너비×높이이므로 ${l} × ${w} × ${h} = ${fmt(l * w * h)}이다.`;
    explanationEn = `The volume of a rectangular prism is length × width × height, so ${l} × ${w} × ${h} = ${fmt(l * w * h)}.`;
    figure = { type: "solid", kind: "rectangular_prism", dims: { length: fmt(l), width: fmt(w), height: fmt(h) } };
  } else if (model.questionKind === "prism_missing_dimension") {
    const { l, w, h, missingDim, volume } = model as { l: number; w: number; h: number; missingDim: "l" | "w" | "h"; volume: number };
    const known = missingDim === "l" ? [w, h] : missingDim === "w" ? [l, h] : [l, w];
    const dims: SolidSpec["dims"] = { length: missingDim === "l" ? "?" : fmt(l), width: missingDim === "w" ? "?" : fmt(w), height: missingDim === "h" ? "?" : fmt(h) };
    passage = `A rectangular prism has volume ${volume}. Two of its dimensions are shown in the figure, and its ${dimWord(missingDim)} is unknown.`;
    explanation = `부피는 세 치수의 곱이므로 미지 치수 = 부피 ÷ (알려진 두 치수의 곱) = ${volume} ÷ (${known[0]} × ${known[1]}) = ${fmt(volume / (known[0] * known[1]))}이다.`;
    explanationEn = `Volume equals the product of the three dimensions, so the missing dimension = volume ÷ (product of the known dimensions) = ${volume} ÷ (${known[0]} × ${known[1]}) = ${fmt(volume / (known[0] * known[1]))}.`;
    figure = { type: "solid", kind: "rectangular_prism", dims };
  } else {
    const { radius, cylHeight } = model as { radius: number; cylHeight: number };
    const coeff = radius * radius * cylHeight;
    if (model.questionKind === "cylinder_volume_radius") {
      passage = `A cylinder has radius ${radius} and height ${cylHeight}, as shown in the figure.`;
      explanation = `원기둥의 부피는 π × 반지름² × 높이이므로 π × ${radius}² × ${cylHeight} = ${fmtPi(coeff)}이다.`;
      explanationEn = `The volume of a cylinder is π × radius² × height, so π × ${radius}² × ${cylHeight} = ${fmtPi(coeff)}.`;
      figure = { type: "solid", kind: "cylinder", dims: { radius: fmt(radius), height: fmt(cylHeight) } };
    } else {
      const diameter = radius * 2;
      passage = `A cylinder has diameter ${diameter} and height ${cylHeight}, as shown in the figure.`;
      explanation = `지름이 ${diameter}이므로 반지름은 ${diameter} ÷ 2 = ${radius}이다. 부피는 π × 반지름² × 높이이므로 π × ${radius}² × ${cylHeight} = ${fmtPi(coeff)}이다.`;
      explanationEn = `Since the diameter is ${diameter}, the radius is ${diameter} ÷ 2 = ${radius}. The volume of a cylinder is π × radius² × height, so π × ${radius}² × ${cylHeight} = ${fmtPi(coeff)}.`;
      figure = { type: "solid", kind: "cylinder", dims: { diameter: fmt(diameter), height: fmt(cylHeight) } };
    }
  }

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}
