// 생성 파이프라인(2026-09-15) — 단건·복수·표본 검증 스크립트가 같은 경로를 쓴다.
//
//   생성(core) → 자료 필요하면 자료 생성 → 유형별 품질 계약(다섯 연결) → 독립 품질 검사(정답·오답 품질·추정 난이도)
//   → 통과한 것만 accepted. 걸리면 사유를 피드백으로 1회 재생성 → 재검사. 부족분은 1회 재생성.
// 저장은 호출자가 한다(서버 액션은 DB 에, 스크립트는 보고서에).
import { generateSectionProblemsCore, regenerateProblemCore, generateFigureForProblemCore, repairDistractorsCore, repairFieldsCore, type FigurePolicy, type ProblemDifficulty, type ProblemFormat } from "./core";
import { reviewProblemIndependently, classifyReviewIssues, type IndependentReview, type QualityRecord, type DistractorRationale, type DistractorKind } from "./review";
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
/** 오답 부분 수정만으로 끝나지 않은 항목 — 지문·질문·정답·자료는 통과했다. 일반 초안이 아니라 별도 대기함으로 간다(2026-09-15). */
export type Held = { problem: GeneratedProblem; quality: QualityRecord; reasons: string[] };
export type Failure = {
  skillCode: string | null;
  stage: "generate" | "material" | "contract" | "review" | "regenerate";
  reason: string;
  /** 재생성으로 해소됐는가(해소되면 accepted 에도 들어간다). */
  resolved: boolean;
  snippet: string;
};
type GateOutcome = { kind: "accepted"; quality: QualityRecord } | { kind: "held"; quality: QualityRecord; reasons: string[] } | { kind: "rejected" };
export type PipelineResult = {
  accepted: Accepted[];
  held: Held[];
  failures: Failure[];
  stats: {
    requested: number; generated: number; accepted: number; regenerated: number; regenerationResolved: number; refilled: number;
    distractorRepairs: number; distractorRepairsResolved: number; fieldRepairs: number; fieldRepairsResolved: number; held: number;
    /** 문항 하나당 평균 모델 호출 수(생성 1 + 자료·재생성·부분수정·독립검사 전부 포함) — 보고용. */
    modelCalls: number;
  };
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
  const stats = { requested, generated: 0, accepted: 0, regenerated: 0, regenerationResolved: 0, refilled: 0, distractorRepairs: 0, distractorRepairsResolved: 0, fieldRepairs: 0, fieldRepairsResolved: 0, held: 0, modelCalls: 0 };
  const held: Held[] = [];
  const countCall = () => { stats.modelCalls += 1; };
  const skillCode = params.skillCode ?? null;
  const label = skillCode ? skillLabel(skillCode) ?? params.skillType : params.skillType;

  const generate = async (count: number) => {
    countCall();
    return generateSectionProblemsCore({
      sectionTitle: params.topic?.trim() || params.skillType, subjectName: params.subjectName, skillType: params.skillType,
      difficulty: params.difficulty, format: params.format, count, figurePolicy: params.figurePolicy ?? "optional", skillCode: skillCode ?? undefined, keepFigureless: true,
    });
  };

  const makeFigure = async (g: GeneratedProblem, text: string, need: ReturnType<typeof judgeMaterialNeed>) => {
    const kind = pickFigureKind(need, text, skillCode, params.figurePolicy);
    if (!kind) return;
    countCall();
    try {
      const r = await generateFigureForProblemCore({ passage: text, options: g.options ?? null, explanation: g.explanation, kind, correctIndex: g.correctIndex ?? null });
      if (r.ok) g.figure = r.figure;
      else console.error("[pipeline] 자료 생성 실패:", kind, r.error);
    } catch (e) {
      console.error("[pipeline] 자료 생성 오류:", kind, e instanceof Error ? e.message : e);
    }
  };

  /**
   * 코드별 계약 실패를 어떻게 다룰지 — ① 자료 문제(이미 재시도됨) ② 부분 수정으로 끝나는 범위 명확한 문제(빈칸·수식·선택지 개수 등)
   * ③ 정답·질문 자체가 걸린 구조적 문제(전체 재생성 필요).
   */
  const classifyContractIssue = (code: string): "figure" | "structural" | "text" => {
    if (/^contract_(ref_|label_|clipped|impossible|unit_|option_leak|choice_bias|answer_mismatch)/.test(code)) return "figure";
    if (code === "contract_target" || code === "contract_answer" || code === "contract_evidence") return "structural";
    return "text";
  };

  /** 한 결과를 게이트에 통과시킨다. 실패하면 depth 0 에서는 사유 피드백으로 1회 재생성(구조적 실패만 — 오답만 걸린 문항은 재생성하지 않고 대기함으로 보낸다). */
  const gate = async (g: GeneratedProblem, depth: number): Promise<GateOutcome> => {
    let stimulus = g.stimulus ?? g.passage;
    let question = g.question ?? null;
    let text = composeProblemText(stimulus, question);
    // 어려움 문항은 오답 기준이 엄격해 한 번의 보완으로 부족한 경우가 많다 — 재생성을 2회까지 허용한다.
    const maxDepth = params.difficulty === "hard" ? 2 : 1;
    const fail = async (stage: Failure["stage"], reason: string): Promise<GateOutcome> => {
      if (depth < maxDepth) {
        stats.regenerated += 1;
        countCall();
        try {
          const revised = await regenerateProblemCore({
            sectionTitle: params.topic?.trim() || params.skillType, subjectName: params.subjectName, skillType: params.skillType,
            difficulty: params.difficulty, format: params.format, current: { ...g, passage: text },
            feedback: `검증에 걸렸습니다: ${reason}. 이 사유가 해소되도록 지문·자료·질문·선택지·정답·해설을 서로 맞게 다시 쓰세요. 자료(figure)는 지문이 부르는 이름·값과 정확히 같아야 하고 정답이 드러나면 안 됩니다. 오답은 지문·자료의 일부를 맞게 반영하되 핵심 관계 하나를 놓친 것이어야 합니다.`,
          });
          const outcome = await gate({ ...revised, needsFigure: false } as GeneratedProblem, depth + 1);
          const ok = outcome.kind !== "rejected";
          if (ok) stats.regenerationResolved += 1;
          failures.push({ skillCode, stage, reason, resolved: ok, snippet: snippetOf(g) });
          return outcome;
        } catch (e) {
          failures.push({ skillCode, stage: "regenerate", reason: `${reason} (재생성 실패: ${e instanceof Error ? e.message : "오류"})`, resolved: false, snippet: snippetOf(g) });
          return { kind: "rejected" };
        }
      }
      failures.push({ skillCode, stage, reason, resolved: false, snippet: snippetOf(g) });
      return { kind: "rejected" };
    };

    // 1) 자료 필요성 → 자료 생성.
    let need = judgeMaterialNeed({ examSystem: params.examSystem ?? null, skillCode, text });
    const missingRequired = need.level === "required" && materialBlocker(need, g.figure ?? null) !== null;
    if (g.needsFigure || missingRequired || (g.figure == null && params.figurePolicy?.startsWith("require"))) await makeFigure(g, text, need);

    // 2) 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식).
    const contractInputOf = () => ({ skillCode, examSystem: params.examSystem ?? null, format: params.format, stimulus, question, options: g.options ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null, statements: g.statements ?? null, explanation: g.explanation, figure: g.figure ?? null });
    let contract = checkQualityContract(contractInputOf());
    if (!contract.ok) {
      const kinds = new Set(contract.issues.map((i) => classifyContractIssue(i.code)));
      if (kinds.has("figure") && g.figure != null) {
        // 자료 참조·렌더 문제 — 자료를 한 번 더 만들어 재검사.
        await makeFigure(g, text, need);
        contract = checkQualityContract(contractInputOf());
      }
      if (!contract.ok && !Array.from(new Set(contract.issues.map((i) => classifyContractIssue(i.code)))).some((k) => k === "structural" || k === "figure")) {
        // 범위가 명확한 문제(빈칸·수식·선택지 개수 등)만 남았으면 그 필드만 고친다(2026-09-15: "부분 수정이 기본 경로").
        stats.fieldRepairs += 1;
        countCall();
        try {
          const repaired = await repairFieldsCore({
            skillType: params.skillType, subjectName: params.subjectName, difficulty: params.difficulty, format: params.format,
            passage: stimulus, question: question ?? "", options: g.options ?? null, correctIndex: g.correctIndex ?? null, statements: g.statements ?? null, explanation: g.explanation,
            issues: contract.issues.map((i) => i.message),
          });
          if (repaired.ok) {
            g.stimulus = repaired.passage; g.passage = repaired.passage; g.question = repaired.question || null;
            g.options = repaired.options; g.correctIndex = repaired.correctIndex; g.statements = repaired.statements; g.explanation = repaired.explanation;
            stimulus = repaired.passage; question = repaired.question || null; text = composeProblemText(stimulus, question);
            need = judgeMaterialNeed({ examSystem: params.examSystem ?? null, skillCode, text });
            const reContract = checkQualityContract(contractInputOf());
            if (!reContract.ok) contract = reContract;
            else { stats.fieldRepairsResolved += 1; contract = reContract; }
          }
        } catch (e) {
          console.error("[pipeline] 부분 수정 오류:", e instanceof Error ? e.message : e);
        }
      }
    }
    if (!contract.ok) return fail("contract", contract.issues.map((i) => i.message).slice(0, 2).join(" / "));

    // 3) 독립 품질 검사.
    const runReview = () => { countCall(); return reviewProblemIndependently({
      skillLabel: label, examSystem: params.examSystem ?? null, format: params.format, stimulus, question: question ?? "", options: g.options ?? null,
      statements: g.statements ?? null, figure: g.figure ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null, requestedDifficulty: params.difficulty,
      design: g.design ?? null,
    }); };
    let review: IndependentReview | null = null;
    let secondReviewDisagreedFirst = false;
    let heldReasons: string[] | null = null;
    if (!params.skipReview) {
      try {
        review = await runReview();
      } catch (e) {
        console.error("[pipeline] 독립 검사 오류:", e instanceof Error ? e.message : e);
      }
      if (review && !review.agrees) {
        // 독립 검사도 틀릴 수 있다 — 한 번 더 묻고, 2차가 지정 정답과 일치하면 '검토 필요'로 통과시킨다. 둘 다 불일치면 저장하지 않는다.
        try {
          const second = await runReview();
          if (second.agrees) { secondReviewDisagreedFirst = true; review = { ...second, confidence: "low" }; }
        } catch (e) {
          console.error("[pipeline] 2차 독립 검사 오류:", e instanceof Error ? e.message : e);
        }
      }
      if (review) {
        let issues = classifyReviewIssues(review, params.difficulty, params.format);
        // 오답 품질**만** 걸렸으면(정답·난이도·기타 지적은 문제없음) 문항 전체를 다시 만들지 않고 그 자리만 고쳐 재검사한다
        // (2026-09-15 제품 오너: "부분 수정이 기본 경로" — 해소율이 전체 재생성보다 훨씬 높다).
        if (issues.reasons.length && !issues.hasStructuralIssue && issues.distractorTargets.length && params.format === "mc" && g.options && g.correctIndex !== null) {
          stats.distractorRepairs += 1;
          countCall();
          try {
            const repaired = await repairDistractorsCore({
              skillType: params.skillType, subjectName: params.subjectName, difficulty: params.difficulty, stimulus: text, question: question ?? "",
              options: g.options, correctIndex: g.correctIndex, explanation: g.explanation, targets: issues.distractorTargets,
            });
            if (repaired.ok) {
              g.options = repaired.options;
              const reReview = await runReview();
              const reIssues = classifyReviewIssues(reReview, params.difficulty, params.format);
              if (!reIssues.reasons.length) { stats.distractorRepairsResolved += 1; review = reReview; issues = reIssues; }
              else { review = reReview; issues = reIssues; }
            }
          } catch (e) {
            console.error("[pipeline] 오답 부분 수정 오류:", e instanceof Error ? e.message : e);
          }
        }
        if (issues.reasons.length) {
          if (!issues.hasStructuralIssue && issues.distractorTargets.length) {
            // 부분 수정으로도 안 남은 문제가 오답 품질뿐이다 — 문항 전체를 다시 만들지 않고 별도 대기함으로 보낸다(2026-09-15: "전체 문항 재생성은 중단").
            heldReasons = issues.reasons;
          } else {
            return fail("review", issues.reasons.join(" / "));
          }
        }
      }
    }

    // 4) 통과(또는 오답 보강 대기) — 품질 기록.
    const generatorRationales: DistractorRationale[] = (g.distractorRationales ?? []).map((d) => ({ index: d.index, plausibleBecause: d.plausible_because, matches: d.matches, whyWrong: d.why_wrong, kind: (d.kind as DistractorKind) ?? "other", obvious: false }));
    const distractors = review?.distractors.length ? review.distractors : generatorRationales;
    const needsReviewReasons: string[] = [];
    if (!review) needsReviewReasons.push("독립 검사를 실행하지 못했습니다");
    if (review && review.confidence === "low") needsReviewReasons.push("독립 검사 확신이 낮습니다");
    if (secondReviewDisagreedFirst) needsReviewReasons.push("독립 검사 1차는 다른 답을 골랐고 2차만 일치했습니다 — 정답·오답을 사람이 확인하세요");
    if (review && params.format === "mc") {
      const weak = review.distractors.filter((d) => d.obvious || d.kind === "irrelevant");
      if (weak.length) needsReviewReasons.push(`쉽게 지워지는 오답 ${weak.map((d) => String.fromCharCode(65 + d.index) + ")").join(", ")}`);
    }
    if (review && review.estimatedDifficulty !== params.difficulty) needsReviewReasons.push(`요청 난이도(${params.difficulty})와 추정 난이도(${review.estimatedDifficulty})가 다릅니다`);
    if (params.format === "mc" && distractors.length < 3) needsReviewReasons.push("오답 근거가 셋 미만입니다");
    if (heldReasons) needsReviewReasons.push(...heldReasons);
    const quality: QualityRecord = {
      contract: { ok: true, issues: [] },
      estimatedDifficulty: review?.estimatedDifficulty ?? params.difficulty,
      requestedDifficulty: params.difficulty,
      difficultyReasons: review?.difficultyReasons.length ? review.difficultyReasons : g.difficultyRationale ? [g.difficultyRationale] : [],
      distractors,
      independentReview: review ? { pickedIndex: review.pickedIndex, pickedAnswer: review.pickedAnswer, agrees: review.agrees, confidence: review.confidence, flags: review.flags } : { pickedIndex: null, pickedAnswer: null, agrees: false, confidence: "low", flags: ["미실행"] },
      needsReview: needsReviewReasons.length > 0 || heldReasons !== null,
      needsReviewReasons,
      calibrated: false,
      reviewedAt: new Date().toISOString(),
    };
    if (heldReasons) return { kind: "held", quality, reasons: heldReasons };
    return { kind: "accepted", quality };
  };

  // 어려움은 오답·정답 기준이 엄격해 통과율이 낮다 — 요청보다 넉넉히 만들어 통과분만 채택한다(2026-09-15 제품 오너: "생성 수가 적으면 안 된다").
  const initialCount = params.difficulty === "hard" ? Math.min(10, requested + Math.min(2, requested)) : requested;
  let generated: GeneratedProblem[] = [];
  try {
    generated = await generate(initialCount);
  } catch (e) {
    const message = e instanceof Error ? e.message : "생성 실패";
    failures.push({ skillCode, stage: "generate", reason: message, resolved: false, snippet: "" });
    return { accepted, held, failures, stats };
  }
  stats.generated += generated.length;
  const record = (g: GeneratedProblem, outcome: GateOutcome) => {
    if (outcome.kind === "accepted") { accepted.push({ problem: g, quality: outcome.quality }); stats.accepted += 1; }
    else if (outcome.kind === "held") { held.push({ problem: g, quality: outcome.quality, reasons: outcome.reasons }); stats.held += 1; }
  };
  for (const g of generated) {
    if (stats.accepted >= requested) break;
    record(g, await gate(g, 0));
  }

  if (stats.accepted < requested) {
    try {
      const refill = await generate(Math.min(10, requested - stats.accepted + (params.difficulty === "hard" ? 1 : 0)));
      stats.generated += refill.length;
      stats.refilled += refill.length;
      for (const g of refill) { if (stats.accepted >= requested) break; record(g, await gate(g, 0)); }
    } catch (e) {
      failures.push({ skillCode, stage: "generate", reason: `부족분 재생성 실패: ${e instanceof Error ? e.message : "오류"}`, resolved: false, snippet: "" });
    }
  }
  // 평균 모델 호출 수 — 생성·자료·재생성·부분수정·독립검사를 통틀어, 실제로 뭔가를 얻은 문항(통과+대기) 하나당.
  const totalOutputs = stats.accepted + stats.held;
  const avgModelCalls = totalOutputs > 0 ? Math.round((stats.modelCalls / totalOutputs) * 100) / 100 : stats.modelCalls;
  return { accepted, held, failures, stats: { ...stats, modelCalls: avgModelCalls } };
}
