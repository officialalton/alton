// 생성 파이프라인(2026-09-15) — 단건·복수·표본 검증 스크립트가 같은 경로를 쓴다.
//
//   생성(core) → 자료 필요하면 자료 생성 → 유형별 품질 계약(다섯 연결) → 독립 품질 검사(정답·오답 품질·추정 난이도)
//   → 통과한 것만 accepted. 걸리면 사유를 피드백으로 1회 재생성 → 재검사. 부족분은 1회 재생성.
// 저장은 호출자가 한다(서버 액션은 DB 에, 스크립트는 보고서에).
import { generateSectionProblemsCore, regenerateProblemCore, generateFigureForProblemCore, repairOneDistractorCore, repairFieldsCore, resolveAnswerFromExplanationCore, type FigurePolicy, type ProblemDifficulty, type ProblemFormat } from "./core";
import { reviewProblemIndependently, classifyReviewIssues, type IndependentReview, type QualityRecord, type DistractorRationale, type DistractorKind } from "./review";
import { checkQualityContract } from "@/lib/problem-quality-contract";
import { judgeMaterialNeed, materialBlocker } from "@/lib/problem-material-need";
import { composeProblemText } from "@/lib/problem-question";
import { skillLabel } from "@/lib/problem-taxonomy";
import { isEvidenceModelSkill, checkEvidenceModelFields } from "./evidence-model-check";
import { isGrammarStructureSkill, checkGrammarStructureFields } from "./grammar-structure-check";
import { isQuantEvidenceSkill, checkQuantEvidenceFields } from "./quant-evidence-check";
import { isTransitionsSkill, checkTransitionRelationshipFields } from "./transition-relationship-check";
import { isRhetoricalSynthesisSkill, checkRhetoricalSynthesisFields } from "./rhetorical-synthesis-check";
import { isTextStructureSkill, checkTextStructureFields } from "./text-structure-check";
import { parseRwStimulus } from "@/lib/rw-stimulus";

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
  /**
   * 2026-09-17(UAT 지적) — 통과 판정이 난 "즉시" 호출된다(같은 배치의 다른 문항이
   * 아직 게이트를 통과하는 중이어도 기다리지 않는다). 호출자(서버 액션)가 여기서
   * 바로 DB에 저장하면, 배치 안의 느린 문항 하나(재생성 반복 등) 때문에 서버 함수
   * 시간 제한에 걸려 전체가 죽어도 이미 통과한 문항은 남는다.
   */
  onAccepted?: (item: Accepted) => Promise<void>;
  /**
   * 2026-09-17(제품 오너 지시) — "AI 생성 문항의 정상 결과는 자동 검사를 모두
   * 통과한 완성 후보뿐입니다." 오답만 걸린 문항을 '오답 보강 대기'로 저장해
   * 관리자가 고치게 하던 경로는 새 생성 경로에서 없앤다. 오답 문제는 그냥 실패로
   * 집계하고(failures), 상한 안에서 다른 후보로 대체한다 — 부족하면 부족한 대로
   * 반환한다(held 로 개수를 채운 것처럼 보이게 하지 않는다).
   */
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
// 2026-09-16(코드 검토 A) — accepted 는 검사한 최종 문항 객체를 함께 들고 다닌다.
// 재생성이 일어나면 그 최종본이 저장 후보가 되어야 하고, 호출부가 원본 g를 다시 쓰면 안 된다.
type GateOutcome =
  | { kind: "accepted"; quality: QualityRecord; problem: GeneratedProblem }
  | { kind: "rejected" };
/** 2026-09-17 — 유형·난이도별 상한(후보 수·문항당 최대 호출 수·배치 전체 벽시계 시간).
 * 상한을 넘기면 즉시 종료하고 그때까지의 통과분만 반환한다 — 부족분을 채우겠다고
 * 계속 재시도하다 서버 함수 시간 제한에 배치 전체가 죽는 것을 막는다. */
