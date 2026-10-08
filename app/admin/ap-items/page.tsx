import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { EXPERT_KO, PURPOSE_KO, TIER_KO, filterApItems, purposeSummary, type ApFilters, type ApItemRow } from "@/lib/ap-exam/admin-view";

// AP 문항 변환 현황(관리자·한국어). 후보 → 검수 환경 게시 상태와 **용도별(모의고사/수업·과제)** 재고. AdminShell 탭에는 마일스톤 종료 때 편입(/admin/mock-exam 과 같은 패턴).
// 변환·세트 조립은 총괄 스크립트(scripts/ap-generation/publish-to-bank.ts, assemble-ap-set.ts)로 한다 — 이 화면은 읽기 전용.
export default async function AdminApItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f: ApFilters = { subject: sp.subject, purpose: sp.purpose, tier: sp.tier, expert: sp.expert, ready: sp.ready };
  const admin = createAdminClient();
  const { data } = await admin.from("ap_item_conversion_v").select("*").eq("is_current", true).order("candidate_key").limit(2000);
  const all = (data ?? []) as ApItemRow[];
  const rows = filterApItems(all, f);
  const subjects = [...new Set(all.map((r) => r.subject))].sort();
  const sel = (name: keyof ApFilters, label: string, opts: [string, string][]) => (
    <label className="flex flex-col text-[12px] text-grey-600">{label}
      <select name={name} defaultValue={f[name] ?? ""} className="mt-1 rounded border border-grey-300 px-2 py-1 text-[13px]">
        <option value="">전체</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  return (
    <div className="min-h-screen bg-grey-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-semibold text-ink">AP 문항 — 검수 환경 게시 현황</h1>
        <p className="mt-1 text-sm text-grey-500">후보는 변환 때 용도가 하나로 정해지고(모의고사 또는 수업·과제) 이후 바뀌지 않으며 공유되지 않습니다. 세트 조립은 모의고사 용도 문항만 쓰고, 선생님 문제 선택에는 수업·과제 용도만 나옵니다.</p>
        <h2 className="mt-6 text-sm font-semibold">용도별 재고</h2>
        <table className="mt-2 w-full text-left text-[13px]" data-testid="ap-purpose-summary">
          <thead><tr className="text-grey-500"><th>과목</th><th>형식</th><th>용도</th><th>변환됨</th><th>검수 환경</th><th>출시</th></tr></thead>
          <tbody>{purposeSummary(all).map((s) => <tr key={`${s.subject}${s.kind}${s.purpose}`}><td>{s.subject}</td><td>{s.kind === "mc" ? "객관식" : "FRQ"}</td><td>{PURPOSE_KO[s.purpose]}</td><td>{s.total}</td><td>{s.review_env}</td><td>{s.launch}</td></tr>)}</tbody>
        </table>
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          {sel("subject", "과목", subjects.map((s) => [s, s]))}
          {sel("purpose", "용도", [["mock_exam", PURPOSE_KO.mock_exam], ["lesson", PURPOSE_KO.lesson], ["none", "미배정(변환 전)"]])}
          {sel("tier", "단계", Object.entries(TIER_KO))}
          {sel("expert", "검수 상태", Object.entries(EXPERT_KO))}
          {sel("ready", "게시 준비", [["yes", "준비됨(자동 게이트+렌더+화면 검증)"], ["no", "준비 안 됨"]])}
          <button type="submit" className="rounded bg-ink px-3 py-1.5 text-[13px] font-semibold text-white">필터 적용</button>
        </form>
        <p className="mt-3 text-[12px] text-grey-500">{rows.length}건 / 전체 {all.length}건</p>
        <table className="mt-2 w-full text-left text-[12.5px]">
          <thead><tr className="text-grey-500"><th>후보 키</th><th>과목</th><th>형식</th><th>게시 준비</th><th>용도</th><th>단계</th><th>검수</th><th>검수 기간 종료</th></tr></thead>
          <tbody>{rows.slice(0, 500).map((r) => (
            <tr key={r.candidate_key} className="border-t border-grey-200">
              <td className="font-mono">{r.candidate_key}</td><td>{r.subject}</td><td>{r.kind === "mc" ? "객관식" : "FRQ"}</td>
              <td>{r.review_env_ready ? "준비됨" : `대기(${r.review_state}${r.render_verified ? "" : ", 렌더 미검증"}${r.screen_verified ? "" : ", 화면 미검증"})`}</td>
              <td>{r.purpose ? PURPOSE_KO[r.purpose] : "—"}</td><td>{TIER_KO[r.release_tier] ?? r.release_tier}</td><td>{EXPERT_KO[r.expert_status] ?? r.expert_status}</td>
              <td>{r.review_period_ends_at ? r.review_period_ends_at.slice(0, 10) : "—"}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
