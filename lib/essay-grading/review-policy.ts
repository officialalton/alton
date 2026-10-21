// 운영 채점 경로 설계(꺼진 상태 — 어디에서도 호출하지 않는다). docs/ap/europeanhistory-essay-grading-plan.md §9.
// 기본 1회 채점. 아래 트리거가 있을 때만 추가 검토를 하고, 해결이 안 되면 임의 점수를 확정하지 않고 "Scoring under review" 로 둔다.
import { totalOf, type GraderOutput } from "./schema";
import type { RubricRow } from "./rubric";

export const UNDER_REVIEW_LABEL = "Scoring under review";
export const AI_SCORE_LABEL = "AI-generated practice score";
export const MAX_EXTRA_REVIEWS = 2; // 에세이당 추가 검토 호출 상한(기본 채점 1회 별도)
export const MAX_ESSAY_COST_USD = 0.12; // 에세이당 총 호출 비용 상한(기본 1회 + 추가 검토 포함)
const INJECTION_RE = /(ignore (all |the |previous )?(instructions|rubric)|give (me |this )?(a )?(full|top|perfect|max)|system prompt|submit_score)/i;

export type ReviewTrigger = "invalid_output" | "total_mismatch" | "rationale_missing" | "uncertain_row" | "tamper_suspected" | "large_gap";
export type FirstPass = { output: GraderOutput | null; reportedTotal?: number; uncertainRows?: string[]; tamperFlag?: boolean };

/** 1회 채점 결과에서 추가 검토 트리거를 찾는다. 빈 배열이면 그대로 확정(추가 호출 없음). */
export function reviewTriggers(first: FirstPass, essay: string, rows: readonly RubricRow[]): ReviewTrigger[] {
  const t: ReviewTrigger[] = [];
  if (!first.output) return ["invalid_output"];
  if (first.reportedTotal !== undefined && first.reportedTotal !== totalOf(first.output.scores, rows)) t.push("total_mismatch");
  if (rows.some((r) => first.output!.scores[r.key] > 0 && (first.output!.rationale[r.key] ?? "").trim().length < 5)) t.push("rationale_missing");
  if (first.uncertainRows?.length) t.push("uncertain_row");
  if (first.tamperFlag || INJECTION_RE.test(essay)) t.push("tamper_suspected");
  return t;
}

export type Decision = { kind: "accept"; output: GraderOutput } | { kind: "review" } | { kind: "under_review"; reason: string };

/** 추가 검토 후 결정. 마지막 두 결과가 모든 행에서 일치하고 조작 의심이 없으면 확정, 아니면 한 번 더(상한 안), 상한·비용 초과면 under_review. 임의 점수 확정 금지. */
export function decide(passes: GraderOutput[], triggers: ReviewTrigger[], rows: readonly RubricRow[], spentUsd: number): Decision {
  if (!passes.length) return { kind: "under_review", reason: "no_valid_pass" };
  if (triggers.length === 0 && passes.length === 1) return { kind: "accept", output: passes[0] };
  if (passes.length < 2) return spentUsd >= MAX_ESSAY_COST_USD ? { kind: "under_review", reason: "cost_cap" } : { kind: "review" };
  const [a, b] = passes.slice(-2);
  const stableRows = rows.every((r) => a.scores[r.key] === b.scores[r.key]);
  if (stableRows && totalOf(a.scores, rows) === totalOf(b.scores, rows) && !triggers.includes("tamper_suspected")) return { kind: "accept", output: a };
  if (passes.length - 1 >= MAX_EXTRA_REVIEWS) return { kind: "under_review", reason: "unresolved_after_cap" };
  if (spentUsd >= MAX_ESSAY_COST_USD) return { kind: "under_review", reason: "cost_cap" };
  return { kind: "review" };
}
