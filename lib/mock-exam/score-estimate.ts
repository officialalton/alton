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
export const SCORE_DISCLAIMER = "실제 SAT·College Board 점수와 동등하지 않은 학습 진단 결과입니다. 예상 점수 범위는 내부 추정치입니다.";

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