export type PipelineCaps = {
  /** 요청 수 대비 최대 후보 생성 배수(예: 어려움 2.0, 보통·쉬움 1.5). */
  maxCandidateMultiplier: number;
  /** 문항 하나(재생성·부분수정·재검사 전부 포함)당 최대 모델 호출 수. */
  maxModelCallsPerItem: number;
  /** 배치 전체 최대 벽시계 시간(ms) — Vercel 함수 시간 제한보다 여유 있게 짧아야 한다. */
  maxWallClockMs: number;
};
export const DEFAULT_PIPELINE_CAPS: Record<ProblemDifficulty, PipelineCaps> = {
  easy: { maxCandidateMultiplier: 1.5, maxModelCallsPerItem: 8, maxWallClockMs: 200_000 },
  medium: { maxCandidateMultiplier: 1.5, maxModelCallsPerItem: 8, maxWallClockMs: 200_000 },
  hard: { maxCandidateMultiplier: 2.5, maxModelCallsPerItem: 12, maxWallClockMs: 240_000 },
};
export type PipelineResult = {
  accepted: Accepted[];
  failures: Failure[];
  stats: {
    requested: number; generated: number; accepted: number; regenerated: number; regenerationResolved: number; refilled: number;
    distractorRepairs: number; distractorRepairsResolved: number; fieldRepairs: number; fieldRepairsResolved: number;
    /** 문항 하나당 평균 모델 호출 수(생성 1 + 자료·재생성·부분수정·독립검사 전부 포함) — 보고용. */
    modelCalls: number;
    /** 계약·독립검사 모두 한 번에 통과해 어떤 보정도 필요 없었던 문항 수(2026-09-15: 첫 생성 통과율 분리 보고). */
    firstPassCount: number;
    /** 게이트를 거친 후보(생성+재생성으로 얻은 모든 시도) 총 수 — 통과율 분모. */
    candidatesEvaluated: number;
    /** 생성 단계가 빈 배열/무응답을 반환한 횟수와 재시도 결과(원인 텍스트 포함, 2026-09-15). */
    emptyResponses: { cause: string; retried: boolean; resolved: boolean }[];
    /** 요청 수보다 적게 반환된 경우 유형·사유 기록(2026-09-15). */
    underReturned: { requested: number; returned: number; reason: string }[];
    /** 정답 자리와 해설의 결론이 달라 정답 자리를 해설 쪽으로 맞춘 횟수(2026-09-15). */
    answerExplanationFixes: number;
    /** 요청 수 대비 부족 수(0이면 목표 달성). */
    shortfall: number;
    /** 왜 목표에 못 미친 채로 끝났는지 — 상한에 걸렸는지, 후보가 계속 실패했는지. */
    stoppedReason: "target_met" | "candidate_cap" | "time_cap" | "no_more_candidates";
    /** 2026-09-17(UAT 지적 — "목표 60초/문항인데 실제는 훨씬 오래 걸린다") — 단계별
     * 누적 소요(ms). 어느 모델 호출이 실제 병목인지 실측하려고 추가했다. */
    timeMs: {
      /** 전체 파이프라인 벽시계 시간(요청→반환). */
      total: number;
      generate: number;
      figure: number;
      contractRepair: number;
      answerExplanationCheck: number;
      review: number;
      regenerate: number;
    };
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

/**
 * 문항마다 자료·계약·독립검사·오답보정이 서로 독립인데 순서대로 처리하면 벽시계 시간이 문항 수만큼 그대로 늘어난다
 * (2026-09-15 제품 오너: "1문제에 1분, 10문제 기준 10분이 맥시멈" — 유형당 초 단위 시간 목표 확정).
 * 최대 CONCURRENCY 개 문항을 동시에 게이트에 태워 벽시계 시간을 병렬도만큼 줄인다.
 */
const GATE_CONCURRENCY = 4;
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runGenerationPipeline(params: PipelineParams): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const requested = Math.max(1, Math.min(10, params.count));
  const caps = DEFAULT_PIPELINE_CAPS[params.difficulty];
  // 2026-09-17 — 후보군 상한은 요청 수 배수로 정한다("어려움은 최소 2배 후보군").
  const maxCandidates = Math.max(requested + 1, Math.ceil(requested * caps.maxCandidateMultiplier));
  const maxModelCallsTotal = requested * caps.maxModelCallsPerItem;
  const accepted: Accepted[] = [];
  const failures: Failure[] = [];
  const stats = {
    requested, generated: 0, accepted: 0, regenerated: 0, regenerationResolved: 0, refilled: 0, distractorRepairs: 0, distractorRepairsResolved: 0,
    fieldRepairs: 0, fieldRepairsResolved: 0, modelCalls: 0, firstPassCount: 0, candidatesEvaluated: 0,
    emptyResponses: [] as { cause: string; retried: boolean; resolved: boolean }[],
    underReturned: [] as { requested: number; returned: number; reason: string }[],
    answerExplanationFixes: 0,
    shortfall: requested,
    stoppedReason: "no_more_candidates" as PipelineResult["stats"]["stoppedReason"],
    timeMs: { total: 0, generate: 0, figure: 0, contractRepair: 0, answerExplanationCheck: 0, review: 0, regenerate: 0 },
  };
  const countCall = () => { stats.modelCalls += 1; };
  // 상한(후보 수 / 총 호출 수 / 벽시계 시간) 중 하나라도 넘겼는지 — 넘겼으면 더 시도하지 않고 즉시 종료한다.
  const capExceeded = (): "candidate_cap" | "time_cap" | null => {
    if (stats.candidatesEvaluated >= maxCandidates) return "candidate_cap";
    if (stats.modelCalls >= maxModelCallsTotal) return "candidate_cap";
    if (Date.now() - pipelineStart >= caps.maxWallClockMs) return "time_cap";
    return null;
  };
  // 2026-09-17 — 단계 하나를 재고, 그 단계 자체가 재귀(재생성 → 다시 gate())를
  // 타는 경우 이중으로 잡히지 않도록 각 타이머는 자기 구간만 잰다.
  const timed = async <T>(bucket: keyof typeof stats.timeMs, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      stats.timeMs[bucket] += Date.now() - t0;
    }
  };
  const skillCode = params.skillCode ?? null;
  const label = skillCode ? skillLabel(skillCode) ?? params.skillType : params.skillType;
  // 2026-09-16 — 이번 라운드 변경(정답 자동 변경 금지, 독립 검사 실행 실패 시 통과 금지)은 Math 한정이다.
  // R&W는 기존 승인된 동작을 그대로 유지한다.
  const isMathSystem = (params.examSystem ?? "").startsWith("sat_math");

  // 어려움은 문항당 응답이 길다(design·distractor_rationales 포함) — 한 호출에 너무 많이 요청하면 토큰 예산을 넘겨
  // 도구 호출이 잘리고 배열이 통째로 비어 돌아온다(2026-09-15 재확인: count=10 요청 시 재현). 호출당 개수를 제한하고
  // 여러 번 나눠 불러 모은다. 청크 하나가 비면 그 청크만 실패로 기록하고 나머지 청크는 계속 시도한다.
  const CHUNK = params.difficulty === "hard" ? 3 : 6;
  // 2026-09-18 — 같은 배치(이 pipeline 실행) 안에서 이미 나온 지문 소재를 누적해 다음 생성 호출에 "피하라"로 넘긴다.
  // 청크는 동시에 발사되므로 같은 순간의 청크끼리는 서로 볼 수 없지만, 이전 generate() 호출(첫 시도 이후의 재시도·보충 호출)이
  // 만든 소재는 전부 다음 호출들에 전달된다 — 지속 저장소 없이 이번 요청 안에서만 상태를 공유하는 방식.
  const recentTopics: string[] = [];
  const topicOf = (text: string): string => text.trim().split(/\n+/)[0]?.slice(0, 100) ?? "";
  const generate = async (count: number): Promise<GeneratedProblem[]> => {
    const chunkSizes: number[] = [];
    let remaining = count;
    while (remaining > 0) { const n = Math.min(CHUNK, remaining); remaining -= n; chunkSizes.push(n); }
    const avoidTopics = recentTopics.slice(-30);
    // 청크끼리는 서로 독립적인 생성 호출이다 — 순서대로 기다리지 않고 동시에 보낸다(벽시계 시간 단축).
    const chunks = await mapWithConcurrency(chunkSizes, GATE_CONCURRENCY, async (n) => {
      countCall();
      try {
        const chunk = await timed("generate", () => generateSectionProblemsCore({
          sectionTitle: params.topic?.trim() || params.skillType, subjectName: params.subjectName, skillType: params.skillType,
          difficulty: params.difficulty, format: params.format, count: n, figurePolicy: params.figurePolicy ?? "optional", skillCode: skillCode ?? undefined, keepFigureless: true,
          avoidTopics,
        }));
        if (chunk.length === 0) stats.emptyResponses.push({ cause: `생성 청크(${n}개 요청)가 빈 배열을 반환`, retried: false, resolved: false });
        else if (chunk.length < n) stats.underReturned.push({ requested: n, returned: chunk.length, reason: "생성 청크가 요청보다 적게 반환" });
        return chunk;
      } catch (e) {
        stats.emptyResponses.push({ cause: `생성 청크(${n}개 요청) 예외: ${e instanceof Error ? e.message : "오류"}`, retried: false, resolved: false });
        return [] as GeneratedProblem[];
      }
    });
    const flat = chunks.flat();
    for (const g of flat) {
      const t = topicOf(g.stimulus ?? g.passage ?? "");
      if (t) recentTopics.push(t);
    }
    return flat;
  };

  const makeFigure = async (g: GeneratedProblem, text: string, need: ReturnType<typeof judgeMaterialNeed>) => {
    const kind = pickFigureKind(need, text, skillCode, params.figurePolicy);
    if (!kind) return;
    countCall();
    try {
      const r = await timed("figure", () => generateFigureForProblemCore({ passage: text, options: g.options ?? null, explanation: g.explanation, kind, correctIndex: g.correctIndex ?? null }));
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
    if (code === "contract_target" || code === "contract_answer" || code === "contract_evidence" || code === "contract_figure_choice_placeholder" || code === "contract_system_solution_mismatch" || code === "contract_condition_ambiguous" || code === "contract_condition_no_match") return "structural";
    return "text";
  };

  /** 한 결과를 게이트에 통과시킨다. 실패하면 depth 0 에서는 사유 피드백으로 1회 재생성(구조적 실패만 — 오답만 걸린 문항은 재생성하지 않고 대기함으로 보낸다). */
  const gate = async (g: GeneratedProblem, depth: number): Promise<GateOutcome> => {
    let stimulus = g.stimulus ?? g.passage;
    let question = g.question ?? null;
    let text = composeProblemText(stimulus, question);
    let usedCorrection = depth > 0;
    // 어려움 문항은 오답 기준이 엄격해 한 번의 보완으로 부족한 경우가 많다 — 재생성을 2회까지 허용한다.
    const maxDepth = params.difficulty === "hard" ? 2 : 1;
    const fail = async (stage: Failure["stage"], reason: string): Promise<GateOutcome> => {
      if (depth < maxDepth) {
        stats.regenerated += 1;
        countCall();
        try {
          const revised = await timed("regenerate", () => regenerateProblemCore({
            sectionTitle: params.topic?.trim() || params.skillType, subjectName: params.subjectName, skillType: params.skillType,
            difficulty: params.difficulty, format: params.format, current: { ...g, passage: text },
            skillCode,
            feedback: `검증에 걸렸습니다: ${reason}. 이 사유가 해소되도록 지문·자료·질문·선택지·정답·해설을 서로 맞게 다시 쓰세요. 자료(figure)는 지문이 부르는 이름·값과 정확히 같아야 하고 정답이 드러나면 안 됩니다. 오답은 지문·자료의 일부를 맞게 반영하되 핵심 관계 하나를 놓친 것이어야 합니다.`,
          }));
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
    const contractInputOf = () => ({ skillCode, examSystem: params.examSystem ?? null, format: params.format, stimulus, question, options: g.options ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null, statements: g.statements ?? null, explanation: g.explanation, figure: g.figure ?? null, structuredTag: (isGrammarStructureSkill(skillCode) ? g.evidenceTarget ?? null : undefined) });
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
        usedCorrection = true;
        countCall();
        try {
          const repaired = await timed("contractRepair", () => repairFieldsCore({
            skillType: params.skillType, subjectName: params.subjectName, difficulty: params.difficulty, format: params.format,
            passage: stimulus, question: question ?? "", options: g.options ?? null, correctIndex: g.correctIndex ?? null, statements: g.statements ?? null, explanation: g.explanation,
            issues: contract.issues.map((i) => i.message),
          }));
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

    // 2.4) 근거 모델(2026-09-17, 5개 R&W 세부 기술 전용) — evidence_span이 실제 지문 문자열인지 결정적으로
    // 검사한다. AI 자기 보고를 신뢰하지 않는다("Math AI는 진실값을 결정하지 않는다"의 R&W 대응).
    // 이 게이트는 사람이 초안을 보기 **전**(생성 수락 단계)에서 돈다 — 실패하면 fail()이 정한 상한 안에서
    // 사유를 피드백으로 넘겨 재생성한다(Math 컴파일러의 checkContent/checkFigure 재시도-예산 패턴과 동일).
    if (isEvidenceModelSkill(skillCode)) {
      const sourceTexts =
        skillCode === "cross_text_connections"
          ? (() => {
              const parsed = parseRwStimulus(stimulus);
              const bodies = parsed.blocks.filter((b): b is { kind: "text"; title: string; body: string } => b.kind === "text").map((b) => b.body);
              return bodies.length ? bodies : [stimulus];
            })()
          : [stimulus];
      const distractorCount = params.format === "mc" && g.options ? Math.max(0, g.options.length - 1) : 0;
      const evCheck = checkEvidenceModelFields(
        skillCode,
        { target: g.evidenceTarget ?? null, evidenceSpan: g.evidenceSpan ?? null, answerRationale: g.answerRationale ?? null, distractorErrorTypes: g.distractorErrorTypes ?? null },
        sourceTexts,
        distractorCount,
        question
      );
      if (!evCheck.ok) return fail("contract", evCheck.reason);
    }

    // 2.4b) 문법 규칙 모델(boundaries/form_structure_sense, 2026-09-17) — 같은 4개 컬럼을 재사용해
    // grammar_rule/distractor_error_types를 결정적으로 검사한다(정답에는 결함 없음, 오답 중 하나는
    // target과 같은 결함, taxonomy가 스킬마다 겹치지 않음).
    if (isGrammarStructureSkill(skillCode) && params.format === "mc" && g.options && g.correctIndex !== null) {
      const opts = g.options;
      const correctOpt = opts[g.correctIndex] ?? "";
      const distractors = opts.filter((_, i) => i !== g.correctIndex);
      const gsCheck = checkGrammarStructureFields(
        skillCode,
        { grammarRule: g.evidenceTarget ?? null, distractorErrorTypes: g.distractorErrorTypes ?? null },
        correctOpt,
        distractors
      );
      if (!gsCheck.ok) return fail("contract", gsCheck.reason);
    }

    // 2.4c) 정량 근거 모델(command_of_evidence_quant, 2026-09-17) — 정답·오답의 수치를 figure 자료와
    // 직접 대조한다(AI가 "이 값을 표에서 읽었다"고 자기보고하는 것을 신뢰하지 않는다).
    if (isQuantEvidenceSkill(skillCode) && params.format === "mc" && g.options && g.correctIndex !== null) {
      const opts = g.options;
      const correctOpt = opts[g.correctIndex] ?? "";
      const distractors = opts.filter((_, i) => i !== g.correctIndex);
      const qeCheck = checkQuantEvidenceFields(
        skillCode,
        { operation: g.evidenceTarget ?? null, answerRationale: g.answerRationale ?? null, distractorErrorTypes: g.distractorErrorTypes ?? null },
        g.figure ?? null,
        correctOpt,
        distractors
      );
      if (!qeCheck.ok) return fail("contract", qeCheck.reason);
    }

    // 2.4d) 전환어 논리 관계 모델(transitions, 2026-09-17) — checkTransitionParallelism(표면 형태)의
    // 다음 층: 정답·오답이 신호하는 논리 관계가 실제 단어 뜻과 일치하는지 카테고리→단어 매핑으로 대조한다.
    if (isTransitionsSkill(skillCode) && params.format === "mc" && g.options && g.correctIndex !== null) {
      const opts = g.options;
      const correctOpt = opts[g.correctIndex] ?? "";
      const distractors = opts.filter((_, i) => i !== g.correctIndex);
      const trCheck = checkTransitionRelationshipFields(
        skillCode,
        { relationshipType: g.evidenceTarget ?? null, distractorRelationshipTypes: g.distractorErrorTypes ?? null },
        correctOpt,
        distractors
      );
      if (!trCheck.ok) return fail("contract", trCheck.reason);
    }

    // 2.4e) 자료 종합 모델(rhetorical_synthesis, 2026-09-17) — 정답의 핵심 내용이 notes에서 실제로
    // 따라 나오는지, 오답들이 서로 다른 방식으로 학생의 목표를 놓쳤는지 결정적으로 검사한다.
    if (isRhetoricalSynthesisSkill(skillCode) && params.format === "mc" && g.options && g.correctIndex !== null) {
      const opts = g.options;
      const correctOpt = opts[g.correctIndex] ?? "";
      const distractors = opts.filter((_, i) => i !== g.correctIndex);
      const notes = parseRwStimulus(stimulus).notes?.items ?? [];
      const rsCheck = checkRhetoricalSynthesisFields(
        skillCode,
        { target: g.evidenceTarget ?? null, answerRationale: g.answerRationale ?? null, distractorErrorTypes: g.distractorErrorTypes ?? null },
        notes,
        correctOpt,
        distractors
      );
      if (!rsCheck.ok) return fail("contract", rsCheck.reason);
    }

    // 2.4f) 글의 구조·기능 모델(text_structure_purpose, 2026-09-17) — 질문이 가리키는 구간이 실제
    // 지문에 있는지, 정답·오답이 서로 다른 수사적 역할을 태그하는지 결정적으로 검사한다.
    if (isTextStructureSkill(skillCode) && params.format === "mc" && g.options && g.correctIndex !== null) {
      const opts = g.options;
      const distractorCount = Math.max(0, opts.length - 1);
      const tsCheck = checkTextStructureFields(
        skillCode,
        { target: g.evidenceTarget ?? null, evidenceSpan: g.evidenceSpan ?? null, answerRationale: g.answerRationale ?? null, distractorErrorTypes: g.distractorErrorTypes ?? null },
        stimulus,
        distractorCount
      );
      if (!tsCheck.ok) return fail("contract", tsCheck.reason);
    }

    // 2.5) 정답 자리 vs 해설 대조(2026-09-15 제품 오너 확인 — 해설은 맞는데 정답 표시만 틀린 사례 발견).
    // 해설이 실제로 결론 내리는 선택지로 정답 자리를 맞춘다("해설을 다시 반영하는 구조").
    if (params.format === "mc" && g.options && g.correctIndex !== null && g.explanation?.trim()) {
      countCall();
      const optionsForCheck = g.options;
      const explanationForCheck = g.explanation;
      try {
        const resolved = await timed("answerExplanationCheck", () => resolveAnswerFromExplanationCore({
          stimulus: text, question: question ?? "", options: optionsForCheck, explanation: explanationForCheck,
        }));
        // 2026-09-15 제품 오너 — 해설이 선택지 중 어느 것도 뒷받침하지 못하면(정답이 선택지에 아예 없을
        // 수 있다는 뜻) 관리자에게 넘기지 않는다 — 구조적 실패로 전체 재생성한다.
        if (!resolved.ok) return fail("contract", "정답-해설 대조: 해설이 어느 선택지도 명확히 뒷받침하지 않습니다(정답이 선택지에 없을 수 있음).");
        if (resolved.concludedIndex !== g.correctIndex) {
          // 2026-09-16(코드 검토 C, Math 한정) — 해설이 추론한 답을 따라 정답 키를 자동으로 바꾸지 않는다.
          // Math는 정답이 계산으로 결정돼야 하므로, 해설과 지정 정답이 어긋나면 어느 쪽이 맞는지 이 자리에서
          // 판단하지 않고 구조적 실패로 처리해 전체를 다시 만든다(R&W는 기존 동작 그대로 유지).
          if (isMathSystem) {
            return fail(
              "contract",
              `정답-해설 불일치: 해설은 ${String.fromCharCode(65 + resolved.concludedIndex)}를 뒷받침하지만 지정 정답은 ${String.fromCharCode(65 + g.correctIndex)}입니다(Math는 정답을 자동으로 바꾸지 않습니다).`
            );
          }
          if (resolved.confidence === "high") {
            stats.answerExplanationFixes += 1;
            usedCorrection = true;
            g.correctIndex = resolved.concludedIndex;
            g.explanation = resolved.cleanExplanation;
            contract = checkQualityContract(contractInputOf());
            if (!contract.ok) return fail("contract", `정답을 해설에 맞춰 고친 뒤에도 계약 실패: ${contract.issues.map((i) => i.message).slice(0, 2).join(" / ")}`);
          }
        }
      } catch (e) {
        console.error("[pipeline] 정답-해설 대조 오류:", e instanceof Error ? e.message : e);
      }
    }

    // 3) 독립 품질 검사.
    const runReview = () => { countCall(); return timed("review", () => reviewProblemIndependently({
      skillLabel: label, examSystem: params.examSystem ?? null, format: params.format, stimulus, question: question ?? "", options: g.options ?? null,
      statements: g.statements ?? null, figure: g.figure ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null, requestedDifficulty: params.difficulty,
      design: g.design ?? null,
    })); };
    let review: IndependentReview | null = null;
    let secondReviewDisagreedFirst = false;
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
      // 2026-09-16(코드 검토 B, Math 한정) — 독립 검사가 예외로 실행되지 못하면(판정 불가) 그 사실을
      // needsReview 플래그로만 남기고 통과시키던 경로를 막는다. 필수 검사가 안 돌았으면 통과가 아니다.
      // R&W는 기존 승인된 동작(플래그만 남기고 통과)을 그대로 유지한다.
      if (isMathSystem && !review) {
        return fail("review", "독립 검사를 실행하지 못했습니다(판정 불가 — Math는 필수 검사이므로 통과시키지 않습니다).");
      }
      if (review) {
        let issues = classifyReviewIssues(review, params.difficulty, params.format);
        // 오답 품질**만** 걸렸으면(정답·난이도·기타 지적은 문제없음) 문항 전체를 다시 만들지 않고 자리별로 고쳐 재검사한다
        // (2026-09-15 제품 오너 재지시: 한 번의 호출에서 네 오답을 통째로 고치지 않는다 — 실패한 선택지 하나당
        //  구조화된 계획을 세운 뒤 그 자리 하나만 생성하는 별도 호출을 보내며, 상한은 자리당 최대 두 번이다).
        if (issues.reasons.length && !issues.hasStructuralIssue && issues.distractorTargets.length && params.format === "mc" && g.options && g.correctIndex !== null) {
          usedCorrection = true;
          // 자리마다 독립적인 수정이므로 병렬로 시도한다(원본 선택지 스냅샷 기준 — 서로의 새 값과는 겹치지 않는지 아래서 별도 확인).
          const originalOptions = [...g.options!];
          const fixOne = async (target: { index: number; reason: string }) => {
            const attemptsAvoid: string[] = [];
            for (let attempt = 0; attempt < 2; attempt += 1) {
              stats.distractorRepairs += 1;
              countCall();
              try {
                const repaired = await repairOneDistractorCore({
                  skillType: params.skillType, subjectName: params.subjectName, difficulty: params.difficulty, stimulus: text, question: question ?? "",
                  options: originalOptions, correctIndex: g.correctIndex!, explanation: g.explanation, index: target.index, reason: target.reason, avoid: attemptsAvoid,
                });
                if (repaired.ok) return { index: target.index, text: repaired.text };
                console.error("[pipeline] 오답 보정 실패 사유:", target.index, attempt, repaired.error);
                attemptsAvoid.push(repaired.error);
              } catch (e) {
                console.error("[pipeline] 오답 부분 수정 오류:", target.index, e instanceof Error ? e.message : e);
                return null;
              }
            }
            return null;
          };
          const fixed = await Promise.all(issues.distractorTargets.map(fixOne));
          const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
          const seen = new Set<string>();
          for (const f of fixed) {
            if (!f) continue;
            const key = normalize(f.text);
            if (seen.has(key)) continue; // 병렬로 고친 두 자리가 서로 겹치면 뒤엣것은 버리고 다음 재검사에서 다시 지적되게 둔다.
            seen.add(key);
            g.options![f.index] = f.text;
            stats.distractorRepairsResolved += 1;
          }
          // 2026-09-16(코드 검토 G) — 오답 자리를 바꿨으면 그 변경이 반영된 최종 객체 전체에 값싼 결정적
          // 검사(계약)를 다시 돌린다. 독립 검사 재실행만으로는 렌더링·수식·선택지 형식 같은 계약 위반을
          // 놓칠 수 있다. Math는 실패 시 구조적으로 처리해 전체를 다시 만든다(R&W는 대기함 판단으로 이어감).
          contract = checkQualityContract(contractInputOf());
          if (!contract.ok) {
            if (isMathSystem) return fail("contract", `오답 수정 후 계약 실패: ${contract.issues.map((i) => i.message).slice(0, 2).join(" / ")}`);
          }
          countCall();
          const reReview = await runReview();
          review = reReview;
          issues = classifyReviewIssues(reReview, params.difficulty, params.format);
        }
        // 2026-09-17(제품 오너 지시) — "AI 생성 문항의 정상 결과는 자동 검사를
        // 모두 통과한 완성 후보뿐입니다." 예전에는 오답 지적이 1~2개뿐이면
        // '오답 보강 대기'로 살려 관리자가 고치게 했다 — 그 경로를 없앤다. 남은
        // 지적이 무엇이든 그대로 실패로 집계하고 다른 후보로 대체한다.
        if (issues.reasons.length) {
          return fail("review", issues.reasons.join(" / "));
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
    // 2026-09-17(UAT 지적) — 판정이 난 즉시(이 함수를 호출한 배치의 다른 문항이
    // 아직 게이트 중이어도 기다리지 않고) 기록·저장한다. 예전에는 이 outcome을
    // 그대로 반환만 하고, 호출자가 배치 전체(Promise.all)가 끝난 뒤에야 한꺼번에
    // record()를 돌렸다 — 그러면 배치 안의 느린 문항 하나가 서버 함수 시간
    // 제한에 걸려 죽을 때, 이미 통과해 있던 다른 문항까지 전부 저장 못 하고
    // 사라졌다.
    if (!usedCorrection) stats.firstPassCount += 1;
    const outcome: GateOutcome = { kind: "accepted", quality, problem: g };
    await record(outcome);
    return outcome;
  };

  // 어려움은 오답·정답 기준이 엄격해 통과율이 낮다 — 요청보다 넉넉히 만들어 통과분만 채택한다(2026-09-15 제품 오너: "생성 수가 적으면 안 된다").
  const initialCount = params.difficulty === "hard" ? Math.min(10, requested + Math.min(2, requested)) : requested;
  const record = async (outcome: GateOutcome) => {
    stats.candidatesEvaluated += 1;
    // 2026-09-16(코드 검토 A) — outcome.problem 은 재생성·부분 수정을 거친 뒤 실제로 검사한 최종 객체다.
    // 원본 후보(g)를 다시 쓰면 "검사한 문항과 저장되는 문항이 다를 수 있다"는 결함이 재발한다.
    if (outcome.kind === "accepted") {
      if (accepted.length >= requested) return; // 이미 채택 목표를 채웠으면 더 저장하지 않는다.
      const item: Accepted = { problem: outcome.problem, quality: outcome.quality };
      accepted.push(item);
      stats.accepted += 1;
      // 2026-09-17(UAT 지적) — 배치 전체가 나중에 시간 제한에 걸려 죽어도, 여기까지의
      // 실측 소요는 Vercel 함수 로그에 이미 남아 있다("몇 번째 문항이 몇 초째에
      // 끝났는지"로 어디서 시간이 새는지 특정할 수 있다).
      console.log(JSON.stringify({ event: "problem_generation_item_accepted", elapsedMs: Date.now() - pipelineStart, acceptedSoFar: stats.accepted }));
      await params.onAccepted?.(item);
    }
  };

  // 2026-09-15 제품 오너 지시 — 어려움 + 자료 필요 수학은 4단계(자료+문항 → 정답 확정 → 오답 → 최종 검수)로
  // 만든다. 정답을 생성 단계가 지어내지 않고 별도로 확정해 "정답이 선택지에 없다/틀렸다" 류를 구조적으로 줄인다.
  // 최종 검수 통과분은 기존 gate() 로 넘겨 독립 검사·오답 보강·대기 판정을 그대로 재사용한다.
  //
  // **2026-09-15 실측 후 잠정 비활성화**: 표본 5개로 실제 돌려보니 0/5 통과(문항당 평균 295회 호출) —
  // (1) 1단계 자료 스키마에 type 필드가 자꾸 빠짐 (2) 2단계 정답이 "k = 6"처럼 변수명을 붙여 계약의
  // 선택지 표기 규칙과 계속 충돌 (3) 두 직선 교점 검사(system_solution_mismatch)가 "교점을 묻지 않는"
  // 문항(예: 기울기 k를 구하는데 비교용 직선이 하나 더 있는 경우)에도 오탐. 셋 다 고쳐질 때까지 이 경로를
  // 켜지 않는다 — 지금 있는 기존 경로(오늘 낮에 44~70%까지 올린)가 더 낫다. 코드는 남겨 다음에 고친다.
  const isRiskyMath = false && (
    (params.examSystem ?? "").startsWith("sat_math") && params.difficulty === "hard" && params.format === "mc" &&
    (params.figurePolicy === "require_plane" || params.figurePolicy === "require_geometry")
  );

  const attemptStagedOne = async (): Promise<{ problem: GeneratedProblem; outcome: GateOutcome } | null> => {
    const need = judgeMaterialNeed({ examSystem: params.examSystem ?? null, skillCode, text: "" });
    const figureKind = (pickFigureKind(need, "", skillCode, params.figurePolicy) ?? "plane") as import("./math-staged").MathFigureKind;
    const { generateStagedHardMathItem } = await import("./math-staged");
    for (let stemRetry = 0; stemRetry < 2; stemRetry++) {
      let staged;
      try {
        staged = await generateStagedHardMathItem({
          subjectName: params.subjectName, skillType: params.skillType, skillCode, examSystem: params.examSystem ?? null,
          difficulty: params.difficulty, figureKind, topic: params.topic, onModelCall: countCall,
        });
      } catch (e) {
        failures.push({ skillCode, stage: "generate", reason: `단계형 생성 오류: ${e instanceof Error ? e.message : "알 수 없음"}`, resolved: false, snippet: "" });
        continue;
      }
      if (!staged.ok) {
        failures.push({ skillCode, stage: "generate", reason: staged.failures.map((f) => `[${f.stage}] ${f.reason}`).slice(0, 3).join(" / "), resolved: false, snippet: "" });
        continue;
      }
      stats.generated += 1;
      const g: GeneratedProblem = {
        format: "mc",
        figure: staged.item.figure,
        passage: composeProblemText(staged.item.stimulus, staged.item.question),
        stimulus: staged.item.stimulus,
        question: staged.item.question,
        needsFigure: false,
        options: staged.item.options,
        correctIndex: staged.item.correctIndex,
        answers: null,
        statements: null,
        explanation: staged.item.explanation,
        difficulty: params.difficulty,
        distractorRationales: [],
        difficultyRationale: "",
        design: (staged.item.design || null) as unknown as GeneratedProblem["design"],
      };
      return { problem: g, outcome: await gate(g, 0) };
    }
    return null;
  };

  // record()는 이제 gate()/attemptStagedOne 안에서 각 문항이 판정 나는 즉시 호출된다
  // (위 참고) — 여기서는 결과를 기다리기만 한다. 두 번 기록하지 않도록 record()를
  // 다시 호출하지 않는다.
  // 2026-09-17(제품 오너 지시) — "상한 안에 N개를 채우지 못하면 즉시 종료"한다.
  // 예전에는 고정 2라운드까지 무조건 재시도했다 — 후보가 계속 실패하면(예: 오답
  // 품질) 라운드마다 시간만 쓰고 300초 제한까지 실행됐다. 이제 후보 수·모델 호출
  // 수·벽시계 시간 중 하나라도 상한을 넘기면 그 자리에서 멈춘다.
  if (isRiskyMath) {
    await mapWithConcurrency(Array.from({ length: initialCount }), GATE_CONCURRENCY, attemptStagedOne);
    while (stats.accepted < requested) {
      const exceeded = capExceeded();
      if (exceeded) { stats.stoppedReason = exceeded; break; }
      const refillCount = Math.min(10, requested - stats.accepted + 1, maxCandidates - stats.candidatesEvaluated);
      if (refillCount <= 0) { stats.stoppedReason = "candidate_cap"; break; }
      await mapWithConcurrency(Array.from({ length: refillCount }), GATE_CONCURRENCY, attemptStagedOne);
      stats.refilled += refillCount;
    }
  } else {
    const generated = await generate(initialCount);
    stats.generated += generated.length;
    await mapWithConcurrency(generated, GATE_CONCURRENCY, (g) => gate(g, 0));

    // 부족하면 상한 안에서 계속 채운다(각 청크가 개별적으로 빈 응답을 견디므로 재시도가 안전하다). 라운드 안에서는 병렬 처리.
    while (stats.accepted < requested) {
      const exceeded = capExceeded();
      if (exceeded) { stats.stoppedReason = exceeded; break; }
      const refillCount = Math.min(10, requested - stats.accepted + (params.difficulty === "hard" ? 1 : 0), maxCandidates - stats.candidatesEvaluated);
      if (refillCount <= 0) { stats.stoppedReason = "candidate_cap"; break; }
      const refill = await generate(refillCount);
      stats.generated += refill.length;
      stats.refilled += refill.length;
      await mapWithConcurrency(refill, GATE_CONCURRENCY, (g) => gate(g, 0));
    }
  }
  // 오버샘플링·병렬 처리로 요청보다 많이 통과할 수 있다 — 초과분은 잘라내되(요청 수만 채택), 후보 수엔 그대로 반영한다.
  if (accepted.length > requested) accepted.length = requested;
  stats.accepted = accepted.length;
  stats.shortfall = requested - stats.accepted;
  if (stats.shortfall === 0) stats.stoppedReason = "target_met";
  if (stats.accepted < requested) stats.underReturned.push({ requested, returned: stats.accepted, reason: "게이트 통과분이 요청 수 미달" });
  // 평균 모델 호출 수 — 생성·자료·재생성·부분수정·독립검사를 통틀어, 실제로 통과한 문항 하나당.
  const totalOutputs = stats.accepted;
  const avgModelCalls = totalOutputs > 0 ? Math.round((stats.modelCalls / totalOutputs) * 100) / 100 : stats.modelCalls;
  stats.timeMs.total = Date.now() - pipelineStart;
  const finalStats = { ...stats, modelCalls: avgModelCalls };
  // 2026-09-17(UAT 지적 — "목표 60초/문항인데 실제는 훨씬 오래 걸린다") — 성공 여부와
  // 무관하게 항상 단계별 소요를 남긴다. 실패로 끝나 로그를 못 보는 경우를 없앤다
  // (Vercel 함수 로그에서 이 한 줄로 실제 병목 단계를 바로 특정할 수 있다).
  console.log(JSON.stringify({ event: "problem_generation_pipeline_timing", requested, accepted: stats.accepted, shortfall: stats.shortfall, stoppedReason: stats.stoppedReason, timeMs: stats.timeMs }));
  return { accepted, failures, stats: finalStats };
}
