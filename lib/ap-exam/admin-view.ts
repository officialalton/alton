// AP 문항 변환 현황(관리자·한국어) — 순수 가공 함수. 용도(purpose)·단계(release_tier)·검수 상태 필터와 용도별 재고 집계.
export type ApItemRow = {
  candidate_key: string; subject: string; kind: string; review_state: string; render_verified: boolean; screen_verified: boolean;
  review_env_ready: boolean; purpose: string | null; release_tier: string; expert_status: string; converted_at: string | null;
};
export const PURPOSE_KO: Record<string, string> = { mock_exam: "모의고사", lesson: "수업·과제" };
export const TIER_KO: Record<string, string> = { candidate: "후보(비공개)", review_env: "검수 환경", launch: "출시" };
export const EXPERT_KO: Record<string, string> = { unreviewed: "미검수", in_review: "검수 중", approved: "승인", issues_reported: "오류 신고됨" };
export type ApFilters = { subject?: string; purpose?: string; tier?: string; expert?: string; ready?: string };

export function filterApItems(rows: ApItemRow[], f: ApFilters): ApItemRow[] {
  return rows.filter((r) =>
    (!f.subject || r.subject === f.subject) &&
    (!f.purpose || (f.purpose === "none" ? r.purpose === null : r.purpose === f.purpose)) &&
    (!f.tier || r.release_tier === f.tier) &&
    (!f.expert || r.expert_status === f.expert) &&
    (!f.ready || (f.ready === "yes" ? r.review_env_ready : !r.review_env_ready)));
}
export function purposeSummary(rows: ApItemRow[]) {
  const out = new Map<string, { subject: string; kind: string; purpose: string; total: number; review_env: number; launch: number }>();
  for (const r of rows) {
    if (!r.purpose) continue;
    const k = `${r.subject}|${r.kind}|${r.purpose}`;
    const e = out.get(k) ?? { subject: r.subject, kind: r.kind, purpose: r.purpose, total: 0, review_env: 0, launch: 0 };
    e.total++; if (r.release_tier === "review_env") e.review_env++; if (r.release_tier === "launch") e.launch++;
    out.set(k, e);
  }
  return [...out.values()].sort((a, b) => (a.subject + a.kind + a.purpose).localeCompare(b.subject + b.kind + b.purpose));
}
