"use client";

import { useCallback, useEffect, useState } from "react";
import { apStockBatchStatusAction, apStockLoadBatchAction, type ApStockOverview } from "../ap-stock-actions";
import { SKIP_KIND_LABEL, loadStepLabel, runBatchSequence, type BatchRun, type BatchStatus, type LoadStep, type SkipKind } from "@/lib/ap-admin/load-batch-client";

// '배치 전체 적재'(2026-10-13): ①적재→②렌더→③화면→④변환을 한 번에. 위 4개 단계 카드와 같은 서버 함수·가드·감사 기록을 쓰며,
// 건너뜀·충돌·오류가 하나라도 있으면 그 자리에서 멈춘다. 배치는 순서대로 한 번에 하나씩 서버를 호출한다.

/** 건너뜀 허용 모드의 단계×종류별 묶음(건수 + 펼치면 키 목록) 과 실행 후 '남은 것' 목록. */
function SkipView({ r }: { r: BatchRun }) {
  if (!r.allowSkips) return null;
  const groups = new Map<string, { step: LoadStep; kind: SkipKind; rows: { key: string; reason: string }[] }>();
  for (const x of r.skipped ?? []) { const g = groups.get(`${x.step}/${x.kind}`) ?? { step: x.step, kind: x.kind, rows: [] }; g.rows.push({ key: x.key, reason: x.reason }); groups.set(`${x.step}/${x.kind}`, g); }
  const remaining = r.remaining ?? [];
  return (
    <div className="mt-1 text-xs" data-testid={`ap-loadall-skips-${r.batchId}`}>
      <p className="font-bold">{r.mode === "preview" ? "건너뛸 후보(기록·변환하지 않고 미검증 후보로 남음)" : "건너뛴 후보(기록·변환하지 않음)"}: {remaining.length}건</p>
      {[...groups.values()].map((g) => (
        <details key={`${g.step}/${g.kind}`} className="ml-2">
          <summary className="cursor-pointer">{loadStepLabel(g.step)} — {SKIP_KIND_LABEL[g.kind]} {g.rows.length}건</summary>
          <ul className="ml-3 list-disc text-grey-600">{g.rows.map((x) => <li key={x.key}><code>{x.key}</code> — {x.reason}</li>)}</ul>
        </details>
      ))}
      {r.mode === "preview" && <p className="ml-2 text-grey-500">※ ② 기록 전 후보의 화면 증거 여부는 ② 실행 뒤에 확정됩니다(④ 의 검증 미완료 후보는 실행 시점에 확정). 실행 중 목록과 다르면 중단합니다.</p>}
      {r.mode === "execute" && remaining.length > 0 && (
        <div className="mt-1" data-testid={`ap-loadall-remaining-${r.batchId}`}>
          <p className="font-bold">남은 것(통과했지만 변환되지 않음) {remaining.length}건</p>
          <ul className="ml-3 list-disc text-grey-600">{remaining.map((x) => <li key={x.key}><code>{x.key}</code> — {x.reason}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function RunView({ r }: { r: BatchRun }) {
  return (
    <div className="mt-2 rounded border border-grey-200 bg-grey-50 p-2 text-xs" data-testid={`ap-loadall-run-${r.batchId}`}>
      <p className="font-bold">{r.batchId} — {r.mode === "preview" ? "미리보기" : "실행"} {r.ok ? (r.mode === "execute" ? "완료" : "이상 없음") : "중단"}</p>
      <ul className="mt-1 space-y-0.5 text-grey-600">
        {r.entries.map((e, i) => (
          <li key={i} className={e.ok ? "" : "font-bold text-red"}>
            {e.ok ? "✓" : "✗"} {e.summary}
            {Object.keys(e.counts).length > 0 && <span className="text-grey-500"> ({Object.entries(e.counts).map(([k, v]) => `${k} ${v}`).join(" · ")})</span>}
          </li>
        ))}
      </ul>
      <SkipView r={r} />
      {r.stoppedAt && <p className="mt-1 font-bold text-red" role="alert">멈춘 위치: {r.stoppedAt.step === "guard" || r.stoppedAt.step === "preview" ? r.stoppedAt.step : loadStepLabel(r.stoppedAt.step)} — {r.stoppedAt.reason}</p>}
    </div>
  );
}

export default function ApLoadBatchPanel({ ov, onDone }: { ov: ApStockOverview; onDone: () => void }) {
  const [status, setStatus] = useState<Map<string, BatchStatus> | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Map<string, BatchRun>>(new Map());
  const [runs, setRuns] = useState<BatchRun[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [allowSkips, setAllowSkips] = useState(false);
  const [busy, setBusy] = useState<"preview" | "run" | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setStatusError(null);
    apStockBatchStatusAction().then((s) => setStatus(new Map(s.map((x) => [x.id, x])))).catch(() => setStatusError("배치별 적재 현황을 불러오지 못했습니다."));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const order = ov.batches.filter((b) => b.artifactsOk).map((b) => b.id).filter((id) => selected.has(id));
  const resetResults = () => { setPreviews(new Map()); setRuns([]); setConfirm(false); setSummary(null); setError(null); };
  const toggle = (id: string) => { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); resetResults(); };
  const selectUnloaded = () => { setSelected(new Set(ov.batches.filter((b) => b.artifactsOk && !status?.get(b.id)?.done).map((b) => b.id))); resetResults(); };

  const previewAll = async () => {
    setBusy("preview"); resetResults();
    const got = new Map<string, BatchRun>();
    try {
      for (const id of order) { const r = await apStockLoadBatchAction({ batchId: id, execute: false, allowSkips }); got.set(id, r); setPreviews(new Map(got)); }
    } catch (e) { setError(e instanceof Error ? e.message : "미리보기에 실패했습니다."); }
    finally { setBusy(null); }
  };
  const previewOk = order.length > 0 && order.every((id) => previews.get(id)?.ok && previews.get(id)?.previewHash);
  const skipCount = order.reduce((n, id) => n + (previews.get(id)?.remaining?.length ?? 0), 0);
  const canRun = ov.target.canWrite && previewOk && confirm && !busy;

  const runAll = async () => {
    setBusy("run"); setRuns([]); setSummary(null); setError(null);
    try {
      const out = await runBatchSequence(order, (id) => apStockLoadBatchAction({ batchId: id, execute: true, previewHash: previews.get(id)?.previewHash ?? null, allowSkips }), (r) => setRuns((x) => [...x, r]));
      const left = out.runs.filter((x) => (x.remaining?.length ?? 0) > 0).map((x) => `${x.batchId} ${x.remaining!.length}건(${x.remaining!.map((y) => y.key).join(", ")})`);
      const skipNote = allowSkips ? ` 건너뜀 허용 모드 — 변환되지 않고 남은 후보: ${left.length ? left.join(" / ") : "없음"}.` : "";
      setSummary((out.stoppedAt ? `중단: ${out.stoppedAt.batchId} / ${out.stoppedAt.step} — ${out.stoppedAt.reason} (완료 ${out.completed}/${order.length}개 배치)` : `완료: ${out.completed}/${order.length}개 배치 적재·검증·변환 끝.`) + skipNote);
    } catch (e) { setError(e instanceof Error ? e.message : "실행에 실패했습니다."); }
    finally { setBusy(null); setConfirm(false); setPreviews(new Map()); refresh(); onDone(); }
  };

  return (
    <div className="rounded border border-grey-200 p-3" data-testid="ap-loadall">
      <h4 className="text-[13px] font-bold">배치 전체 적재(① 적재 → ② 렌더 → ③ 화면 → ④ 변환)</h4>
      <p className="mt-0.5 text-xs text-grey-500">아래 4개 단계와 같은 규칙으로 한 번에 실행합니다. 각 단계는 미리보기를 다시 계산해 검증한 뒤 같은 계획으로만 실행하고, 건너뜀·충돌·오류가 하나라도 있으면 그 자리에서 멈춥니다. 변환은 20건씩 끝날 때까지 반복(상한 있음). 재실행해도 새 변경은 없습니다. 모든 단계가 작업 이력에 기록됩니다.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy || !status} onClick={selectUnloaded} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">아직 안 끝난 배치 모두 선택</button>
        <button type="button" disabled={!!busy} onClick={() => { setSelected(new Set()); resetResults(); }} className="min-h-9 rounded border border-grey-300 px-3 text-xs disabled:opacity-50">선택 해제</button>
        <button type="button" disabled={!!busy} onClick={refresh} className="min-h-9 rounded border border-grey-300 px-3 text-xs disabled:opacity-50">현황 새로고침</button>
        <span className="text-xs text-grey-500">선택 {order.length}개</span>
      </div>
      {statusError && <p className="mt-2 text-xs text-red" role="alert">{statusError}</p>}
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full min-w-[640px] text-xs" data-testid="ap-loadall-status">
          <thead><tr className="text-left text-grey-500"><th className="py-1 pr-2">선택</th><th className="py-1 pr-2">배치</th><th className="py-1 pr-2 text-right">통과 키</th><th className="py-1 pr-2 text-right">적재</th><th className="py-1 pr-2 text-right">렌더</th><th className="py-1 pr-2 text-right">화면</th><th className="py-1 pr-2 text-right">변환</th><th className="py-1">상태</th></tr></thead>
          <tbody>
            {ov.batches.map((b) => {
              const s = status?.get(b.id);
              return (
                <tr key={b.id} className="border-t border-grey-100">
                  <td className="py-1 pr-2"><input type="checkbox" aria-label={`${b.title} 선택`} checked={selected.has(b.id)} disabled={!b.artifactsOk || !!busy} onChange={() => toggle(b.id)} /></td>
                  <td className="py-1 pr-2">{b.title}</td>
                  {s ? <><td className="py-1 pr-2 text-right">{s.keys}</td><td className="py-1 pr-2 text-right">{s.loaded}</td><td className="py-1 pr-2 text-right">{s.render}</td><td className="py-1 pr-2 text-right">{s.screen}</td><td className="py-1 pr-2 text-right">{s.converted}</td><td className={"py-1 " + (s.done ? "text-green" : "font-bold text-red")}>{s.done ? "완료" : "작업 필요"}</td></> : <td className="py-1 text-grey-400" colSpan={6}>{b.artifactsOk ? (statusError ? "-" : "불러오는 중...") : "산출물 없음"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="mt-2 flex items-start gap-1 text-xs text-grey-600" data-testid="ap-loadall-allow-skips">
        <input type="checkbox" className="mt-0.5" checked={allowSkips} disabled={!!busy} onChange={(e) => { setAllowSkips(e.target.checked); resetResults(); }} />
        <span><b>증거 없는 행은 건너뛰고 나머지만 적재</b> (기본 꺼짐) — 화면 증거 없음·해시 불일치·렌더 보고서 없음(②③)과 검증 미완료(④)인 후보만 건너뜁니다. 건너뛴 후보는 기록·변환·검증 표시를 하지 않고 미검증 후보로 남습니다. 오류·충돌·가드·변환 실패 등 다른 중단 조건은 그대로 멈춥니다. 미리보기에서 건너뛸 후보 목록을 확인하세요.</span>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy || order.length === 0} onClick={previewAll} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{busy === "preview" ? "미리보기 계산 중..." : "미리보기"}</button>
        <label className="flex items-center gap-1 text-xs text-grey-600"><input type="checkbox" checked={confirm} disabled={!previewOk || !!busy} onChange={(e) => setConfirm(e.target.checked)} />{allowSkips ? `미리보기 결과를 확인했고, 후보 ${skipCount}건을 건너뛰고(적재·변환하지 않음) 진행하는 데 동의합니다` : "미리보기 결과를 확인했습니다"}</label>
        <button type="button" disabled={!canRun} onClick={runAll} className="min-h-9 rounded bg-ink px-3 text-xs font-bold text-white disabled:opacity-40" title={ov.target.canWrite ? undefined : "이 대상에는 쓸 수 없습니다"}>{busy === "run" ? "실행 중..." : "선택한 배치 전체 적재 실행"}</button>
      </div>
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {runs.length === 0 && order.map((id) => previews.get(id)).filter((x): x is BatchRun => !!x).map((r) => <RunView key={r.batchId} r={r} />)}
      {runs.map((r) => <RunView key={r.batchId} r={r} />)}
      {busy === "run" && <p className="mt-2 text-xs text-grey-500" data-testid="ap-loadall-live">진행 중: {order[runs.length] ?? "-"} (배치 {Math.min(runs.length + 1, order.length)}/{order.length})</p>}
      {summary && <p className={"mt-2 text-xs font-bold " + (summary.startsWith("중단") ? "text-red" : "text-green")} data-testid="ap-loadall-summary">{summary}</p>}
    </div>
  );
}
