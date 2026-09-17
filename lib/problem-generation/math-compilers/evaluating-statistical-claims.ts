// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 일곱 번째 세부 기술:
// "Evaluating statistical claims: observational studies and experiments". 무작위
// 표집(random sampling) 여부와 무작위 배정(random assignment) 여부의 네 조합에서
// 어떤 결론(인과·일반화 가능 여부)을 낼 수 있는지 묻는다. 정답·오답이 전부 네 조합의
// 고정 문구이므로 계산이 아니라 조합 자체가 결정적 정답 모델이다. AI를 전혀 부르지 않는다.
import type { DistractorRationale, DistractorKind } from "../review";

export type EvalClaimsDifficulty = "easy" | "medium" | "hard";

const CONCLUSIONS = {
  bothTrue: "A cause-and-effect relationship can be concluded, and the result can be generalized to the population.",
  raOnly: "A cause-and-effect relationship can be concluded, but only for the group actually studied (the result cannot be generalized to a larger population).",
  rsOnly: "An association can be concluded for the population, but a cause-and-effect relationship cannot be established.",
  neither: "An association can be concluded only for the group actually studied, and a cause-and-effect relationship cannot be established.",
} as const;

/** 불변 정답 모델 — randomAssignment(무작위 배정), randomSampling(무작위 표집) 두
 * 불리언의 네 조합이 곧 정답 범주를 결정한다. */
export type EvalClaimsModel = {
  skillCode: "evaluating_statistical_claims";
  difficulty: EvalClaimsDifficulty;
  randomAssignment: boolean;
  randomSampling: boolean;
  topic: string;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const TOPICS = [
  { subject: "adult volunteers", treatment: "a new sleep-tracking app", outcome: "average hours of sleep" },
  { subject: "high school students", treatment: "a new study technique", outcome: "test scores" },
  { subject: "office workers", treatment: "a standing desk", outcome: "self-reported energy level" },
  { subject: "gym members", treatment: "a new workout program", outcome: "resting heart rate" },
];

function conclusionFor(randomAssignment: boolean, randomSampling: boolean): string {
  if (randomAssignment && randomSampling) return CONCLUSIONS.bothTrue;
  if (randomAssignment && !randomSampling) return CONCLUSIONS.raOnly;
  if (!randomAssignment && randomSampling) return CONCLUSIONS.rsOnly;
  return CONCLUSIONS.neither;
}

export function generateEvalClaimsModel(params: { difficulty: EvalClaimsDifficulty }): EvalClaimsModel {
  const randomAssignment = randInt(0, 1) === 1;
  const randomSampling = randInt(0, 1) === 1;
  const topic = JSON.stringify(TOPICS[randInt(0, TOPICS.length - 1)]);
  const correctAnswer = conclusionFor(randomAssignment, randomSampling);

  const allFour = [CONCLUSIONS.bothTrue, CONCLUSIONS.raOnly, CONCLUSIONS.rsOnly, CONCLUSIONS.neither];
  const distractorTexts = allFour.filter((c) => c !== correctAnswer);
  const kindFor = (text: string): DistractorKind =>
    text === CONCLUSIONS.raOnly || text === CONCLUSIONS.rsOnly ? "condition_ignored" : "formula_misuse";
  const reasonFor = (text: string): string => {
    if (text === CONCLUSIONS.bothTrue) return "무작위 배정과 무작위 표집을 둘 다 갖췄다고 착각했다(실제로는 하나만 있거나 둘 다 없다).";
    if (text === CONCLUSIONS.raOnly) return "무작위 표집(모집단 일반화 근거)이 없는데 있다고, 또는 있는데 없다고 착각했다.";
    if (text === CONCLUSIONS.rsOnly) return "무작위 배정(인과관계 근거)이 없는데 있다고, 또는 있는데 없다고 착각했다.";
    return "무작위 배정과 무작위 표집을 둘 다 있다고 착각했지만 실제로는 아니다.";
  };
  const distractors = distractorTexts.map((text) => ({ value: text, kind: kindFor(text), reason: reasonFor(text) }));

  return { skillCode: "evaluating_statistical_claims", difficulty: params.difficulty, randomAssignment, randomSampling, topic, correctAnswer, distractors };
}

export function validateEvalClaimsModel(model: EvalClaimsModel): { ok: true } | { ok: false; reason: string } {
  const expected = conclusionFor(model.randomAssignment, model.randomSampling);
  if (expected !== model.correctAnswer) return { ok: false, reason: "무작위 배정/표집 조합과 정답 문구가 일치하지 않습니다." };
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== 4) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };
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

export function renderEvalClaimsProblem(model: EvalClaimsModel): CompiledMathProblem {
  const t = JSON.parse(model.topic) as { subject: string; treatment: string; outcome: string };
  const assignmentSentence = model.randomAssignment
    ? `Researchers randomly assigned each participant to either use ${t.treatment} or not.`
    : `Participants chose for themselves whether to use ${t.treatment}.`;
  const samplingSentence = model.randomSampling
    ? `The participants were selected at random from all ${t.subject}.`
    : `The participants were a group of ${t.subject} who volunteered for the study (not selected at random from all ${t.subject}).`;
  const passage = `A study examined the effect of ${t.treatment} on ${t.outcome} among ${t.subject}. ${samplingSentence} ${assignmentSentence}`;
  const question = "Based on the design of the study, which of the following is an appropriate conclusion?";

  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const raText = model.randomAssignment ? "무작위로 배정했으므로 인과관계를 추론할 근거가 있다" : "참가자가 스스로 선택했으므로(무작위 배정이 아니므로) 인과관계를 추론할 근거가 없다";
  const rsText = model.randomSampling ? "전체 대상에서 무작위로 표집했으므로 결과를 모집단 전체로 일반화할 수 있다" : "무작위 표집이 아니라 자원자 집단이므로 결과를 연구 대상 집단 밖으로 일반화할 수 없다";
  const explanation = `이 연구는 ${raText}. 또한 ${rsText}. 두 조건을 종합하면 정답은 "${model.correctAnswer}"이다.`;
  const explanationEn = `${model.randomAssignment ? "Because participants were randomly assigned, there is a basis for inferring causation." : "Because participants were not randomly assigned (they self-selected), there is no basis for inferring causation."} ${model.randomSampling ? "Because participants were randomly sampled from the full population, the result can be generalized." : "Because participants were not randomly sampled (a group of volunteers), the result cannot be generalized beyond the group studied."} Combining both, the answer is "${model.correctAnswer}".`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "무작위 배정과 무작위 표집을 혼동하면 실제로 나올 수 있는 결론이다.",
    matches: "같은 연구 설계 설명에서 나왔다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure: null, distractorRationales };
}
