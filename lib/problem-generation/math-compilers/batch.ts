// 2026-09-17(제품 오너 지시) — 계산형 Math 컴파일러 공용 배치 실행기.
//
// 요청 수가 1~9여도 내부 생성·검증 단위는 최소 10문항이다. 동일 유형·난이도·답안
// 형식으로 후보군을 만들고(여기서는 순수 계산이라 사실상 즉시 끝난다), 각 후보를
// 독립적으로 검증해 통과한 것만 채택한다. `held`(오답 보강 대기)는 없다 — 검증에
// 걸리면 그냥 실패로 집계하고 다른 후보로 대체한다. 상한(최대 후보 수·문항당 최대
// "호출" 수·배치 전체 최대 시간)을 넘기면 그 자리에서 멈추고 부족 수와 사유를 그대로
// 반환한다.
//
// 기존 범용 파이프라인(pipeline.ts)과 결과 타입(PipelineResult)을 그대로 맞춰서,
// 호출부(generateBankProblemsAction)가 어느 경로로 왔는지 몰라도 되게 한다.
import type { Accepted, Failure, GeneratedProblem, PipelineResult } from "../pipeline";
import type { QualityRecord } from "../review";
import { checkFigure } from "@/lib/problem-figures/check";
import { checkContent } from "@/lib/problem-content-check";
import {
  generateLinearTwoVarModel,
  renderLinearTwoVarProblem,
  validateLinearTwoVarModel,
  type LinearTwoVarDifficulty,
} from "./linear-two-variables";
import {
  generateLinearInequalityModel,
  renderLinearInequalityProblem,
  validateLinearInequalityModel,
} from "./linear-inequalities";
import {
  generateLinearOneVarModel,
  renderLinearOneVarProblem,
  validateLinearOneVarModel,
} from "./linear-equations-one-var";
import {
  generateLinearFunctionModel,
  renderLinearFunctionProblem,
  validateLinearFunctionModel,
} from "./linear-functions";
import {
  generateEquivalentExpressionsModel,
  renderEquivalentExpressionsProblem,
  validateEquivalentExpressionsModel,
} from "./equivalent-expressions";
import {
  generateNonlinearEqModel,
  renderNonlinearEqProblem,
  validateNonlinearEqModel,
} from "./nonlinear-equations-systems";
import {
  generateNonlinearFnModel,
  renderNonlinearFnProblem,
  validateNonlinearFnModel,
} from "./nonlinear-functions";
import {
  generateRatiosRatesModel,
  renderRatiosRatesProblem,
  validateRatiosRatesModel,
} from "./ratios-rates";
import {
  generatePercentagesModel,
  renderPercentagesProblem,
  validatePercentagesModel,
} from "./percentages";
import {
  generateOneVarDataModel,
  renderOneVarDataProblem,
  validateOneVarDataModel,
} from "./one-variable-data";
import {
  generateTwoVarDataModel,
  renderTwoVarDataProblem,
  validateTwoVarDataModel,
} from "./two-variable-data";
import {
  generateProbabilityModel,
  renderProbabilityProblem,
  validateProbabilityModel,
} from "./probability";
import {
  generateInferenceModel,
  renderInferenceProblem,
  validateInferenceModel,
} from "./inference-from-sample";
import {
  generateEvalClaimsModel,
  renderEvalClaimsProblem,
  validateEvalClaimsModel,
} from "./evaluating-statistical-claims";
import {
  generateAreaVolumeModel,
  renderAreaVolumeProblem,
  validateAreaVolumeModel,
} from "./area-volume";
import {
  generateLinesAnglesModel,
  renderLinesAnglesProblem,
  validateLinesAnglesModel,
} from "./lines-angles-triangles";
import {
  generateRightTriModel,
  renderRightTriProblem,
  validateRightTriModel,
} from "./right-triangles-trigonometry";
import {
  generateCirclesModel,
  renderCirclesProblem,
  validateCirclesModel,
} from "./circles";

// 2026-09-17(제품 오너 지시) — "같은 일차식 공통 엔진으로 확장". systems_linear(두
// 일차방정식의 연립)은 수학적으로 linear_equations_two_var 컴파일러가 이미 계산하는
// "두 직선의 교점·기울기·절편·해의 개수"와 같은 문제다 — 별도 모델을 새로 만들지 않고
// 같은 계산 함수를 그대로 쓴다(관리자가 고른 skillCode만 문제에 다르게 태깅된다).
// linear_equations_one_var·linear_functions는 식·함수 엔진(2단계 A)의 세부 기술 —
// 질문 대상(한 변수 방정식 / 함수값·기울기)과 오류 경로가 서로 달라 별도 모델로 둔다.
export type MathCompilerSkill =
  | "linear_equations_two_var"
  | "systems_linear"
  | "linear_inequalities"
  | "linear_equations_one_var"
  | "linear_functions"
  | "equivalent_expressions"
  | "nonlinear_equations_systems"
  | "nonlinear_functions"
  | "ratios_rates_units"
  | "percentages"
  | "one_variable_data"
  | "two_variable_data"
  | "probability"
  | "inference_margin_error"
  | "evaluating_statistical_claims"
  | "area_volume"
  | "lines_angles_triangles"
  | "right_triangles_trigonometry"
  | "circles";

