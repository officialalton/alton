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
import { findBannedWords, checkTagConsistency } from "@/lib/problem-generation/common-quality-gate";
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
import { sprFromAnswerText } from "./spr-answer";
import { getMathSkillKinds } from "./kind-catalog";
import { applyFigurePolicy, judgeMaterialNeed, materialBlocker } from "@/lib/problem-material-need";

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

// 2026-09-17(제품 오너 지시, SPR 1차 범위) — 이 세트에 있는 유형만 format="spr"
// 요청을 받는다. 목록 밖 유형(예: linear_functions·probability 등)에 spr을 요청하면
// 배치 전체를 즉시 "지원하지 않음"으로 끝낸다(뒤늦게 매 후보마다 실패로 갉아먹지 않음).
// 유형 안에서도 "정답이 문장/그래프 선택인 세부 종류"(예: nonlinear_equations_systems의
// num_real_solutions, two_variable_data의 그래프 선택형)는 별도 분기를 두지 않았다 —
// sprFromAnswerText가 숫자로 파싱되지 않는 정답을 null로 돌려주면 그 후보는 자동으로
// 실패 처리되어 자연히 제외된다(요청한 만큼은 나머지 숫자형 종류에서 재시도로 채운다).
const SPR_ELIGIBLE_SKILLS = new Set<MathCompilerSkill>([
  "linear_equations_one_var",
  "linear_equations_two_var",
  "systems_linear",
  "nonlinear_equations_systems",
  "ratios_rates_units",
  "percentages",
  "one_variable_data",
  "two_variable_data",
  "area_volume",
  "right_triangles_trigonometry",
  "circles",
]);

