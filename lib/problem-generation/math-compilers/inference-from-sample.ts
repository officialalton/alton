// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 여섯 번째 세부 기술:
// "Inference from sample statistics and margin of error". 표본에서 나온 비율을
// 모집단 크기로 확장 추정한다(단순 비례식). AI를 전혀 부르지 않는다.
import type { DistractorRationale, DistractorKind } from "../review";
import type { DataSpec } from "@/lib/problem-figures/templates/data";

export type InferenceDifficulty = "easy" | "medium" | "hard";

/** 불변 정답 모델 — 표본 sampleSize 중 sampleCount가 특정 성질을 가짐. 모집단
 * population에서 예상 개수는 population × sampleCount/sampleSize(반올림). */
export type InferenceModel = {
  skillCode: "inference_margin_error";
  difficulty: InferenceDifficulty;
  population: number;
  sampleSize: number;
  sampleCount: number;
  context: string;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const RANGE_BY_DIFFICULTY: Record<InferenceDifficulty, { populationUnits: number; sampleSize: number }> = {
  easy: { populationUnits: 20, sampleSize: 25 },
  medium: { populationUnits: 40, sampleSize: 40 },
  hard: { populationUnits: 60, sampleSize: 60 },
};

const CONTEXTS: string[] = [
  "residents of a town who support a new park",
  "students at a school who ride the bus",
  "customers of a store who prefer online shopping",
  "employees of a company who work remotely at least once a week",
];

function pickUnique(
  cands: { value: number; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    if (!Number.isFinite(c.value) || c.value < 0) continue;
    const text = fmt(c.value);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ value: text, kind: c.kind, reason: c.reason });
  }
  return out;
}

export function generateInferenceModel(params: { difficulty: InferenceDifficulty }): InferenceModel {
  const { populationUnits, sampleSize: sampleSizeMax } = RANGE_BY_DIFFICULTY[params.difficulty];
  const context = CONTEXTS[randInt(0, CONTEXTS.length - 1)];

  for (let attempt = 0; attempt < 50; attempt++) {
    const sampleSize = randInt(20, sampleSizeMax);
    const sampleCount = randInt(1, sampleSize - 1);
    const population = randInt(10, populationUnits) * sampleSize; // 표본 크기의 배수여야 정수 추정치가 나온다.
    const estimate = (population * sampleCount) / sampleSize;
    if (!Number.isInteger(estimate) || estimate === 0) continue;

    // 2026-09-17(제품 오너 지시) — 실제 오류 경로: 표본 개수를 그대로 답(스케일링 생략),
    // 표본 크기를 모집단으로 착각해 비율 자체를 답, 비율을 반대로(성질이 없는 쪽) 적용.
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: sampleCount, kind: "condition_ignored", reason: "표본 비율을 모집단 크기로 확장하지 않고 표본 개수를 그대로 답했다." },
      { value: (population * (sampleSize - sampleCount)) / sampleSize, kind: "condition_ignored", reason: "해당 성질이 있는 비율이 아니라 없는 쪽(1-비율)으로 계산했다." },
      { value: population - estimate, kind: "formula_misuse", reason: "모집단에서 추정 개수를 빼고 나머지를 답했다(여집합과 혼동)." },
      { value: population, kind: "condition_ignored", reason: "표본 비율을 반영하지 않고 모집단 전체 크기를 그대로 답했다." },
    ];
    const distractors = pickUnique(cands, fmt(estimate));
    if (distractors.length < 3) continue;
    return { skillCode: "inference_margin_error", difficulty: params.difficulty, population, sampleSize, sampleCount, context, correctAnswer: fmt(estimate), distractors };
  }
  throw new Error("inference_from_sample: 오답 후보 생성에 실패했습니다.");
}

export function validateInferenceModel(model: InferenceModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
  const expected = (model.population * model.sampleCount) / model.sampleSize;
  if (fmt(expected) !== model.correctAnswer) return { ok: false, reason: "표본→모집단 추정 계산이 일치하지 않습니다." };
  return { ok: true };
}

export type CompiledMathProblem = {
  passage: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  explanationEn: string;
  figure: DataSpec | null;
  distractorRationales: DistractorRationale[];
};

export function renderInferenceProblem(model: InferenceModel, opts?: { figureMode?: "data" }): CompiledMathProblem {
  const wantsData = opts?.figureMode === "data";
  const passage = `A random sample of ${model.sampleSize} ${model.context.includes("residents") ? "residents" : model.context.includes("students") ? "students" : model.context.includes("customers") ? "customers" : "employees"} was surveyed. Of those surveyed, ${model.sampleCount} were ${model.context}. The population consists of ${model.population} total.`
    + (wantsData ? " The sample results are also shown in the table below." : "");
  const figure: DataSpec | null = wantsData ? { type: "data", kind: "table", title: "Sample results", columns: ["Category", "Count"], rows: [["Sample size", model.sampleSize], ["Have this characteristic", model.sampleCount], ["Population", model.population]] } : null;
  const question = "Based on the sample, about how many people in the entire population would be expected to have this same characteristic?";
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const explanation = `표본 비율은 ${model.sampleCount}/${model.sampleSize}이다. 이 비율이 모집단에서도 유지된다고 가정하면, 모집단 ${model.population}명 중 예상 인원은 ${model.population}×${model.sampleCount}/${model.sampleSize} = ${model.correctAnswer}명이다.`;
  const explanationEn = `The sample proportion is ${model.sampleCount}/${model.sampleSize}. Assuming this proportion holds for the population, the expected count among ${model.population} people is ${model.population}×${model.sampleCount}/${model.sampleSize} = ${model.correctAnswer}.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 표본 통계에서 나올 수 있는 실제 추정 오류다.",
    matches: "같은 표본·모집단 수치로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}