const MIN_BATCH = 10;
const MAX_CANDIDATE_MULTIPLIER: Record<LinearTwoVarDifficulty, number> = { easy: 1.5, medium: 1.5, hard: 2.5 };
/** 순수 계산이라 실제 "호출"은 없지만, 무한 루프 방지용 시도 횟수 상한은 그대로 둔다. */
const MAX_ATTEMPTS_PER_ITEM = 20;
const MAX_WALL_CLOCK_MS = 60_000;

export type MathCompilerBatchParams = {
  skillCode: MathCompilerSkill;
  difficulty: LinearTwoVarDifficulty;
  count: number;
  onAccepted?: (item: Accepted) => Promise<void>;
};

/**
 * 2026-09-17(제품 오너 지시) — "7~11ms는 컴파일러 계산·검증 구간일 뿐이고, 관리자
 * 요청·DB 저장·렌더링·목록 갱신을 포함한 전체 제품 경로 시간과 혼용하면 안 된다."
 * 이 배치 실행기가 실제로 재는 것은 compileMs(모델 계산+렌더링 데이터 조립)와
 * renderCheckMs(표준 렌더링 검증기 checkFigure) 둘뿐이다. DB 저장·화면 렌더는
 * 호출자(generateBankProblemsAction, 그리고 그 위의 관리자 요청~응답)가 별도로 잰다.
 */
export type MathCompilerBatchTiming = { compileMs: number; renderCheckMs: number; totalMs: number };

function buildQuality(reasons: string[]): QualityRecord {
  return {
    contract: { ok: true, issues: [] },
    estimatedDifficulty: "medium",
    requestedDifficulty: "medium",
    difficultyReasons: [],
    distractors: [],
    independentReview: { pickedIndex: null, pickedAnswer: null, agrees: true, confidence: "high", flags: [] },
    needsReview: false,
    needsReviewReasons: reasons,
    calibrated: false,
    reviewedAt: new Date().toISOString(),
  };
}

type AttemptTiming = { compileMs: number; renderCheckMs: number };

/** 계산형 컴파일러 한 문항 시도 — 모델 계산 → 결정적 검사 → 표준 렌더링 검증기(checkFigure).
 * 셋 다 통과해야 채택한다. 렌더링 검증까지 여기서 실제로 돌려, 라벨 겹침 같은 결함이
 * 관리자 화면에 나가기 전에 걸리게 한다(2026-09-17 실측으로 발견한 결함 2건이 바로 이 검사로 잡힌다). */
