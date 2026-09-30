// 모의고사(MST) 예상 점수 범위(내부 추정) — 순수 함수. 제품 오너 승인(2026-09-29): 총점 400-1600·섹션 200-800은
// "예상 점수 범위(내부 추정)"로만 표시하고 raw 결과와 분리한다. College Board 점수와 동등하다고 표시하지 않는다.
// 모델 v0(선형 근사): 섹션 정답률 r -> 200 + 600r 을 중심으로 ±폭. 경로(higher/lower)·문항 난이도는 쓰지 않는다
// (학생·보호자에게 내려오지 않는 정보라 이 계산이 단서가 되면 안 된다). 캘리브레이션(Phase 5)에서 모델 버전을 올려 교체한다.

export const SCORE_MODEL_VERSION = "v0-linear";
export const SCORE_DISCLAIMER = "실제 SAT·College Board 점수와 동등하지 않은 학습 진단 결과입니다. 예상 점수 범위는 내부 추정치입니다.";
const HALF_WIDTH = 60; // 섹션 기준 ±(10점 단위 반올림 전)

export type ScoreRange = { low: number; high: number };
export type ScoreEstimate = { rw: ScoreRange; math: ScoreRange; total: ScoreRange; modelVersion: string };

const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number) => Math.min(800, Math.max(200, n));

export function estimateSectionRange(correct: number, total: number): ScoreRange | null {
  if (total <= 0 || correct < 0 || correct > total) return null;
  const center = 200 + 600 * (correct / total);
  return { low: clamp(round10(center - HALF_WIDTH)), high: clamp(round10(center + HALF_WIDTH)) };
}

/** 두 섹션 모두 채점된 경우에만 추정한다(하나라도 없으면 null). */
export function estimateScore(
  bySection: { section: "rw" | "math"; total: number; correct: number | null }[],
): ScoreEstimate | null {
  const get = (s: "rw" | "math") => {
    const r = bySection.find((x) => x.section === s);
    return r && r.correct !== null ? estimateSectionRange(r.correct, r.total) : null;
  };
  const rw = get("rw");
  const math = get("math");
  if (!rw || !math) return null;
  return { rw, math, total: { low: rw.low + math.low, high: rw.high + math.high }, modelVersion: SCORE_MODEL_VERSION };
}
