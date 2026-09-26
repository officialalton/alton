// 2026-09-15 제품 오너 지시 — 수학(어려움 + 자료 필요) 생성을 4단계로 나눈다:
//   1) 자료+문항(같이 — 숫자가 어긋나지 않게)  2) 정답 확정(문제 종류별 방법)  3) 오답 생성  4) 최종 검수(코드 우선).
//   검수에서 걸리면 "그 단계만" 다시 시키고(단계당 최대 2회), 그래도 안 되면 이 문항 자체를 버리고
//   1단계부터 새로 만든다 — 관리자에게 절대 넘기지 않는다("검수 → 관리자 인계"라는 접근을 버린다).
//
// 정답 확정 방법은 문제 종류에 따라 다르다(2026-09-15 사용자 지적 — "문제 자체가 그래프거나 조건 매칭형이면
// 독립 풀이가 안 맞을 수 있다"):
//   (a) 값을 구하는 문제 — AI 가 독립적으로 다시 풀어 정답값을 낸다(생성 때 낸 정답을 안 믿는다).
//   (b) "조건을 만족하는 건?" 유형 — 정답은 문제 설계(1단계)의 일부다. 코드로 각 후보를 조건식에 대입해
//       정확히 하나만 통과하는지 확인한다(lib/problem-content-check.ts 의 checkNumericConditionAmbiguity 재사용,
//       checkQualityContract 를 통해 이미 적용됨). 안 맞으면 1단계(설계) 재시도 대상이다.
//   (c) "다음 중 그래프는?" 유형 — figure_choice(그래프 4개 실제로 각각 그림) 를 강제한다. 텍스트만으로
//       "Graph A" 라고 때우면 이미 계약 위반으로 막힌다(figure_choice_placeholder).
// 이 파일은 (a) 값 계산형을 전담한다 — 압도적 다수 사례. (b)(c)는 checkQualityContract 가 이미 잡아
// 구조적 실패로 분류하므로, 이 파일의 4단계 루프에서도 "1단계 재시도" 대상으로 자연스럽게 처리된다.

import { getAnthropic, PLANE_DESC, TRIANGLE_DESC, CIRCLE_DESC, POLYGON_DESC, SOLID_DESC, COMPOSITE_DESC, type ProblemDifficulty } from "./core";
import { stripOptionSelfLabels } from "@/lib/problem-text";
import { checkQualityContract } from "@/lib/problem-quality-contract";
import { resolveAnswerFromExplanationCore } from "./core";
import type { GeometryTemplate } from "@/lib/problem-material-need";

export type MathFigureKind = "plane" | GeometryTemplate;

const FIGURE_DESC_BY_KIND: Record<MathFigureKind, string> = {
  plane: PLANE_DESC,
  parallel_transversal: TRIANGLE_DESC, // 평행선은 아래 별도 처리(간단화를 위해 triangle 설명과 함께 general 지시로 대체)
  triangle: TRIANGLE_DESC,
  circle: CIRCLE_DESC,
  polygon: POLYGON_DESC,
  solid: SOLID_DESC,
  composite: COMPOSITE_DESC,
};

export type StagedMathItem = {
  stimulus: string;
  question: string;
  figure: unknown | null;
  options: string[];
  correctIndex: number;
  explanation: string;
  design: string;
};