function attemptOne(
  skillCode: MathCompilerSkill,
  difficulty: LinearTwoVarDifficulty,
  timing: AttemptTiming
): { ok: true; problem: GeneratedProblem; quality: QualityRecord } | { ok: false; reason: string } {
  const t0 = Date.now();
  // 2026-09-17 — 컴파일러마다 figure 타입이 다르다(직선 그래프/삼각형/원/입체 등).
  // checkFigure는 어차피 unknown을 받으므로 여기서는 공통 형태로만 좁혀 둔다.
  let compiled: {
    passage: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    explanationEn: string;
    figure: unknown;
    distractorRationales: ReturnType<typeof renderLinearTwoVarProblem>["distractorRationales"];
  };
  if (skillCode === "linear_equations_two_var" || skillCode === "systems_linear") {
    const model = generateLinearTwoVarModel({ difficulty });
    const check = validateLinearTwoVarModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearTwoVarProblem(model);
  } else if (skillCode === "linear_inequalities") {
    const model = generateLinearInequalityModel({ difficulty });
    const check = validateLinearInequalityModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearInequalityProblem(model);
  } else if (skillCode === "linear_equations_one_var") {
    const model = generateLinearOneVarModel({ difficulty });
    const check = validateLinearOneVarModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearOneVarProblem(model);
  } else if (skillCode === "linear_functions") {
    const model = generateLinearFunctionModel({ difficulty });
    const check = validateLinearFunctionModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearFunctionProblem(model);
  } else if (skillCode === "equivalent_expressions") {
    const model = generateEquivalentExpressionsModel({ difficulty });
    const check = validateEquivalentExpressionsModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderEquivalentExpressionsProblem(model);
  } else if (skillCode === "nonlinear_equations_systems") {
    const model = generateNonlinearEqModel({ difficulty });
    const check = validateNonlinearEqModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderNonlinearEqProblem(model);
  } else if (skillCode === "nonlinear_functions") {
    const model = generateNonlinearFnModel({ difficulty });
    const check = validateNonlinearFnModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderNonlinearFnProblem(model);
  } else if (skillCode === "ratios_rates_units") {
    const model = generateRatiosRatesModel({ difficulty });
    const check = validateRatiosRatesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderRatiosRatesProblem(model);
  } else if (skillCode === "percentages") {
    const model = generatePercentagesModel({ difficulty });
    const check = validatePercentagesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderPercentagesProblem(model);
  } else if (skillCode === "one_variable_data") {
    const model = generateOneVarDataModel({ difficulty });
    const check = validateOneVarDataModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderOneVarDataProblem(model);
  } else if (skillCode === "two_variable_data") {
    const model = generateTwoVarDataModel({ difficulty });
    const check = validateTwoVarDataModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderTwoVarDataProblem(model);
  } else if (skillCode === "probability") {
    const model = generateProbabilityModel({ difficulty });
    const check = validateProbabilityModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderProbabilityProblem(model);
  } else if (skillCode === "inference_margin_error") {
    const model = generateInferenceModel({ difficulty });
    const check = validateInferenceModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderInferenceProblem(model);
  } else if (skillCode === "evaluating_statistical_claims") {
    const model = generateEvalClaimsModel({ difficulty });
    const check = validateEvalClaimsModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderEvalClaimsProblem(model);
  } else if (skillCode === "area_volume") {
    const model = generateAreaVolumeModel({ difficulty });
    const check = validateAreaVolumeModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderAreaVolumeProblem(model);
  } else if (skillCode === "lines_angles_triangles") {
    const model = generateLinesAnglesModel({ difficulty });
    const check = validateLinesAnglesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinesAnglesProblem(model);
  } else if (skillCode === "right_triangles_trigonometry") {
    const model = generateRightTriModel({ difficulty });
    const check = validateRightTriModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderRightTriProblem(model);
  } else if (skillCode === "circles") {
    const model = generateCirclesModel({ difficulty });
    const check = validateCirclesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderCirclesProblem(model);
  } else {
    return { ok: false, reason: `지원하지 않는 계산형 유형: ${skillCode}` };
  }
  timing.compileMs += Date.now() - t0;

  const passageForCheck = compiled.passage + "\n\n" + compiled.question;
  const t1 = Date.now();
  const renderCheck = checkFigure(compiled.figure, passageForCheck, compiled.options, compiled.correctIndex);
  timing.renderCheckMs += Date.now() - t1;
  if (!renderCheck.ok) {
    return { ok: false, reason: `렌더링 검증 실패: ${renderCheck.issues.map((i) => i.message).join(" / ")}` };
  }
  // 2026-09-17(실측) — 실제 저장 경로(createDraftVersionAction)가 checkContent로
  // "$…$ 밖의 LaTeX 제어문" 등을 걸러내는데, 컴파일러 자체 검증에는 이 검사가 없어
  // 실제 UI에서만 뒤늦게 거부되는 격차가 있었다. 여기서도 같은 검사를 미리 돌려
  // 저장 시점이 아니라 후보 평가 시점에 실패로 집계되게 한다.
  const contentIssues = checkContent({
    format: "mc", passage: passageForCheck, options: compiled.options, correctIndex: compiled.correctIndex,
    explanation: compiled.explanation, answers: null, statements: null, skillCode, figure: compiled.figure,
  });
  const fatalContent = contentIssues.find((i) => ["math_parse", "math_unclosed", "latex_leak"].includes(i.code));
  if (fatalContent) {
    return { ok: false, reason: `내용 검증 실패: ${fatalContent.message}` };
  }

  const problem: GeneratedProblem = {
    format: "mc",
    figure: compiled.figure,
    passage: passageForCheck,
    stimulus: compiled.passage,
    question: compiled.question,
    needsFigure: false,
    options: compiled.options,
    correctIndex: compiled.correctIndex,
    answers: null,
    statements: null,
    explanation: compiled.explanation,
    explanationEn: compiled.explanationEn,
    difficulty,
    distractorRationales: compiled.distractorRationales.map((d) => ({
      index: d.index, plausible_because: d.plausibleBecause, matches: d.matches, why_wrong: d.whyWrong, kind: d.kind,
    })),
    difficultyRationale: "",
    design: null,
  } as unknown as GeneratedProblem;
  return { ok: true, problem, quality: buildQuality([]) };
}

