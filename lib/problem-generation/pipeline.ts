// 생성 파이프라인(2026-09-15) — 단건·복수·표본 검증 스크립트가 같은 경로를 쓴다.
//
//   생성(core) → 자료 필요하면 자료 생성 → 유형별 품질 계약(다섯 연결) → 독립 품질 검사(정답·오답 품질·추정 난이도)
//   → 통과한 것만 accepted. 걸리면 사유를 피드백으로 1회 재생성 → 재검사. 부족분은 1회 재생성.
// 저장은 호출자가 한다(서버 액션은 DB 에, 스크립트는 보고서에).
import { generateSectionProblemsCore, regenerateProblemCore, generateFigureForProblemCore, type FigurePolicy, type ProblemDifficulty, type ProblemFormat } from "./core";
import { reviewProblemIndependently, judgeReview, type IndependentReview, type QualityRecord, type DistractorRationale, type DistractorKind } from "./review";
import { checkQualityContract } from "@/lib/problem-quality-contract";
import { judgeMaterialNeed, materialBlocker } from "@/lib/problem-material-need";
import { composeProblemText } from "@/lib/problem-question";
import { skillLabel } from "@/lib/problem-taxonomy";

export type GeneratedProblem = Awaited<ReturnType<typeof generateSectionProblemsCore>>[number];
type FigureKind = "plane" | "parallel_transversal" | "triangle" | "circle" | "polygon" | "solid" | "composite" | "data" | "figure_choice" | "figure_set";

export type PipelineParams = {
  subjectName: string;
  skillType: string;
  skillCode?: string | null;
  examSystem?: string | null;
  topic?: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  count: number;
  figurePolicy?: FigurePolicy;
  /** 독립 검사를 끄고 싶을 때(테스트). 기본 켜짐. */
  skipReview?: boolean;
};

export type Accepted = { problem: GeneratedProblem; quality: QualityRecord };
export type Failure = {
  skillCode: string | null;
  stage: "generate" | "material" | "contract" | "review" | "regenerate";
  reason: string;
  /** 재생성으로 해소됐는가(해소되면 accepted 에도 들어간다). */
  resolved: boolean;
  snippet: string;
};
export type PipelineResult = {
  accepted: Accepted[];
  failures: Failure[];
  stats: { requested: number; generated: number; accepted: number; regenerated: number; regenerationResolved: number; refilled: number };
};

/** 자료 판정 → 자료 생성기에 넘길 표준 유형. 도형은 본문에서 읽은 템플릿이 우선, 없으면 세부 기술로 고른다. */
export function pickFigureKind(need: ReturnType<typeof judgeMaterialNeed>, text: string, skillCode: string | null, figurePolicy?: string): FigureKind | null {
  const kind = need.kind ?? (figurePolicy === "require_plane" ? "plane" : figurePolicy === "require_data" ? "data" : figurePolicy === "require_figure_choice" ? "figure_choice" : figurePolicy === "require_geometry" ? "geometry" : null);
  if (!kind) return null;
  if (kind !== "geometry") return kind;
  if (need.geometry.length) return need.geometry[0];
  if (/\bparallel\b/i.test(text)) return "parallel_transversal";
  if (skillCode === "circles") return "circle";
  if (skillCode === "area_volume") return /\b(volume|cylinder|cone|sphere|prism|cube|pyramid)\b/i.test(text) ? "solid" : "polygon";
  return "triangle";
}

const snippetOf = (g: GeneratedProblem) => `${(g.question ?? g.passage ?? "").slice(0, 40)}…`;

