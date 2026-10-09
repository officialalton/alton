// 모의고사(MST) 예상 점수 범위(내부 추정) — 순수 함수. 제품 오너 승인(2026-09-29): 총점 400-1600·섹션 200-800은
// "예상 점수 범위(내부 추정)"로만 표시하고 raw 결과와 분리한다. College Board 점수와 동등하다고 표시하지 않는다.
//
// 모델 v1-adaptive: 디지털 SAT의 적응형 채점을 근사한다. College Board는 문항 가중치·변환표를 공개하지 않으므로
// 공개된 일반 지식(쉬운 M2 경로는 섹션 점수 상한이 낮고 어려운 경로에서만 800 도달, 같은 정답 수여도 경로에 따라
// 점수가 다름)만 근거로 경로별 (섹션 정답률 -> 섹션 점수) 앵커 표를 상수화했다. 근거·한계: docs/qa/2026-09-29-mock-exam-score-model-v1.md
//
// 경로(route)는 서버에서 계산에만 쓴다. 이 모듈의 출력(ScoreEstimate)에는 경로·난이도가 없으며, 학생·보호자 응답에는
// 경로 대신 ScoreEstimate 범위만 내려간다(attempt-data.ts). 캘리브레이션(Phase 5)에서 SCORE_MODEL_VERSION 을 올려
// 아래 ANCHORS/너비 규칙만 교체하면 된다.

export const SCORE_MODEL_VERSION = "v1-adaptive";
/** 초기 운영 임계값(2026-10-09 오너 결정): 각 섹션(R&W·Math)에서 실제로 출제된 문항의 80% 이상에 유효한 응답(null·공백 제외, 정답 여부와 무관)을 낸 응시에만 범위를 보인다.
 *  점수 정확도를 보장하는 값이 아니라 응답이 너무 적은 응시에서 추정이 나가는 것을 막기 위한 초기 운영 기준이다. 보정(Phase 5) 때 조정한다. */
export const MIN_RESPONSE_RATIO = 0.8;
/** 응답이 임계값에 못 미칠 때 범위 자리에 그대로 보이는 문구(결과·정오 분석은 그대로 보인다). */
/** 관리자 화면 안내(한국어): 임계값의 성격을 밝힌다. */
export const SCORE_THRESHOLD_NOTE_KO = "예상 점수 범위는 각 섹션(R&W·Math)에서 출제 문항의 80% 이상에 응답한 응시에만 표시됩니다. 80%는 응답이 너무 적은 응시에서 추정이 나가는 것을 막는 초기 운영 기준이며 점수 정확도를 보장하는 값이 아닙니다(정확도 미검증).";
export const INSUFFICIENT_RESPONSES_TEXT = "Not enough responses to estimate a score range.";
/** answered/total >= 80% (정수 연산: 부동소수 오차 없음). answered 를 모르면(undefined/null) 충분하다고 보지 않는다. */
export function hasEnoughResponses(answered: number | null | undefined, total: number): boolean {
  return typeof answered === "number" && total > 0 && answered >= 0 && answered * 100 >= total * Math.round(MIN_RESPONSE_RATIO * 100);
}
export type EstimateOutcome = { estimate: ScoreEstimate | null; reason: null | "insufficient_responses" | "incomplete" };
/** 정책이 적용된 추정: 두 섹션 모두 응답 비율이 임계값 이상이어야 범위를 만든다. */
export function estimateScoreWithPolicy(
  bySection: { section: "rw" | "math"; total: number; correct: number | null; answered?: number | null }[],
  routes: { rw: ScoreRoute | null; math: ScoreRoute | null },
): EstimateOutcome {
  const rw = bySection.find((x) => x.section === "rw"), math = bySection.find((x) => x.section === "math");
  if (!rw || !math || rw.correct === null || math.correct === null || !routes.rw || !routes.math) {
    // 채점된 문항이 한 섹션에 하나도 없으면 = 그 섹션 응답 0 → 응답 부족으로 본다(경로가 없는 경우만 incomplete).
    return { estimate: null, reason: routes.rw && routes.math ? "insufficient_responses" : "incomplete" };
  }
  if (!hasEnoughResponses(rw.answered, rw.total) || !hasEnoughResponses(math.answered, math.total)) return { estimate: null, reason: "insufficient_responses" };
  const estimate = estimateScore(bySection, routes);
  return estimate ? { estimate, reason: null } : { estimate: null, reason: "incomplete" };
}