export async function runMathCompilerBatch(
  params: MathCompilerBatchParams
): Promise<PipelineResult & { compilerTiming: MathCompilerBatchTiming }> {
  const start = Date.now();
  const requested = Math.max(1, Math.min(10, params.count));
  const batchTarget = Math.max(MIN_BATCH, requested);
  const maxCandidates = Math.ceil(batchTarget * MAX_CANDIDATE_MULTIPLIER[params.difficulty]);
  const accepted: Accepted[] = [];
  const failures: Failure[] = [];
  let candidatesEvaluated = 0;
  let stoppedReason: PipelineResult["stats"]["stoppedReason"] = "no_more_candidates";
  const timing: AttemptTiming = { compileMs: 0, renderCheckMs: 0 };

  // 2026-09-17 — "생성 실행 단위는 단건이 아니라 최소 10문항 배치"다. 요청 수가
  // 1~9여도 최소 batchTarget(=10)개 후보는 항상 평가한다 — 요청 수를 채웠다고
  // 곧장 멈추지 않는다. 다만 실제로 **저장(onAccepted)**하는 것은 요청 수만큼만이다
  // — 나머지 통과분은 배치 통계에는 반영되지만 반환·저장하지 않는다("요청 수만큼
  // 자동 통과 문항을 반환합니다"). onAccepted(실제 DB 저장)에 걸리는 시간은
  // compileMs/renderCheckMs와 분리해 호출자가 별도로 재게 둔다 — 여기서는 재지 않는다.
  while (candidatesEvaluated < batchTarget || accepted.length < requested) {
    if (candidatesEvaluated >= maxCandidates) { stoppedReason = "candidate_cap"; break; }
    if (Date.now() - start >= MAX_WALL_CLOCK_MS) { stoppedReason = "time_cap"; break; }
    candidatesEvaluated += 1;
    const outcome = attemptOne(params.skillCode, params.difficulty, timing);
    if (!outcome.ok) {
      failures.push({ skillCode: params.skillCode, stage: "review", reason: outcome.reason, resolved: false, snippet: "" });
      continue;
    }
    const item: Accepted = { problem: outcome.problem, quality: outcome.quality };
    accepted.push(item);
    console.log(JSON.stringify({ event: "math_compiler_item_accepted", skillCode: params.skillCode, elapsedMs: Date.now() - start, acceptedSoFar: accepted.length }));
    if (accepted.length <= requested) await params.onAccepted?.(item);
  }
  // 배치 전체 통과 수는 통계로만 남기고, 반환·저장은 요청 수만큼만 자른다.
  if (accepted.length > requested) accepted.length = requested;
  const shortfall = requested - accepted.length;
  if (shortfall === 0 && stoppedReason !== "candidate_cap" && stoppedReason !== "time_cap") stoppedReason = "target_met";

  const totalMs = Date.now() - start;
  const stats: PipelineResult["stats"] = {
    requested, generated: candidatesEvaluated, accepted: accepted.length, regenerated: 0, regenerationResolved: 0,
    refilled: Math.max(0, candidatesEvaluated - batchTarget), distractorRepairs: 0, distractorRepairsResolved: 0,
    fieldRepairs: 0, fieldRepairsResolved: 0, modelCalls: 0, firstPassCount: accepted.length, candidatesEvaluated,
    emptyResponses: [], underReturned: shortfall > 0 ? [{ requested, returned: accepted.length, reason: "결정적 검사 통과분이 요청 수 미달" }] : [],
    answerExplanationFixes: 0, shortfall, stoppedReason,
    // 2026-09-17 — 이 timeMs는 "컴파일러 계산·검증 구간"만이다(범용 AI 파이프라인과
    // 필드 이름을 맞추려고 generate/figure에 각각 compile/renderCheck 시간을 넣었을
    // 뿐, 의미가 다르다는 걸 compilerTiming 필드로 명시적으로 다시 내려준다).
    timeMs: { total: totalMs, generate: timing.compileMs, figure: timing.renderCheckMs, contractRepair: 0, answerExplanationCheck: 0, review: 0, regenerate: 0 },
  };
  const compilerTiming: MathCompilerBatchTiming = { compileMs: timing.compileMs, renderCheckMs: timing.renderCheckMs, totalMs };
  console.log(JSON.stringify({ event: "math_compiler_batch_timing", skillCode: params.skillCode, requested, batchTarget, candidatesEvaluated, accepted: accepted.length, shortfall, stoppedReason, note: "이 시간은 컴파일러 계산·검증 구간만이다 — DB 저장·렌더링·전체 요청 시간 아님", ...compilerTiming }));
  return { accepted, failures, stats, compilerTiming };
}
