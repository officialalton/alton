import { RUBRIC_ROWS, type RubricKey } from "./rubric";

export type RowScores = Record<RubricKey, number>;
export type GraderOutput = { scores: RowScores; rationale: Record<RubricKey, string>; improve: string[] };
export type Disagreement = { rows: RubricKey[]; totalGap: number };

export const GRADER_TOOL = {
  name: "submit_score",
  description: "Submit the rubric scores for the essay.",
  input_schema: {
    type: "object" as const,
    properties: {
      thesis: { type: "integer", minimum: 0, maximum: 1 },
      evidence: { type: "integer", minimum: 0, maximum: 4 },
      sophistication: { type: "integer", minimum: 0, maximum: 1 },
      thesis_rationale: { type: "string" },
      evidence_rationale: { type: "string" },
      sophistication_rationale: { type: "string" },
      improve: { type: "array", items: { type: "string" }, maxItems: 3 },
    },
    required: ["thesis", "evidence", "sophistication", "thesis_rationale", "evidence_rationale", "sophistication_rationale", "improve"],
  },
};

/** 모델이 improve 를 배열 대신 문자열(JSON 배열 텍스트 또는 줄/글머리표 목록)로 돌려주는 경우가 실측됨(보정 2026-10-14) — 무해한 형식 차이이므로 배열로 복원한다. 그 밖의 타입은 그대로 두어 검증이 거부한다. */
export function coerceImprove(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t.startsWith("[")) { try { const a: unknown = JSON.parse(t); if (Array.isArray(a)) return a; } catch { /* 줄 분리로 */ } }
  return t.split(/\n+/).map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}
const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** 모델 출력(도구 입력 객체 또는 JSON 문자열) 검증. 점수는 범위 안 정수, 근거는 비어 있지 않아야 한다. */
export function validateGraderOutput(raw: unknown): { ok: true; value: GraderOutput } | { ok: false; reason: string } {
  let o: unknown = raw;
  if (typeof raw === "string") { try { o = JSON.parse(raw); } catch { return { ok: false, reason: "not_json" }; } }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, reason: "not_object" };
  const r = o as Record<string, unknown>;
  const scores = {} as RowScores; const rationale = {} as Record<RubricKey, string>;
  for (const row of RUBRIC_ROWS) {
    const v = r[row.key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > row.max) return { ok: false, reason: `bad_score_${row.key}` };
    const t = r[`${row.key}_rationale`];
    if (typeof t !== "string" || t.trim().length < 5) return { ok: false, reason: `bad_rationale_${row.key}` };
    scores[row.key] = v; rationale[row.key] = clip(t, 600);
  }
  const imp = coerceImprove(r.improve);
  if (!Array.isArray(imp) || imp.some((x) => typeof x !== "string")) return { ok: false, reason: "bad_improve" };
  return { ok: true, value: { scores, rationale, improve: (imp as string[]).map((x) => clip(x, 300)).filter(Boolean).slice(0, 3) } };
}

export const totalOf = (s: RowScores): number => RUBRIC_ROWS.reduce((n, r) => n + s[r.key], 0);

/** 두 번 채점 결합: 행별로 더 낮은(보수적) 점수. 행 격차 >1 또는 총점 격차 >1 이면 disagreement 표시. 근거·개선점은 총점이 낮은 쪽 실행의 것. */
export function combineRuns(a: GraderOutput, b: GraderOutput): { result: GraderOutput; disagreement: Disagreement | null } {
  const scores = {} as RowScores; const rows: RubricKey[] = [];
  for (const row of RUBRIC_ROWS) {
    scores[row.key] = Math.min(a.scores[row.key], b.scores[row.key]);
    if (Math.abs(a.scores[row.key] - b.scores[row.key]) > 1) rows.push(row.key);
  }
  const totalGap = Math.abs(totalOf(a.scores) - totalOf(b.scores));
  const base = totalOf(a.scores) <= totalOf(b.scores) ? a : b;
  return { result: { ...base, scores }, disagreement: rows.length > 0 || totalGap > 1 ? { rows, totalGap } : null };
}