/** 1단계 — 자료+문항. 정답·선택지는 여기서 만들지 않는다(정답을 여기서 지어내면 오늘 겪은 버그가 반복된다). */
async function generateMathStemOnly(params: {
  subjectName: string; skillType: string; difficulty: ProblemDifficulty; figureKind: MathFigureKind; topic?: string;
}): Promise<{ stimulus: string; question: string; figure: unknown; design: string }> {
  const figureDesc = FIGURE_DESC_BY_KIND[params.figureKind];
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "generate_math_stem",
        description: "수학 문항의 지문·질문·자료(그림) 데이터만 만든다. 정답·선택지는 만들지 않는다 — 뒤 단계가 따로 푼다.",
        input_schema: {
          type: "object",
          properties: {
            design: { type: "string", description: "핵심 관계 2~3개와 무엇을 구하는 문제인지 — 실제 값은 쓰지 않고 관계만(뒤 단계가 이걸 보고 독립적으로 푼다)." },
            stimulus: { type: "string", description: "지문/조건 설명(영어, 실제 SAT Math 문항 말투). 그림을 가리키면 'in the figure' 등으로." },
            question: { type: "string", description: "묻는 문장 하나(영어, 물음표로 끝). 예: 'What is the value of x?'" },
            figure: { type: "object", description: figureDesc },
          },
          required: ["design", "stimulus", "question", "figure"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_math_stem" },
    messages: [
      {
        role: "user",
        content: `SAT Math 문항의 지문·질문·자료만 만드세요(정답·선택지는 만들지 않습니다 — 별도 단계가 독립적으로 풉니다).
- 과목: ${params.subjectName} · 유형: ${params.skillType} · 난이도: ${params.difficulty}${params.topic ? ` · 주제: ${params.topic}` : ""}
- 실제 시험 범위의 정상적인 문제로 만드세요. 자료(그림)는 지문이 부르는 이름·값과 정확히 같아야 합니다.
- "다음 중 그래프는?"처럼 선택지 자체가 그래프인 문제는 만들지 마세요(이 단계는 그런 형식을 지원하지 않습니다) — 값을 구하는 질문으로 만드세요.`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("1단계(자료+문항) 응답을 처리할 수 없습니다.");
  const input = toolUse.input as { design?: string; stimulus?: string; question?: string; figure?: unknown };
  if (!input.stimulus?.trim() || !input.question?.trim() || !input.figure) throw new Error("1단계 응답이 불완전합니다.");
  return { design: input.design ?? "", stimulus: input.stimulus, question: input.question, figure: input.figure };
}

/** 2단계 — 독립 풀이(값 계산형). 1단계 산출물만 보고 처음부터 다시 풀어 정답값을 낸다. */
async function solveMathStem(params: {
  stimulus: string; question: string; figure: unknown; difficulty: ProblemDifficulty;
}): Promise<{ answerText: string; explanation: string }> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    tools: [
      {
        name: "solve_math_stem",
        description: "이 수학 문제를 처음부터 독립적으로 풀어 정답값과 풀이를 낸다.",
        input_schema: {
          type: "object",
          properties: {
            answer_text: { type: "string", description: "최종 정답 값만(선택지에 그대로 들어갈 형태, 예: '12', 'x = 3', '2/3')." },
            explanation: { type: "string", description: "한국어 해설 — 풀이 과정과 최종 답이 위 answer_text와 정확히 일치해야 한다." },
          },
          required: ["answer_text", "explanation"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "solve_math_stem" },
    messages: [
      {
        role: "user",
        content: `아래 SAT Math 문제를 처음부터 직접 풀어 정답을 내세요. 이 문제를 만든 사람이 이미 답을 정했더라도 무시하고, 지문·자료만 보고 독립적으로 계산하세요.
난이도: ${params.difficulty}
지문/조건: ${params.stimulus}
질문: ${params.question}
자료(그림) 데이터: ${JSON.stringify(params.figure)}`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("2단계(독립 풀이) 응답을 처리할 수 없습니다.");
  const input = toolUse.input as { answer_text?: string; explanation?: string };
  if (!input.answer_text?.trim() || !input.explanation?.trim()) throw new Error("2단계 응답이 불완전합니다.");
  return { answerText: input.answer_text.trim(), explanation: input.explanation.trim() };
}

/** 3단계 — 오답 하나. 검증된 정답을 알려주고, 그 값과 겹치지 않는 그럴듯한 오답 하나를 구조화된 계획과 함께 만든다. */
async function generateOneDistractor(params: {
  stimulus: string; question: string; correctAnswerText: string; explanation: string; difficulty: ProblemDifficulty; avoid: string[];
}): Promise<string> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    tools: [
      {
        name: "generate_one_distractor",
        description: "검증된 정답과 다른, 실제 풀이 오류에서 나올 법한 오답 하나만 만든다.",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string", description: "새 오답 값(정답과 같은 형식). 이 필드를 먼저 채운다." },
            error_type: { type: "string", description: "이 오답이 나오는 실제 풀이 오류(부호·단위·한 단계 누락·축 오독·조건 무시·계산 실수 등)." },
          },
          required: ["text", "error_type"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_one_distractor" },
    messages: [
      {
        role: "user",
        content: `아래 문제의 검증된 정답은 "${params.correctAnswerText}" 입니다(해설: ${params.explanation}). 이 값과 다른, 실제 풀이 오류 하나에서 나올 법한 오답을 하나만 만드세요.
지문: ${params.stimulus}
질문: ${params.question}
난이도: ${params.difficulty}
${params.avoid.length ? `이미 나온 값과 겹치면 안 됩니다: ${params.avoid.join(", ")}` : ""}`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("3단계(오답) 응답을 처리할 수 없습니다.");
  const input = toolUse.input as { text?: string };
  const text = stripOptionSelfLabels([(input.text ?? "").trim()])[0];
  if (!text) throw new Error("3단계 오답이 비어 있습니다.");
  return text;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type StagedFailure = { stage: "stem" | "solve" | "distractors" | "final"; reason: string };

/**
 * 어려움+자료 필요 수학 문항 하나를 4단계로 만든다. 각 단계는 최대 2회 시도한다. 4단계(최종 검수)에서
 * 걸리면 원인이 어느 단계 소관인지 계약 위반 코드로 판정해 그 단계만 다시 시킨다 — 전부 다시 만들지 않는다.
 * 그래도 안 되면 null(폐기) — 절대 관리자에게 넘기지 않는다.
 */
export async function generateStagedHardMathItem(params: {
  subjectName: string; skillType: string; skillCode: string | null; examSystem: string | null;
  difficulty: ProblemDifficulty; figureKind: MathFigureKind; topic?: string;
  onModelCall?: () => void;
}): Promise<{ ok: true; item: StagedMathItem } | { ok: false; failures: StagedFailure[] }> {
  const failures: StagedFailure[] = [];
  const call = () => params.onModelCall?.();

  let stem: { stimulus: string; question: string; figure: unknown; design: string } | null = null;
  let solved: { answerText: string; explanation: string } | null = null;
  let distractors: string[] = [];

  for (let stemAttempt = 0; stemAttempt < 2 && !stem; stemAttempt++) {
    try {
      call();
      stem = await generateMathStemOnly(params);
    } catch (e) {
      failures.push({ stage: "stem", reason: e instanceof Error ? e.message : "1단계 실패" });
    }
  }
  if (!stem) return { ok: false, failures };

  for (let round = 0; round < 2; round++) {
    // 2단계 — 독립 풀이(값 계산형만 — (b)(c) 유형은 4단계 계약 검사가 이미 거부한다).
    if (!solved) {
      try {
        call();
        solved = await solveMathStem({ stimulus: stem.stimulus, question: stem.question, figure: stem.figure, difficulty: params.difficulty });
      } catch (e) {
        failures.push({ stage: "solve", reason: e instanceof Error ? e.message : "2단계 실패" });
        continue;
      }
    }

    // 3단계 — 오답 3개(병렬, 서로 중복 안 되게).
    if (distractors.length < 3) {
      const need = 3 - distractors.length;
      const avoid = [solved.answerText, ...distractors];
      const results = await Promise.all(
        Array.from({ length: need }, async () => {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              call();
              const text = await generateOneDistractor({
                stimulus: stem!.stimulus, question: stem!.question, correctAnswerText: solved!.answerText,
                explanation: solved!.explanation, difficulty: params.difficulty, avoid,
              });
              const norm = text.trim().toLowerCase();
              if (![...avoid].some((a) => a.trim().toLowerCase() === norm)) return text;
              avoid.push(text);
            } catch (e) {
              failures.push({ stage: "distractors", reason: e instanceof Error ? e.message : "3단계 실패" });
            }
          }
          return null;
        })
      );
      const newOnes = results.filter((r): r is string => r !== null);
      distractors = [...distractors, ...newOnes];
      if (distractors.length < 3) continue; // 3개를 못 채웠으면 이번 라운드는 여기서 끝 — 다음 라운드에서 나머지만 다시.
    }

    // 선택지 조립 + 셔플.
    const correctText = solved.answerText;
    const shuffled = shuffle([correctText, ...distractors.slice(0, 3)]);
    const correctIndex = shuffled.indexOf(correctText);
    const options = shuffled;
    const explanation = solved.explanation;

    // 4단계 — 최종 검수(코드 우선).
    const contract = checkQualityContract({
      skillCode: params.skillCode, examSystem: params.examSystem, format: "mc",
      stimulus: stem.stimulus, question: stem.question, options, correctIndex, answers: null, statements: null,
      explanation, figure: stem.figure,
    });
    if (contract.ok) {
      call();
      const resolved = await resolveAnswerFromExplanationCore({ stimulus: stem.stimulus, question: stem.question, options, explanation });
      if (resolved.ok && resolved.confidence === "high" && resolved.concludedIndex === correctIndex) {
        return { ok: true, item: { stimulus: stem.stimulus, question: stem.question, figure: stem.figure, options, correctIndex, explanation, design: stem.design } };
      }
      failures.push({ stage: "solve", reason: "정답-해설 자기 일관성 검사 실패" });
      solved = null; // 2단계부터 다시.
      distractors = [];
      continue;
    }

    // 계약 위반 코드로 어느 단계 소관인지 판정.
    const codes = contract.issues.map((i) => i.code);
    const stemFault = codes.some((c) => /^contract_(ref_|label_|clipped|impossible|figure_)/.test(c) || c === "contract_condition_ambiguous" || c === "contract_condition_no_match" || c === "contract_figure_choice_placeholder");
    const solveFault = codes.some((c) => c === "contract_system_solution_mismatch" || c === "contract_answer");
    failures.push({ stage: stemFault ? "stem" : solveFault ? "solve" : "distractors", reason: contract.issues.map((i) => i.message).slice(0, 2).join(" / ") });
    if (stemFault) return { ok: false, failures }; // 1단계 잘못 — 이 함수 호출 자체를 다시(호출자가 처음부터 재시도).
    if (solveFault) { solved = null; distractors = []; continue; }
    distractors = []; // 오답 문제 — 오답만 다시(정답·해설은 유지).
  }
  return { ok: false, failures };
}