const MIN_BATCH = 10;
const MAX_CANDIDATE_MULTIPLIER: Record<LinearTwoVarDifficulty, number> = { easy: 1.5, medium: 1.5, hard: 2.5 };
/** 순수 계산이라 실제 "호출"은 없지만, 무한 루프 방지용 시도 횟수 상한은 그대로 둔다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_ATTEMPTS_PER_ITEM = 20;
const MAX_WALL_CLOCK_MS = 60_000;

export type MathCompilerBatchParams = {
  skillCode: MathCompilerSkill;
  difficulty: LinearTwoVarDifficulty;
  count: number;
  /** 2026-09-17(SPR 1차) — "mc"(기본) | "spr". SPR_ELIGIBLE_SKILLS 밖의 유형에 "spr"을
   * 요청하면 후보를 하나도 시도하지 않고 즉시 shortfall=요청 수로 끝낸다. */
  format?: "mc" | "spr";
  /** 2026-09-17 버그 수정 — 관리자가 "새 문제" 패널에서 고른 자료 정책(require_plane 등)이
   * 이전엔 여기까지 전달되지 않아 nonlinear_functions가 "좌표평면 포함"을 골라도 항상
   * 텍스트형으로만 나갔다. 이 배치 실행기가 실제로 구분하는 것은 "plane 그림을 붙이는가"뿐이다. */
  figurePolicy?: string;
  /**
   * 2026-09-18(제품 오너 지시) — 관리자가 "세부 패턴" 드롭다운에서 특정 kind를
   * 골랐을 때 내부 무작위 선택을 건너뛰고 그 kind로만 생성한다(lib/problem-generation/
   * math-compilers/kind-catalog.ts 목록 중 하나). skillCode가 실제로 그 kind를 갖지
   * 않으면(오타·목록 밖 값) 각 컴파일러의 questionKind?/kind? 파라미터가 그 값을
   * 자신의 유니온에 없는 것으로 보고 무시하지 않는다 — 타입 경계를 넘는 문자열은
   * attemptOne에서 그 skillCode가 실제로 아는 kind 목록에 있는지 먼저 확인해서만
   * 넘긴다(모르는 값은 무작위로 폴백, 배치를 실패시키지 않는다).
   */
  kind?: string;
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
  timing: AttemptTiming,
  figurePolicy?: string,
  format: "mc" | "spr" = "mc",
  forceKind?: string
): { ok: true; problem: GeneratedProblem; quality: QualityRecord } | { ok: false; reason: string } {
  if (format === "spr" && !SPR_ELIGIBLE_SKILLS.has(skillCode)) {
    return { ok: false, reason: `${skillCode}: 아직 SPR(그리드 입력)을 지원하지 않는 유형입니다.` };
  }
  // 카탈로그에 없는 값(오타·목록 밖)은 무시하고 무작위 선택으로 폴백한다 — 관리자가
  // 구형 캐시된 값을 보내도 배치 자체는 실패하지 않는다.
  const kind = forceKind && getMathSkillKinds(skillCode).some((k) => k.value === forceKind) ? forceKind : undefined;
  let usedKind: string | null = null;
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
    // 2026-09-24(UAT 지적) — systems_linear의 "그래프 선택지 4개"는 실제 교점이 있는
    // 시스템(one_solution)이어야 그래프 넷을 의미 있게 구분할 수 있다 — kind를
    // intersection_x로 고정해(수치 정답은 버리고 그래프만 쓴다) 항상 그 경로를 타게 한다.
    const wantsFigureChoice = skillCode === "systems_linear" && figurePolicy === "require_figure_choice";
    if (wantsFigureChoice && kind && kind !== "intersection_x") {
      return { ok: false, reason: `선택한 세부 패턴 '${kind}'은 그래프 선택지 4개 자료를 지원하지 않습니다.` };
    }
    const model = generateLinearTwoVarModel({ difficulty, questionKind: (wantsFigureChoice ? "intersection_x" : kind) as Parameters<typeof generateLinearTwoVarModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateLinearTwoVarModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearTwoVarProblem(model, wantsFigureChoice ? { figureMode: "figure_choice" } : undefined);
  } else if (skillCode === "linear_inequalities") {
    const model = generateLinearInequalityModel({ difficulty, questionKind: kind as Parameters<typeof generateLinearInequalityModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateLinearInequalityModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearInequalityProblem(model);
  } else if (skillCode === "linear_equations_one_var") {
    const model = generateLinearOneVarModel({ difficulty, kind: kind as Parameters<typeof generateLinearOneVarModel>[0]["kind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateLinearOneVarModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearOneVarProblem(model);
  } else if (skillCode === "linear_functions") {
    // 2026-09-24(UAT 지적) — require_plane/require_data 를 골라도 실제 자료를 안 그려 늘
    // 텍스트형으로만 나가던 결함. figureMode를 모델 생성·렌더 양쪽에 전달한다.
    const linearFnFigureMode = figurePolicy === "require_plane" ? "plane" : figurePolicy === "require_data" ? "data" : "text";
    const model = generateLinearFunctionModel({ difficulty, questionKind: kind as Parameters<typeof generateLinearFunctionModel>[0]["questionKind"], figureMode: linearFnFigureMode });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateLinearFunctionModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinearFunctionProblem(model, { figureMode: linearFnFigureMode });
  } else if (skillCode === "equivalent_expressions") {
    const model = generateEquivalentExpressionsModel({ difficulty, kind: kind as Parameters<typeof generateEquivalentExpressionsModel>[0]["kind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateEquivalentExpressionsModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderEquivalentExpressionsProblem(model);
  } else if (skillCode === "nonlinear_equations_systems") {
    // 2026-09-24(UAT 지적) — require_plane 은 linear_quadratic_intersection(일차·이차
    // 연립 교점)으로 고정해야 실제로 그릴 좌표평면 그래프가 있다.
    const nonlinearEqFigureMode = figurePolicy === "require_plane" ? "plane" as const : undefined;
    if (nonlinearEqFigureMode && kind && kind !== "linear_quadratic_intersection") {
      return { ok: false, reason: `선택한 세부 패턴 '${kind}'은 좌표평면 자료를 지원하지 않습니다(일차·이차 연립 교점 유형만 가능합니다).` };
    }
    const model = generateNonlinearEqModel({ difficulty, questionKind: (kind ?? undefined) as Parameters<typeof generateNonlinearEqModel>[0]["questionKind"], figureMode: nonlinearEqFigureMode });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateNonlinearEqModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderNonlinearEqProblem(model, { figureMode: nonlinearEqFigureMode });
  } else if (skillCode === "nonlinear_functions") {
    // 그래프 4개 선택은 현재 이차함수의 결정적 그래프 생성기로 만든다.
    // 지수함수 문맥 해석 패턴은 그림 선택지가 아니므로 섞지 않는다.
    if (figurePolicy === "require_figure_choice" && kind && !["evaluate", "vertex_x", "vertex_y"].includes(kind)) {
      return { ok: false, reason: `선택한 세부 패턴 '${kind}'은 그래프/도형 선택지 자료를 지원하지 않습니다.` };
    }
    const model = generateNonlinearFnModel({ difficulty, ...(figurePolicy === "require_figure_choice" ? { family: "quadratic" as const } : {}), questionKind: kind as Parameters<typeof generateNonlinearFnModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateNonlinearFnModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderNonlinearFnProblem(model, { figureMode: figurePolicy === "require_figure_choice" ? "figure_choice" : figurePolicy === "require_plane" ? "plane" : "text" });
  } else if (skillCode === "ratios_rates_units") {
    // 2026-09-24(UAT 지적) — require_data 는 proportion(비례식)으로 고정해야 표로
    // 보여줄 두 수량이 있다(연쇄 단위환산은 표 자료와 맞지 않는다).
    const ratiosFigureMode = figurePolicy === "require_data" ? "data" as const : undefined;
    if (ratiosFigureMode && kind && kind !== "proportion") {
      return { ok: false, reason: `선택한 세부 패턴 '${kind}'은 표 자료를 지원하지 않습니다(비례식 유형만 가능합니다).` };
    }
    const model = generateRatiosRatesModel({ difficulty, questionKind: (kind ?? undefined) as Parameters<typeof generateRatiosRatesModel>[0]["questionKind"], figureMode: ratiosFigureMode });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateRatiosRatesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderRatiosRatesProblem(model, { figureMode: ratiosFigureMode });
  } else if (skillCode === "percentages") {
    // 2026-09-24(UAT 지적) — require_data 는 전·후 값을 표로 보여줄 수 있는
    // percent_change 로 고정한다.
    const percentagesFigureMode = figurePolicy === "require_data" ? "data" as const : undefined;
    if (percentagesFigureMode && kind && kind !== "percent_change") {
      return { ok: false, reason: `선택한 세부 패턴 '${kind}'은 표 자료를 지원하지 않습니다(증감률 유형만 가능합니다).` };
    }
    const model = generatePercentagesModel({ difficulty, questionKind: (kind ?? undefined) as Parameters<typeof generatePercentagesModel>[0]["questionKind"], figureMode: percentagesFigureMode });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validatePercentagesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderPercentagesProblem(model, { figureMode: percentagesFigureMode });
  } else if (skillCode === "one_variable_data") {
    const model = generateOneVarDataModel({ difficulty, questionKind: kind as Parameters<typeof generateOneVarDataModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateOneVarDataModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderOneVarDataProblem(model);
  } else if (skillCode === "two_variable_data") {
    const model = generateTwoVarDataModel({ difficulty, questionKind: kind as Parameters<typeof generateTwoVarDataModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateTwoVarDataModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderTwoVarDataProblem(model);
  } else if (skillCode === "probability") {
    const model = generateProbabilityModel({ difficulty, questionKind: kind as Parameters<typeof generateProbabilityModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateProbabilityModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderProbabilityProblem(model);
  } else if (skillCode === "inference_margin_error") {
    // 2026-09-24(UAT 지적) — 이 유형은 모델이 하나뿐이라 강제할 세부 패턴이 없다.
    const inferenceFigureMode = figurePolicy === "require_data" ? "data" as const : undefined;
    const model = generateInferenceModel({ difficulty });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateInferenceModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderInferenceProblem(model, { figureMode: inferenceFigureMode });
  } else if (skillCode === "evaluating_statistical_claims") {
    const evalClaimsFigureMode = figurePolicy === "require_data" ? "data" as const : undefined;
    const model = generateEvalClaimsModel({ difficulty });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateEvalClaimsModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderEvalClaimsProblem(model, { figureMode: evalClaimsFigureMode });
  } else if (skillCode === "area_volume") {
    const model = generateAreaVolumeModel({ difficulty, questionKind: kind as Parameters<typeof generateAreaVolumeModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateAreaVolumeModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderAreaVolumeProblem(model);
  } else if (skillCode === "lines_angles_triangles") {
    const model = generateLinesAnglesModel({ difficulty, questionKind: kind as Parameters<typeof generateLinesAnglesModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateLinesAnglesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderLinesAnglesProblem(model);
  } else if (skillCode === "right_triangles_trigonometry") {
    const model = generateRightTriModel({ difficulty, questionKind: kind as Parameters<typeof generateRightTriModel>[0]["questionKind"] });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateRightTriModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderRightTriProblem(model);
  } else if (skillCode === "circles") {
    // 2026-09-24(UAT 지적) — require_plane 은 circle_equation_transform(좌표평면 원의 방정식)으로
    // 고정하고 실제 원을 그린다. 다른 세부 패턴을 강제로 골랐는데 require_plane이면 지원하지
    // 않는 조합이라 명시적으로 거절한다(조용히 도형으로 대체하지 않는다).
    const circlesFigureMode = figurePolicy === "require_plane" ? "plane" : "geometry";
    if (circlesFigureMode === "plane" && kind && kind !== "circle_equation_transform") {
      return { ok: false, reason: `선택한 세부 패턴 '${kind}'은 좌표평면 자료를 지원하지 않습니다(원의 방정식 유형만 가능합니다).` };
    }
    const model = generateCirclesModel({ difficulty, questionKind: (kind ?? undefined) as Parameters<typeof generateCirclesModel>[0]["questionKind"], figureMode: circlesFigureMode });
    usedKind = (model as { questionKind?: string; kind?: string }).questionKind ?? (model as { kind?: string }).kind ?? null;
    const check = validateCirclesModel(model);
    if (!check.ok) { timing.compileMs += Date.now() - t0; return { ok: false, reason: check.reason }; }
    compiled = renderCirclesProblem(model, { figureMode: circlesFigureMode });
  } else {
    return { ok: false, reason: `지원하지 않는 계산형 유형: ${skillCode}` };
  }
  timing.compileMs += Date.now() - t0;

  const passageForCheck = compiled.passage + "\n\n" + compiled.question;
  const need = applyFigurePolicy(judgeMaterialNeed({ examSystem: "sat_math", skillCode, text: passageForCheck }), figurePolicy);
  const materialFailure = materialBlocker(need, compiled.figure);
  if (materialFailure) return { ok: false, reason: materialFailure };
  if (figurePolicy === "require_figure_choice" && ((compiled.figure as { type?: string; choices?: unknown[] } | null)?.type !== "figure_choice" || (compiled.figure as { choices?: unknown[] }).choices?.length !== 4)) {
    return { ok: false, reason: "관리자가 선택한 그래프/도형 선택지 4개 자료가 생성되지 않았습니다." };
  }
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
  //
  // 2026-09-17(SPR 1차) — format="spr"이면 MC용으로 이미 계산된 정답 텍스트
  // (compiled.options[compiled.correctIndex])를 sprFromAnswerText로 그리드 입력용
  // 동치 정답 목록으로 바꾼다. 정답이 문장/그래프 선택형이라 숫자로 안 읽히거나
  // 그리드 문자 수 제한에 안 맞으면 여기서 실패로 집계하고 다음 후보로 넘어간다 —
  // 이것이 "다중 후보 중 숫자형만 SPR로 채택"하는 검증 게이트다.
  let sprAnswers: string[] | null = null;
  if (format === "spr") {
    const sprModel = sprFromAnswerText(compiled.options[compiled.correctIndex]);
    if (!sprModel) {
      return { ok: false, reason: `SPR 변환 실패: 정답 '${compiled.options[compiled.correctIndex]}'을 그리드 입력 형식으로 바꿀 수 없습니다(문장형·그래프 선택형 정답이거나 문자 수 제한 초과).` };
    }
    sprAnswers = sprModel.answers;
  }

  const contentIssues = checkContent({
    format, passage: passageForCheck, options: format === "mc" ? compiled.options : null, correctIndex: format === "mc" ? compiled.correctIndex : null,
    explanation: compiled.explanation, answers: sprAnswers, statements: null, skillCode, figure: compiled.figure,
  });
  const fatalContent = contentIssues.find((i) => ["math_parse", "math_unclosed", "latex_leak", "answers"].includes(i.code));
  if (fatalContent) {
    return { ok: false, reason: `내용 검증 실패: ${fatalContent.message}` };
  }

  // Step 6 공통 게이트(2026-09-17) — 유형별 검증이 이미 다 돈 뒤, 아직 어디에도 없던
  // 교차 유형 검사 두 가지만 더한다(재해석·모델 재호출 없음, 순수 문자열 검사).
  const bannedIssues = findBannedWords({
    지문: compiled.passage, 질문: compiled.question, 해설: compiled.explanation,
    ...(compiled.options ?? []).reduce((acc, o, i) => ({ ...acc, [`선택지${i + 1}`]: o }), {} as Record<string, string>),
  });
  if (bannedIssues.length) return { ok: false, reason: `금칙어 검출: ${bannedIssues[0].message}` };
  const tagIssues = checkTagConsistency({
    format, options: format === "mc" ? compiled.options : null, answers: sprAnswers, skillCode,
  });
  if (tagIssues.length) return { ok: false, reason: `태그 정합성 오류: ${tagIssues[0].message}` };

  const problem: GeneratedProblem = {
    format,
    figure: compiled.figure,
    passage: passageForCheck,
    stimulus: compiled.passage,
    question: compiled.question,
    needsFigure: false,
    options: format === "mc" ? compiled.options : null,
    correctIndex: format === "mc" ? compiled.correctIndex : null,
    answers: sprAnswers,
    statements: null,
    explanation: compiled.explanation,
    explanationEn: compiled.explanationEn,
    difficulty,
    distractorRationales: compiled.distractorRationales.map((d) => ({
      index: d.index, plausible_because: d.plausibleBecause, matches: d.matches, why_wrong: d.whyWrong, kind: d.kind,
    })),
    difficultyRationale: "",
    design: null,
    // 2026-09-18(제품 오너 지시) - 실제로 쓰인 세부 패턴(무작위 선택이든 forceKind든)을
    // 그대로 들고 다닌다. GeneratedProblem 정식 타입에는 없는 필드라 위 캐스트로만 접근 -
    // 저장 경로(problem-bank-actions.ts)가 (g as { subpattern?: string|null }).subpattern으로 읽는다.
    subpattern: usedKind,
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
    const outcome = attemptOne(params.skillCode, params.difficulty, timing, params.figurePolicy, params.format ?? "mc", params.kind);
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
