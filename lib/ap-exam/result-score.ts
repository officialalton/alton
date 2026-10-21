// AP 결과 점수 계산(순수 함수). 화면(ApExamResultView)이 쓰는 단일 출처.
// 원칙: 미채점 FRQ 는 0점이 아니다(상태로 구분) · 전체 채점이 끝나고 공식 풀 구성일 때만 가중 합산 점수를 낸다 ·
// 근거가 확인된 섹션 비중(section-weights.ts)이 없으면 섹션별 원점수만 보인다 · AP 1~5 등급은 만들지 않는다.
import type { MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import { isOfficialFullLayout, type LayoutLike } from "./layouts";
import { apWeightsFor, type ApWeightComponentId } from "./section-weights";
import type { EssayScoreView } from "@/lib/essay-grading/view";

const GROUPED_RUBRICS = ["ushistory-v1", "whap-v1", "euro-v1"]; // SAQ 묶음 채점: 첫 파트 행 하나가 문항 전체

export type FrqItemState = "scored" | "in_progress" | "unavailable" | "not_scored";
export type FrqItemResult = { setItemId: string; section: string; state: FrqItemState; max: number; earned: number | null; noResponse?: boolean; component: ApWeightComponentId };
export type WeightedComponent = { id: ApWeightComponentId; label: string; earned: number; max: number; weightPct: number; contribution: number };
export type WithheldReason = "partial_set" | "no_weights" | "mc_incomplete" | "frq_not_scored" | "frq_in_progress" | "frq_unavailable" | "point_mismatch";
export type ApResultSummary = {
  mc: { total: number; answered: number; correct: number; pct: number | null };
  frq: { items: FrqItemResult[]; max: number; scoredPoints: number; scoredItems: number; state: "none" | "not_scored" | "in_progress" | "unavailable" | "complete" };
  weighted: { status: "available"; points: number; components: WeightedComponent[] } | { status: "withheld"; reason: WithheldReason };
};

const COMPONENT_LABEL: Record<ApWeightComponentId, string> = { mc: "Multiple choice", frq: "Free response", saq: "Short answer", dbq: "Document-based question", leq: "Long essay question" };
const round1 = (n: number) => Math.round(n * 10) / 10;
const key = (id: string, label: string) => `${id}:${label}`;

/** 서술형 문항 하나의 상태. aiScoring=false 면 이 응시는 FRQ 점수가 없다(0점 아님). */
function frqItem(it: MockExamAttemptItem, byPart: Map<string, EssayScoreView>, aiScoring: boolean, hasHistory: boolean): FrqItemResult {
  const parts = it.parts ?? [];
  const max = parts.reduce((n, p) => n + (Number.isFinite(p.points) ? p.points : 0), 0);
  const base = { setItemId: it.setItemId, section: it.section as string, max };
  let component: ApWeightComponentId = it.section === ("ap_saq" as string) ? "saq" : "frq";
  if (!aiScoring) return { ...base, state: "not_scored", earned: null, component };
  const first = parts[0] ? byPart.get(key(it.setItemId, parts[0].label)) : undefined;
  const grouped = parts.length > 1 && !!first && GROUPED_RUBRICS.includes(first.rubricVersion ?? "");
  const rows = (grouped ? [first] : parts.map((p) => byPart.get(key(it.setItemId, p.label)))) as (EssayScoreView | undefined)[];
  if (rows.length === 0) return { ...base, state: "unavailable", earned: null, component };
  let earned = 0, noResponse = true, state: FrqItemState = "scored";
  for (const r of rows) {
    if (!r || r.status === "pending" || r.status === "processing" || r.status === "failed") { state = "in_progress"; continue; }
    if (r.status === "skipped" && r.lastError === "empty") continue; // 답안 없음 = 진짜 0점(공식 AP 도 빈 답안은 0점)
    noResponse = false;
    const t = r.scores?.total;
    if (r.status !== "done" || typeof t !== "number" || !Number.isFinite(t)) { if (state !== "in_progress") state = "unavailable"; continue; }
    earned += t;
  }
  if (hasHistory && it.section !== ("ap_saq" as string)) {
    const tt = rows.map((r) => r?.scores?.taskType).find((x) => typeof x === "string");
    if (tt === "dbq" || tt === "leq") component = tt;
  }
  if (state !== "scored") return { ...base, state, earned: null, component };
  if (earned < 0 || earned > max) return { ...base, state: "unavailable", earned: null, component }; // 합산 오류 방지: 문항 만점을 넘는 점수는 쓰지 않는다
  return { ...base, state, earned, noResponse, component };
}

export function summarizeApResult(o: {
  subject: string | null | undefined; items: MockExamAttemptItem[]; layout: LayoutLike | null | undefined;
  essayScores?: EssayScoreView[]; aiScoring: boolean;
}): ApResultSummary {
  const mc = o.items.filter((i) => i.format === "mc");
  const frqIt = o.items.filter((i) => i.format === "essay");
  const correct = mc.filter((i) => i.correct === true).length;
  const answered = mc.filter((i) => i.response != null && i.response !== "").length;
  const weights = apWeightsFor(o.subject);
  const hasHistory = !!weights?.components.some((c) => c.id === "dbq");
  const byPart = new Map((o.essayScores ?? []).map((r) => [key(r.setItemId, r.partLabel), r]));
  const items = frqIt.map((i) => frqItem(i, byPart, o.aiScoring, hasHistory));
  const scored = items.filter((i) => i.state === "scored");
  const frqState: ApResultSummary["frq"]["state"] = items.length === 0 ? "none" : !o.aiScoring ? "not_scored" : items.some((i) => i.state === "in_progress") ? "in_progress" : items.some((i) => i.state === "unavailable") ? "unavailable" : "complete";
  const out: ApResultSummary = {
    mc: { total: mc.length, answered, correct, pct: mc.length ? Math.round((100 * correct) / mc.length) : null },
    frq: { items, max: items.reduce((n, i) => n + i.max, 0), scoredPoints: scored.reduce((n, i) => n + (i.earned ?? 0), 0), scoredItems: scored.length, state: frqState },
    weighted: { status: "withheld", reason: "no_weights" },
  };
  const withhold = (reason: WithheldReason): ApResultSummary => ({ ...out, weighted: { status: "withheld", reason } });
  if (!isOfficialFullLayout(o.subject, o.layout)) return withhold("partial_set"); // 부분 연습 세트·구성 불명은 전범위 점수를 만들지 않는다
  if (!weights) return withhold("no_weights");
  // 레이아웃의 섹션별 문항 수와 실제 문항이 같아야 한다(누락 문항으로 만점 기준이 틀어지지 않게).
  for (const s of o.layout ?? []) if (o.items.filter((i) => (i.section as string) === s.key).length !== s.count) return withhold("mc_incomplete");
  if (frqState === "none" || frqState === "not_scored") return withhold("frq_not_scored");
  if (frqState === "in_progress") return withhold("frq_in_progress");
  if (frqState === "unavailable") return withhold("frq_unavailable");
  const comps: WeightedComponent[] = [];
  for (const c of weights.components) {
    const earned = c.id === "mc" ? correct : items.filter((i) => i.component === c.id).reduce((n, i) => n + (i.earned ?? 0), 0);
    const max = c.id === "mc" ? mc.length : items.filter((i) => i.component === c.id).reduce((n, i) => n + i.max, 0);
    if (max <= 0) return withhold("point_mismatch"); // 구성 요소가 비었거나 만점 0 → 가중 계산 불가
    comps.push({ id: c.id, label: COMPONENT_LABEL[c.id], earned, max, weightPct: round1(c.pct), contribution: (earned / max) * c.pct });
  }
  const assigned = items.reduce((n, i) => n + i.max, 0), inComps = comps.filter((c) => c.id !== "mc").reduce((n, c) => n + c.max, 0);
  if (assigned !== inComps) return withhold("point_mismatch"); // 어떤 FRQ 도 구성 요소에서 빠지지 않아야 한다
  return { ...out, weighted: { status: "available", points: round1(comps.reduce((n, c) => n + c.contribution, 0)), components: comps.map((c) => ({ ...c, contribution: round1(c.contribution) })) } };
}

export const WITHHELD_TEXT: Record<WithheldReason, string> = {
  partial_set: "A weighted total is only shown for a full practice exam with every section.",
  no_weights: "A weighted total is not available for this subject yet. Section scores are shown instead.",
  mc_incomplete: "A weighted total is not available because this attempt does not contain every question of the exam.",
  frq_not_scored: "A weighted total is not available because the free-response section is not scored for this subject. Section scores are shown instead.",
  frq_in_progress: "Scoring in progress. Your weighted total will appear after every free-response answer is scored.",
  frq_unavailable: "A weighted total is not available because at least one free-response answer could not be scored.",
  point_mismatch: "A weighted total is not available because the question points do not add up.",
};
