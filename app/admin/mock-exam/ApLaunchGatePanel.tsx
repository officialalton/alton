"use client";

import { useCallback, useEffect, useState } from "react";
import { apLaunchGateStatusAction } from "../ap-stock-actions";
import type { LaunchGateReport } from "@/lib/ap-admin/launch-gate";

// '출시 차단·검증 현황'(읽기 전용). 비보관 AP 세트(풀·부분)마다 launch 준비(ap_launch_ready_v)가 아닌 문항과 사유, 세트별 출시 게이트 판정.
// 아무것도 쓰지 않는다. 판정은 "출시 게이트 조건 충족 여부"이며 공개·launch 승격은 별도 절차다.
const SECTION_KO: Record<string, string> = { ap_mc_a: "MC Part A", ap_mc_b: "MC Part B", ap_frq_a: "FRQ Part A", ap_frq_b: "FRQ Part B" };

export default function ApLaunchGatePanel() {
  const [rep, setRep] = useState<LaunchGateReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true); setError(null);
    apLaunchGateStatusAction().then((r) => { setRep(r); setLoading(false); }, () => { setError("출시 차단·검증 현황을 불러오지 못했습니다."); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section data-testid="ap-launch-gate">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">출시 차단·검증 현황(읽기 전용)</h3>
        <button type="button" disabled={loading} onClick={load} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{loading ? "불러오는 중..." : "새로고침"}</button>
      </div>
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {loading && !rep && !error && <p className="mt-2 text-xs text-grey-500">불러오는 중...</p>}
      {rep && rep.sets.length === 0 && <p className="mt-2 text-xs text-grey-400">비보관 AP 세트가 없습니다.</p>}
      {rep && rep.sets.length > 0 && (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-grey-600" data-testid="ap-launch-gate-totals">
            세트 {rep.totals.sets}개 중 출시 게이트 통과 가능 {rep.totals.readySets}개 · 미충족 문항 {rep.totals.blockedItems}건 · 미해결 launch 차단 결함 {rep.totals.openBlockers}건(전체 대장 {rep.totals.globalOpenBlockers}건) · 오답·문항 결함 신고 {rep.totals.openDefectReports}건 · 열린 오류 신고 {rep.totals.openErrorReports}건
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs" data-testid="ap-launch-gate-table">
              <thead><tr className="text-left text-grey-500"><th className="py-1 pr-2">세트</th><th className="py-1 pr-2">상태</th><th className="py-1 pr-2 text-right">문항</th><th className="py-1 pr-2 text-right">준비</th><th className="py-1 pr-2 text-right">차단 결함</th><th className="py-1 pr-2 text-right">열린 오류 신고</th><th className="py-1">판정</th></tr></thead>
              <tbody>
                {rep.sets.map((s) => (
                  <tr key={s.id} className="border-t border-grey-100 align-top" data-ready={s.ready ? "1" : "0"}>
                    <td className="py-1 pr-2">{s.name}{s.versionNo ? ` v${s.versionNo}` : ""}</td>
                    <td className="py-1 pr-2">{s.status}</td>
                    <td className="py-1 pr-2 text-right">{s.itemCount}</td>
                    <td className="py-1 pr-2 text-right">{s.readyCount}</td>
                    <td className="py-1 pr-2 text-right">{s.openBlockers + s.openDefectReports}</td>
                    <td className="py-1 pr-2 text-right">{s.openErrorReports}</td>
                    <td className={"py-1 font-bold " + (s.ready ? "text-green" : "text-red")}>{s.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rep.sets.filter((s) => s.blocked.length > 0).map((s) => (
            <details key={s.id} className="rounded border border-grey-200 p-2 text-xs" data-testid={`ap-launch-blocked-${s.id}`}>
              <summary className="min-h-9 cursor-pointer py-1 font-bold">{s.name} — 미충족 문항 {s.blocked.length}건</summary>
              <ul className="mt-1 max-h-64 list-disc space-y-0.5 overflow-y-auto pl-4 text-grey-600">
                {s.blocked.map((b) => <li key={`${b.section}-${b.position}`}>{SECTION_KO[b.section] ?? b.section} #{b.position} <span className="font-mono">{b.candidateKey ?? "-"}</span>: {b.reasons.join(" / ")}</li>)}
              </ul>
            </details>
          ))}
          <p className="text-xs text-grey-500">전문가 승인은 조건이 아니며, 신고가 없다는 사실을 검수 완료로 보지 않습니다. 이 판정은 출시 게이트 충족 여부만 보여 주며 launch 승격·공개는 하지 않습니다.</p>
        </div>
      )}
    </section>
  );
}