export async function runGenerationPipeline(params: PipelineParams): Promise<PipelineResult> {
  const requested = Math.max(1, Math.min(10, params.count));
  const accepted: Accepted[] = [];
  const failures: Failure[] = [];
  const stats = { requested, generated: 0, accepted: 0, regenerated: 0, regenerationResolved: 0, refilled: 0 };
  const skillCode = params.skillCode ?? null;
  const label = skillCode ? skillLabel(skillCode) ?? params.skillType : params.skillType;

  const generate = async (count: number) =>
    generateSectionProblemsCore({
      sectionTitle: params.topic?.trim() || params.skillType, subjectName: params.subjectName, skillType: params.skillType,
      difficulty: params.difficulty, format: params.format, count, figurePolicy: params.figurePolicy ?? "optional", skillCode: skillCode ?? undefined, keepFigureless: true,
    });

  const makeFigure = async (g: GeneratedProblem, text: string, need: ReturnType<typeof judgeMaterialNeed>) => {
    const kind = pickFigureKind(need, text, skillCode, params.figurePolicy);
    if (!kind) return;
    try {
      const r = await generateFigureForProblemCore({ passage: text, options: g.options ?? null, explanation: g.explanation, kind, correctIndex: g.correctIndex ?? null });
      if (r.ok) g.figure = r.figure;
      else console.error("[pipeline] 자료 생성 실패:", kind, r.error);
    } catch (e) {
      console.error("[pipeline] 자료 생성 오류:", kind, e instanceof Error ? e.message : e);
    }
  };

  /** 한 결과를 게이트에 통과시킨다. 실패하면 depth 0 에서는 사유 피드백으로 1회 재생성. */
  const gate = async (g: GeneratedProblem, depth: number): Promise<boolean> => {
    const stimulus = g.stimulus ?? g.passage;
    const question = g.question ?? null;
    const text = composeProblemText(stimulus, question);
    const fail = async (stage: Failure["stage"], reason: string): Promise<boolean> => {
      if (depth === 0) {
        stats.regenerated += 1;
        try {
          const revised = await regenerateProblemCore({
            sectionTitle: params.topic?.trim() || params.skillType, subjectName: params.subjectName, skillType: params.skillType,
            difficulty: params.difficulty, format: params.format, current: { ...g, passage: text },
            feedback: `검증에 걸렸습니다: ${reason}. 이 사유가 해소되도록 지문·자료·질문·선택지·정답·해설을 서로 맞게 다시 쓰세요. 자료(figure)는 지문이 부르는 이름·값과 정확히 같아야 하고 정답이 드러나면 안 됩니다. 오답은 지문·자료의 일부를 맞게 반영하되 핵심 관계 하나를 놓친 것이어야 합니다.`,
          });
          const ok = await gate({ ...revised, needsFigure: false } as GeneratedProblem, 1);
          if (ok) stats.regenerationResolved += 1;
          failures.push({ skillCode, stage, reason, resolved: ok, snippet: snippetOf(g) });
          return ok;
        } catch (e) {
          failures.push({ skillCode, stage: "regenerate", reason: `${reason} (재생성 실패: ${e instanceof Error ? e.message : "오류"})`, resolved: false, snippet: snippetOf(g) });
          return false;
        }
      }
      failures.push({ skillCode, stage, reason, resolved: false, snippet: snippetOf(g) });
      return false;
    };

    // 1) 자료 필요성 → 자료 생성.
    const need = judgeMaterialNeed({ examSystem: params.examSystem ?? null, skillCode, text });
    const missingRequired = need.level === "required" && materialBlocker(need, g.figure ?? null) !== null;
    if (g.needsFigure || missingRequired || (g.figure == null && params.figurePolicy?.startsWith("require"))) await makeFigure(g, text, need);

    // 2) 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) — 자료 검증에 걸리면 자료를 한 번 더 만들어 재검사.
    const contractInput = { skillCode, examSystem: params.examSystem ?? null, format: params.format, stimulus, question, options: g.options ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null, statements: g.statements ?? null, explanation: g.explanation, figure: g.figure ?? null };
    let contract = checkQualityContract(contractInput);
    if (!contract.ok && g.figure != null && contract.issues.some((i) => /contract_(ref_|label_|clipped|impossible|unit_|option_leak|choice_bias|answer_mismatch)/.test(i.code))) {
      await makeFigure(g, text, need);
      contract = checkQualityContract({ ...contractInput, figure: g.figure ?? null });
    }
    if (!contract.ok) return fail(contract.issues[0].code.startsWith("contract_rw_") || contract.issues[0].code === "contract_evidence" ? "contract" : "contract", contract.issues.map((i) => i.message).slice(0, 2).join(" / "));

    // 3) 독립 품질 검사.
    let review: IndependentReview | null = null;
    if (!params.skipReview) {
      try {
        review = await reviewProblemIndependently({
          skillLabel: label, examSystem: params.examSystem ?? null, format: params.format, stimulus, question: question ?? "", options: g.options ?? null,
          statements: g.statements ?? null, figure: g.figure ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null, requestedDifficulty: params.difficulty,
        });
      } catch (e) {
        console.error("[pipeline] 독립 검사 오류:", e instanceof Error ? e.message : e);
      }
      if (review) {
        const reasons = judgeReview(review, params.difficulty, params.format);
        if (reasons.length) return fail("review", reasons.join(" / "));
      }
    }

    // 4) 통과 — 품질 기록.
    const generatorRationales: DistractorRationale[] = (g.distractorRationales ?? []).map((d) => ({ index: d.index, plausibleBecause: d.plausible_because, matches: d.matches, whyWrong: d.why_wrong, kind: (d.kind as DistractorKind) ?? "other", obvious: false }));
    const distractors = review?.distractors.length ? review.distractors : generatorRationales;
    const needsReviewReasons: string[] = [];
    if (!review) needsReviewReasons.push("독립 검사를 실행하지 못했습니다");
    if (review && review.confidence === "low") needsReviewReasons.push("독립 검사 확신이 낮습니다");
    if (review && review.estimatedDifficulty !== params.difficulty) needsReviewReasons.push(`요청 난이도(${params.difficulty})와 추정 난이도(${review.estimatedDifficulty})가 다릅니다`);
    if (params.format === "mc" && distractors.length < 3) needsReviewReasons.push("오답 근거가 셋 미만입니다");
    const quality: QualityRecord = {
      contract: { ok: true, issues: [] },
      estimatedDifficulty: review?.estimatedDifficulty ?? params.difficulty,
      requestedDifficulty: params.difficulty,
      difficultyReasons: review?.difficultyReasons.length ? review.difficultyReasons : g.difficultyRationale ? [g.difficultyRationale] : [],
      distractors,
      independentReview: review ? { pickedIndex: review.pickedIndex, pickedAnswer: review.pickedAnswer, agrees: review.agrees, confidence: review.confidence, flags: review.flags } : { pickedIndex: null, pickedAnswer: null, agrees: false, confidence: "low", flags: ["미실행"] },
      needsReview: needsReviewReasons.length > 0,
      needsReviewReasons,
      calibrated: false,
      reviewedAt: new Date().toISOString(),
    };
    accepted.push({ problem: g, quality });
    return true;
  };

  let generated: GeneratedProblem[] = [];
  try {
    generated = await generate(requested);
  } catch (e) {
    const message = e instanceof Error ? e.message : "생성 실패";
    failures.push({ skillCode, stage: "generate", reason: message, resolved: false, snippet: "" });
    return { accepted, failures, stats };
  }
  stats.generated += generated.length;
  for (const g of generated) if (await gate(g, 0)) stats.accepted += 1;

  if (stats.accepted < requested) {
    try {
      const refill = await generate(requested - stats.accepted);
      stats.generated += refill.length;
      stats.refilled += refill.length;
      for (const g of refill) if (stats.accepted < requested && (await gate(g, 0))) stats.accepted += 1;
    } catch (e) {
      failures.push({ skillCode, stage: "generate", reason: `부족분 재생성 실패: ${e instanceof Error ? e.message : "오류"}`, resolved: false, snippet: "" });
    }
  }
  return { accepted, failures, stats };
}
