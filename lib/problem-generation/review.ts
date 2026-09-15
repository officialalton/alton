// 생성 후 독립 품질 검사(2026-09-15 제품 오너).
//
// 문제 생성 모델과 **별도의 호출**로, 지문·질문·선택지(정답 표시 없음)만 보고
//   (1) 정답을 고르고  (2) 각 오답의 품질(그럴듯한 이유·지문의 어느 정보와 일부 일치·정답이 될 수 없는 이유·오답 유형·너무 명백한가)을 평가하고
//   (3) 추정 난이도(추론 단계 수·종합 정도·핵심 관계의 미묘함·오답이 정답과 공유하는 정보·자료 해석 부담)를 낸다.
// 독립 검사의 정답이 지정 정답과 다르면 저장하지 않는다. 오답이 명백하거나 자료와 무관하면 재생성한다.
// 학생 응답이 쌓이면 problem_response_stats 로 보정한다(calibrated=true 는 그때만).
import Anthropic from "@anthropic-ai/sdk";
import { figureAlt } from "@/lib/problem-figures/alt";
import type { FigureSpec } from "@/lib/problem-figures/spec";

// 클라이언트는 호출 시점에 만든다 — 모듈 로드만 하는 테스트(jsdom)에서 SDK 가 브라우저 환경으로 오해하지 않게.
let anthropicClient: Anthropic | null = null;
const getAnthropic = () => (anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export type DistractorKind = "partial" | "scope" | "relation_distortion" | "speaker_confusion" | "evidence_off_question" | "opposite" | "irrelevant" | "sign_error" | "unit_error" | "step_missing" | "axis_misread" | "condition_ignored" | "formula_misuse" | "geometry_misapplied" | "other";

export type DistractorRationale = {
  index: number;
  plausibleBecause: string;
  matches: string;
  whyWrong: string;
  kind: DistractorKind;
  /** 피상적으로 읽어도 바로 지워지는가(정반대·무관·과장어만). */
  obvious: boolean;
};

export type IndependentReview = {
  pickedIndex: number | null;
  /** SPR 이면 독립 검사가 낸 답. */
  pickedAnswer: string | null;
  agrees: boolean;
  confidence: "high" | "medium" | "low";
  distractors: DistractorRationale[];
  estimatedDifficulty: "easy" | "medium" | "hard";
  difficultyReasons: string[];
  /** 검사 모델이 지적한 품질 문제(자유 서술). */
  flags: string[];
};

export type QualityRecord = {
  contract: { ok: boolean; issues: { code: string; message: string }[] };
  estimatedDifficulty: "easy" | "medium" | "hard";
  requestedDifficulty: string;
  difficultyReasons: string[];
  distractors: DistractorRationale[];
  independentReview: Omit<IndependentReview, "distractors" | "estimatedDifficulty" | "difficultyReasons">;
  needsReview: boolean;
  needsReviewReasons: string[];
  calibrated: false;
  reviewedAt: string;
};

const DIFFICULTY_RUBRIC = `추정 난이도는 지문 길이·낯선 고유명사·어려운 어휘로 판단하지 않는다. 다음으로 판단한다:
- 필요한 추론 단계 수(1단계 = easy, 2단계 = medium, 3단계 이상 또는 여러 문장·자료의 종합 = hard)
- 핵심 관계의 미묘함(원인/결과, 조건, 범위, 비교, 화자 관점, 시간 관계를 정확히 구분해야 하는가)
- 오답이 정답과 공유하는 핵심 정보의 정도(공유가 클수록 어렵다)
- 자료·수식·도형을 올바르게 해석해야 하는 정도`;

const DISTRACTOR_RUBRIC = `각 오답에 대해: 피상적으로 읽은 학생에게 왜 그럴듯한가(plausible_because), 지문·자료의 어느 정보와 일부 일치하는가(matches), 정답이 될 수 없는 정확한 이유(why_wrong), 오답 유형(kind: partial | scope | relation_distortion | speaker_confusion | evidence_off_question | opposite | irrelevant | sign_error | unit_error | step_missing | axis_misread | condition_ignored | formula_misuse | geometry_misapplied | other), 그리고 obvious(정반대 말·무관·all/never/only 같은 과장어만으로 바로 지워지는가).
Math 오답은 실제 풀이 오류(부호·단위 변환·한 단계 누락·축/눈금 오독·조건 무시·평균/비율/확률 계산 오류·도형 관계 오적용)에서 나와야 한다.`;

export function normalizeSprAnswer(s: string): string {
  const t = s.trim().replace(/,/g, "").replace(/\s+/g, "");
  const frac = t.match(/^(-?\d+)\/(\d+)$/);
  if (frac) { const v = Number(frac[1]) / Number(frac[2]); return Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : t; }
  const n = Number(t);
  return Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : t;
}

export async function reviewProblemIndependently(input: {
  skillLabel: string;
  examSystem: string | null;
  format: string;
  stimulus: string;
  question: string;
  options: string[] | null;
  statements: string[] | null;
  figure: unknown | null;
  correctIndex: number | null;
  answers: string[] | null;
  requestedDifficulty: string;
}): Promise<IndependentReview> {
  const alt = input.figure ? (() => { try { return figureAlt(input.figure as FigureSpec) ?? ""; } catch { return ""; } })() : "";
  const isMc = input.format === "mc";
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2500,
    tools: [
      {
        name: "review_problem",
        description: "정답을 모르는 채점자로서 문제를 풀고, 오답 품질과 난이도를 평가한다.",
        input_schema: {
          type: "object",
          properties: {
            picked_index: { type: ["number", "null"], description: "객관식이면 정답이라고 판단한 0-based 자리. SPR 이면 null." },
            picked_answer: { type: ["string", "null"], description: "SPR 이면 계산한 정답(정수·소수·분수). 객관식이면 null." },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            distractors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" }, plausible_because: { type: "string" }, matches: { type: "string" }, why_wrong: { type: "string" },
                  kind: { type: "string" }, obvious: { type: "boolean" },
                },
                required: ["index", "plausible_because", "matches", "why_wrong", "kind", "obvious"],
              },
              description: "객관식이면 정답으로 고르지 않은 세 선택지 각각. SPR 이면 빈 배열.",
            },
            estimated_difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            difficulty_reasons: { type: "array", items: { type: "string" }, description: "루브릭 요소별 한 줄씩(한국어)." },
            flags: { type: "array", items: { type: "string" }, description: "문제 성립을 해치는 점(정답 둘 이상, 자료·지문 불일치, 질문이 모호, 정답이 자료에 노출 등). 없으면 빈 배열." },
          },
          required: ["picked_index", "picked_answer", "confidence", "distractors", "estimated_difficulty", "difficulty_reasons", "flags"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "review_problem" },
    messages: [
      {
        role: "user",
        content: `당신은 이 문제를 처음 보는 독립 채점자입니다. 정답 표시는 없습니다. 먼저 스스로 풀어 정답을 정하고, 그 다음 오답 품질과 난이도를 평가하세요.
유형: ${input.skillLabel} (${input.examSystem ?? "체계 미지정"}) · 답안 형식: ${input.format} · 생성 시 요청한 난이도: ${input.requestedDifficulty}

[지문/자료]
${input.stimulus || "(지문 없음)"}
${alt ? `\n[자료 설명(표준 렌더러 대체 설명)]\n${alt}` : ""}
${input.statements?.length ? `\n[진술]\n${input.statements.map((s, i) => `${["I", "II", "III", "IV", "V"][i]}. ${s}`).join("\n")}` : ""}

[질문]
${input.question}
${isMc ? `\n[선택지]\n${(input.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")}` : ""}

${DIFFICULTY_RUBRIC}

${DISTRACTOR_RUBRIC}`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("독립 검사 응답을 처리할 수 없습니다.");
  const raw = toolUse.input as {
    picked_index?: number | null; picked_answer?: string | null; confidence?: string; distractors?: { index: number; plausible_because: string; matches: string; why_wrong: string; kind: string; obvious: boolean }[];
    estimated_difficulty?: string; difficulty_reasons?: string[]; flags?: string[];
  };
  const pickedIndex = typeof raw.picked_index === "number" ? raw.picked_index : null;
  const pickedAnswer = typeof raw.picked_answer === "string" ? raw.picked_answer : null;
  const agrees = isMc
    ? pickedIndex !== null && pickedIndex === input.correctIndex
    : pickedAnswer !== null && (input.answers ?? []).some((a) => normalizeSprAnswer(a) === normalizeSprAnswer(pickedAnswer));
  const level = (["easy", "medium", "hard"].includes(String(raw.estimated_difficulty)) ? raw.estimated_difficulty : "medium") as "easy" | "medium" | "hard";
  return {
    pickedIndex,
    pickedAnswer,
    agrees,
    confidence: (["high", "medium", "low"].includes(String(raw.confidence)) ? raw.confidence : "low") as "high" | "medium" | "low",
    distractors: (raw.distractors ?? []).map((d) => ({ index: d.index, plausibleBecause: String(d.plausible_because ?? ""), matches: String(d.matches ?? ""), whyWrong: String(d.why_wrong ?? ""), kind: (d.kind as DistractorKind) ?? "other", obvious: Boolean(d.obvious) })),
    estimatedDifficulty: level,
    difficultyReasons: (raw.difficulty_reasons ?? []).map(String),
    flags: (raw.flags ?? []).map(String),
  };
}

/**
 * 독립 검사 결과로 저장 가능 여부를 판정한다. 실패 사유는 생성기에 피드백으로 돌아간다.
 *   * 독립 검사 정답 ≠ 지정 정답 → 저장 안 함
 *   * 오답이 자료와 무관(irrelevant) 또는 obvious 가 2개 이상 → 재생성
 *   * 어려움 문제인데 obvious 오답이 하나라도 있거나, 추정 난이도가 easy → 재생성(난이도 미달)
 *   * 검사 모델이 문제 성립을 해치는 flag 를 냈으면 → 재생성
 */
export function judgeReview(review: IndependentReview, requestedDifficulty: string, format: string): string[] {
  const reasons: string[] = [];
  if (!review.agrees) {
    reasons.push(format === "mc"
      ? `독립 검사는 ${review.pickedIndex !== null ? String.fromCharCode(65 + review.pickedIndex) + ")" : "다른 답"}을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)`
      : `독립 검사가 계산한 답(${review.pickedAnswer ?? "?"})이 지정 정답과 다릅니다`);
  }
  if (format === "mc") {
    const irrelevant = review.distractors.filter((d) => d.kind === "irrelevant");
    const obvious = review.distractors.filter((d) => d.obvious || d.kind === "irrelevant");
    const letters = (ds: typeof review.distractors) => ds.map((d) => String.fromCharCode(65 + d.index) + ")").join(", ");
    if (requestedDifficulty === "hard") {
      // 어려움: 무관·명백한 오답을 하나도 허용하지 않는다(제품 오너 기준).
      if (irrelevant.length) reasons.push(`어려움 문제인데 오답 ${letters(irrelevant)}이 지문·자료와 무관합니다`);
      else if (obvious.length) reasons.push(`어려움 문제인데 오답 ${letters(obvious)}이 너무 명백합니다`);
    } else {
      // 보통·쉬움: 실제 시험도 쉽게 지워지는 오답이 하나쯤 있다. 오답 셋이 전부 명백/무관하거나 둘 이상이 무관하면 정답이 사실상 노출된 문항 → 재생성.
      if (irrelevant.length >= 2) reasons.push(`오답 ${letters(irrelevant)}이 지문·자료와 무관합니다`);
      else if (obvious.length >= 3) reasons.push(`오답 ${letters(obvious)}이 모두 너무 명백해 정답이 노출됩니다`);
    }
  }
  if (requestedDifficulty === "hard" && review.estimatedDifficulty === "easy") reasons.push("어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로");
  for (const f of review.flags) if (/정답이 둘|두 개 이상|둘 이상|모호|노출|불일치|ambiguous|two correct|exposed|mismatch/i.test(f)) reasons.push(`독립 검사 지적: ${f}`);
  return reasons;
}
