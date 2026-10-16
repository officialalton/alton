// 고정형 SAT 모의고사 V1 — 답안 자동 채점.
// lib/homework-batch-actions.ts 의 mc/spr 자동 채점 로직과 같은 규칙(사양 7절 "기존 문제 답안
// 모델을 재사용")을 쓴다 — 별도 채점 기준을 새로 만들지 않는다.

export type GradableFormat = "mc" | "spr" | "essay" | "math";

function normalizeSprAnswer(text: string): string {
  return text.trim().replace(/\s+/g, "");
}

function sprMatches(response: string, answers: string[]): boolean {
  const r = normalizeSprAnswer(response);
  if (!r) return false;
  return answers.some((a) => {
    const na = normalizeSprAnswer(a);
    if (na === r) return true;
    const rn = Number(r);
    const an = Number(na);
    return Number.isFinite(rn) && Number.isFinite(an) && Math.abs(rn - an) < 1e-9;
  });
}

/**
 * 문항 하나의 응답을 자동 채점한다. mc/spr 만 서버가 즉시 계산할 수 있고(사양 7절),
 * essay/math 는 자동 채점 대상이 아니므로 null(수동 채점 필요)을 돌려준다.
 */
export function autoGrade(
  format: GradableFormat,
  response: string,
  correctIndex: number | null,
  answers: string[] | null,
): boolean | null {
  if (format === "mc") {
    if (correctIndex === null || correctIndex === undefined) return null;
    return response === String(correctIndex);
  }
  if (format === "spr") {
    if (!answers || answers.length === 0) return null;
    return sprMatches(response, answers);
  }
  return null;
}