/** 검증 상태 표기(문서·내부 화면용): 표시 조건은 검증했지만 점수 모델의 정확도는 검증하지 않았다. 표시 규칙: lib/mock-exam/score-display-rule.test.ts · score-display-rule.integration.test.ts. */
export const SCORE_VALIDATION_STATUS = "display verified, accuracy NOT verified" as const;
export const SCORE_DISCLAIMER = "These results are a learning diagnostic and are not equivalent to an official SAT / College Board score. Score ranges are internal estimates.";

/** 학생 결과 화면(영어 UI)용 — 2026-10-02 UAT B1. */
export const SCORE_DISCLAIMER_EN =
  "These results are a learning diagnostic and are not equivalent to an official SAT / College Board score. Score ranges are internal estimates.";

export type ScoreRoute = "higher" | "lower";
export type ScoreRange = { low: number; high: number };
export type ScoreEstimate = { rw: ScoreRange; math: ScoreRange; total: ScoreRange; modelVersion: string };

/** 경로별 [정답률, 섹션 점수] 앵커(구간 선형 보간). 같은 정답률이면 higher >= lower. */
export const ANCHORS: Record<ScoreRoute, readonly (readonly [number, number])[]> = {
  lower: [[0, 200], [0.5, 390], [0.8, 540], [1, 650]],
  higher: [[0, 200], [0.3, 380], [0.5, 480], [0.7, 620], [0.85, 720], [1, 800]],
};
/** lower 경로 점수 상한(이 경로에서는 그 위 점수에 도달할 수 없다고 본다). */
export const LOWER_PATH_CAP = 650;

const BASE_HALF_WIDTH = 30;
const EXTRA_HALF_WIDTH = 20;

const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number) => Math.min(800, Math.max(200, n));

export function interpolate(route: ScoreRoute, rate: number): number {
  const pts = ANCHORS[route];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (rate <= x1) return y0 + ((y1 - y0) * (rate - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
}

/** 경계 근처(lower 상한 부근·higher 하단)에서는 경로 오분류·상한 불확실성 때문에 범위를 더 넓힌다(연속 테이퍼라 단조성 유지). */
function halfWidth(route: ScoreRoute, rate: number): number {
  const edge = route === "lower" ? (rate - 0.7) / 0.2 : (0.6 - rate) / 0.3;
  return BASE_HALF_WIDTH + EXTRA_HALF_WIDTH * Math.min(1, Math.max(0, edge));
}

export function estimateSectionRange(correct: number, total: number, route: ScoreRoute): ScoreRange | null {
  if (total <= 0 || correct < 0 || correct > total) return null;
  const rate = correct / total;
  const center = interpolate(route, rate);
  const w = halfWidth(route, rate);
  let high = clamp(round10(center + w));
  if (route === "lower") high = Math.min(high, LOWER_PATH_CAP);
  const low = Math.min(clamp(round10(center - w)), high);
  return { low, high };
}

/** 두 섹션 모두 채점되고 경로가 확정된 경우에만 추정한다(하나라도 없으면 null). */
export function estimateScore(
  bySection: { section: "rw" | "math"; total: number; correct: number | null }[],
  routes: { rw: ScoreRoute | null; math: ScoreRoute | null },
): ScoreEstimate | null {
  const get = (s: "rw" | "math") => {
    const r = bySection.find((x) => x.section === s);
    const route = routes[s];
    return r && r.correct !== null && route ? estimateSectionRange(r.correct, r.total, route) : null;
  };
  const rw = get("rw");
  const math = get("math");
  if (!rw || !math) return null;
  return { rw, math, total: { low: rw.low + math.low, high: rw.high + math.high }, modelVersion: SCORE_MODEL_VERSION };
}
