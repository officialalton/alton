"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apNewVersionDraftAction,
  apNewVersionPreviewAction,
  apNewVersionPublishAction,
  apSetAccessTierAction,
  getApNewVersionOverviewAction,
  type ApNewVersionOverview,
  type ApResult,
  type ApSetRow,
} from "../ap-new-version-actions";

// 'AB/AP 세트 새 버전' + 공개 범위(2026-10-12). 흐름: 공개 세트 선택 → 교체 계획(저장소 파일 또는 직접 입력) → 미리보기(검증·구성 전/후·기존 응시 수)
// → 확인 체크 → 새 버전 초안 만들기 → (별도) 새 버전 공개. 공개본(v1)·응시·답안·결과는 바뀌지 않는다.

const TIER_KO = { free: "무료", tutoring: "튜터링" } as const;
type Tier = keyof typeof TIER_KO;

function ResultView({ r, testid }: { r: ApResult; testid: string }) {
  return (
    <div className="mt-2 rounded border border-grey-200 bg-grey-50 p-2 text-xs" data-testid={testid}>
      <p className="font-bold">{r.mode === "execute" ? (r.executed ? "실행 완료" : "실행 안 됨") : "미리보기"}{r.blocked ? ` — ${r.blocked}` : ""}</p>
      {r.lines.length > 0 && <ul className="mt-1 max-h-60 list-disc space-y-0.5 overflow-y-auto pl-4 text-grey-600">{r.lines.map((l, i) => <li key={i} className={l.startsWith("위반:") ? "text-red" : undefined}>{l}</li>)}</ul>}
      {r.auditWarning && <p className="mt-1 text-red">{r.auditWarning}</p>}
    </div>
  );
}

function parseManual(text: string): { section: string; position: number; addKey: string }[] {
  return text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
    const [section, pos, key] = l.split(/\s+/);
    const position = Number(pos);
    if (!section || !Number.isInteger(position) || !key) throw new Error(`한 줄은 "섹션 위치 후보키" 형식이어야 합니다: ${l}`);
    return { section, position, addKey: key };
  });
}

function NewVersionSection({ ov, onDone }: { ov: ApNewVersionOverview; onDone: () => void }) {
  const published = ov.sets.filter((s) => s.status === "published");
  const [sourceId, setSourceId] = useState("");
  const [planFile, setPlanFile] = useState("");
  const [manual, setManual] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof apNewVersionPreviewAction>> | null>(null);
  const [result, setResult] = useState<ApResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = () => { setPreview(null); setResult(null); setConfirm(false); setError(null); };
  const src = () => (planFile ? { planFile } : { manual: parseManual(manual) });
  const run = async (execute: boolean) => {
    setBusy(true); setError(null);
    try {
      if (execute) { const r = await apNewVersionDraftAction({ sourceSetId: sourceId, planHash: preview?.planHash ?? null, ...src() }); setResult(r); setPreview(null); setConfirm(false); onDone(); }
      else { const r = await apNewVersionPreviewAction({ sourceSetId: sourceId, ...src() }); setPreview(r); setResult(null); setConfirm(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); }
    finally { setBusy(false); }
  };
  const canPreview = !!sourceId && (!!planFile || manual.trim().length > 0) && !busy;
  const canRun = ov.target.canWrite && !!preview?.planHash && !preview.blocked && confirm && !busy;
  const p = preview?.preview;
  return (
    <div className="rounded border border-grey-200 p-3" data-testid="ap-nv-create">
      <h4 className="text-[13px] font-bold">① 새 버전 초안 만들기</h4>
      <p className="mt-0.5 text-xs text-grey-500">공개 중인 세트와 같은 계열에 다음 버전 초안을 만들고 선택한 칸만 바꿉니다. 이전 공개본(v1)과 기존 응시·답안·결과는 바뀌지 않으며, 초안은 공개하기 전까지 학생에게 보이지 않습니다.</p>
      {published.length === 0 ? <p className="mt-2 text-xs text-grey-400">공개 중인 AP 세트가 없습니다.</p> : (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
            <label className="flex flex-col gap-0.5">공개 세트
              <select className="min-h-9 rounded border border-grey-300 px-2" value={sourceId} onChange={(e) => { setSourceId(e.target.value); reset(); }}>
                <option value="">선택</option>
                {published.map((s) => <option key={s.id} value={s.id}>{s.name} v{s.versionNo} ({TIER_KO[s.accessTier]})</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">교체 계획 파일
              <select className="min-h-9 rounded border border-grey-300 px-2" value={planFile} onChange={(e) => { setPlanFile(e.target.value); reset(); }}>
                <option value="">(직접 입력)</option>
                {ov.plans.map((f) => <option key={f.file} value={f.file}>{f.file} — {f.set} · {f.swapCount}건</option>)}
              </select>
            </label>
          </div>
          {!planFile && (
            <label className="mt-2 flex flex-col gap-0.5 text-xs">직접 교체 입력(한 줄에 "섹션 위치 새 후보키", 예: ap_mc_a 12 s1-graph-ab-final:ap_calculus_ab-m01-k0)
              <textarea className="min-h-20 rounded border border-grey-300 p-2 font-mono" value={manual} onChange={(e) => { setManual(e.target.value); reset(); }} />
            </label>
          )}
          {ov.plans.length === 0 && <p className="mt-1 text-xs text-grey-400">저장소에 교체 계획 파일(data/ap/stock/*swap-plan*.json)이 없습니다. 직접 입력하세요.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!canPreview} onClick={() => run(false)} className="min-h-9 rounded border border-grey-300 px-3 text-xs font-bold disabled:opacity-50">{busy ? "처리 중..." : "미리보기(검증)"}</button>
            <label className="flex items-center gap-1 text-xs text-grey-600"><input type="checkbox" checked={confirm} disabled={!preview?.planHash || !!preview?.blocked} onChange={(e) => setConfirm(e.target.checked)} />미리보기 결과를 확인했습니다</label>
            <button type="button" disabled={!canRun} onClick={() => run(true)} title={ov.target.canWrite ? undefined : "이 대상에는 쓸 수 없습니다"} className="min-h-9 rounded bg-ink px-3 text-xs font-bold text-white disabled:opacity-40">새 버전 초안 만들기</button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {preview && <ResultView r={preview} testid="ap-nv-preview" />}
      {p && (
        <div className="mt-2 overflow-x-auto" data-testid="ap-nv-composition">
          <table className="w-full min-w-[480px] text-xs">
            <thead><tr className="text-left text-grey-500"><th className="py-1 pr-2" /><th className="py-1 pr-2">MC</th><th className="py-1 pr-2">FRQ</th><th className="py-1 pr-2">계산기 불가/필수</th><th className="py-1">단원별 MC</th></tr></thead>
            <tbody>
              {([["구성 전(v" + p.source.versionNo + ")", p.before], ["구성 후(v" + p.newVersionNo + ")", p.after]] as const).map(([label, c]) => (
                <tr key={label} className="border-t border-grey-100"><td className="py-1 pr-2 font-bold">{label}</td><td className="py-1 pr-2">{c.mc}</td><td className="py-1 pr-2">{c.frq}</td><td className="py-1 pr-2">{c.calculator.not_allowed}/{c.calculator.required}</td><td className="py-1">{Object.entries(c.unitCounts).sort((a, b) => Number(a[0]) - Number(b[0])).map(([u, n]) => `${u}:${n}`).join(" ")}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-grey-600" data-testid="ap-nv-attempts">기존 응시 {p.attempts.total}건은 v{p.source.versionNo} 에 그대로 남습니다.</p>
        </div>
      )}
      {result && <ResultView r={result} testid="ap-nv-result" />}
    </div>
  );
}

function PublishSection({ ov, onDone }: { ov: ApNewVersionOverview; onDone: () => void }) {
  const drafts = ov.sets.filter((s) => s.status === "draft" && s.versionNo >= 2);
  const [id, setId] = useState("");
  const [preview, setPreview] = useState<ApResult | null>(null);
  const [result, setResult] = useState<ApResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (execute: boolean) => {
    setBusy(true); setError(null);
    try {
      const r = await apNewVersionPublishAction({ newSetId: id, execute, planHash: execute ? preview?.planHash ?? null : null });
      if (execute) { setResult(r); setPreview(null); setConfirm(false); onDone(); } else { setPreview(r); setResult(null); setConfirm(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded border border-grey-200 p-3" data-testid="ap-nv-publish">
      <h4 className="text-[13px] font-bold">② 새 버전 공개(별도 단계)</h4>
      <p className="mt-0.5 text-xs text-grey-500">초안을 검토한 뒤 공개합니다. 이전 공개본 보관과 새 버전 공개가 한 트랜잭션으로 처리되고, 공개 범위(무료/튜터링)는 이전 공개본에서 이어받습니다.</p>
      {drafts.length === 0 ? <p className="mt-2 text-xs text-grey-400">공개 대기 중인 새 버전 초안이 없습니다.</p> : (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <select aria-label="공개할 초안" className="min-h-9 rounded border border-grey-300 px-2" value={id} onChange={(e) => { setId(e.target.value); setPreview(null); setResult(null); setConfirm(false); }}>
            <option value="">선택</option>
            {drafts.map((s) => <option key={s.id} value={s.id}>{s.name} v{s.versionNo} 초안</option>)}
          </select>
          <button type="button" disabled={!id || busy} onClick={() => run(false)} className="min-h-9 rounded border border-grey-300 px-3 font-bold disabled:opacity-50">미리보기</button>
          <label className="flex items-center gap-1 text-grey-600"><input type="checkbox" checked={confirm} disabled={!preview?.planHash || !!preview?.blocked} onChange={(e) => setConfirm(e.target.checked)} />확인했습니다</label>
          <button type="button" disabled={!ov.target.canWrite || !confirm || !preview?.planHash || busy} onClick={() => run(true)} className="min-h-9 rounded bg-ink px-3 font-bold text-white disabled:opacity-40">새 버전 공개</button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
      {preview && <ResultView r={preview} testid="ap-nv-publish-preview" />}
      {result && <ResultView r={result} testid="ap-nv-publish-result" />}
    </div>
  );
}

function TierRow({ s, canWrite, onDone }: { s: ApSetRow; canWrite: boolean; onDone: () => void }) {
  const cur: Tier = s.status === "published" ? s.accessTier : s.plannedTier ?? s.accessTier;
  const other: Tier = cur === "free" ? "tutoring" : "free";
  const [preview, setPreview] = useState<ApResult | null>(null);
  const [result, setResult] = useState<ApResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (execute: boolean) => {
    setBusy(true); setError(null);
    try {
      const r = await apSetAccessTierAction({ setId: s.id, tier: other, execute, planHash: execute ? preview?.planHash ?? null : null });
      if (execute) { setResult(r); setPreview(null); setConfirm(false); onDone(); } else { setPreview(r); setResult(null); setConfirm(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); }
    finally { setBusy(false); }
  };
  return (
    <tr className="border-t border-grey-100 align-top" data-testid={`ap-tier-row-${s.id}`}>
      <td className="py-1 pr-2">{s.name} v{s.versionNo}</td>
      <td className="py-1 pr-2">{s.status === "published" ? "공개 중" : "초안"}</td>
      <td className="py-1 pr-2 font-bold" data-testid="ap-tier-current">{TIER_KO[cur]}{s.status === "draft" ? "(공개 때 적용)" : ""}</td>
      <td className="py-1">
        <button type="button" disabled={busy} onClick={() => run(false)} className="min-h-9 rounded border border-grey-300 px-3 font-bold disabled:opacity-50">{TIER_KO[other]}(으)로 변경 미리보기</button>
        {preview && (
          <div className="mt-1">
            <ResultView r={preview} testid="ap-tier-preview" />
            <label className="mt-1 flex items-center gap-1 text-grey-600"><input type="checkbox" checked={confirm} disabled={!preview.planHash || !!preview.blocked} onChange={(e) => setConfirm(e.target.checked)} />확인했습니다</label>
            <button type="button" disabled={!canWrite || !confirm || !preview.planHash || busy} onClick={() => run(true)} className="mt-1 min-h-9 rounded bg-ink px-3 font-bold text-white disabled:opacity-40">{TIER_KO[other]}(으)로 적용</button>
          </div>
        )}
        {result && <ResultView r={result} testid="ap-tier-result" />}
        {error && <p className="mt-1 text-red" role="alert">{error}</p>}
      </td>
    </tr>
  );
}

export default function ApNewVersionPanel({ canWrite }: { canWrite: boolean }) {
  const [ov, setOv] = useState<ApNewVersionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { getApNewVersionOverviewAction().then(setOv).catch(() => setError("AP 세트 정보를 불러오지 못했습니다.")); }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <p className="text-sm text-red">{error}</p>;
  if (!ov) return <p className="text-sm text-grey-500">AP 세트 불러오는 중...</p>;
  const view = { ...ov, target: { ...ov.target, canWrite: ov.target.canWrite && canWrite } };
  return (
    <section className="space-y-3" data-testid="ap-new-version-panel">
      <h3 className="text-sm font-bold">AB/AP 세트 새 버전</h3>
      <NewVersionSection ov={view} onDone={load} />
      <PublishSection ov={view} onDone={load} />
      <div className="rounded border border-grey-200 p-3" data-testid="ap-tier-panel">
        <h4 className="text-[13px] font-bold">AP 세트 공개 범위(무료 ↔ 튜터링)</h4>
        <p className="mt-0.5 text-xs text-grey-500">공개 범위만 바꿉니다. 문항·구성·응시·답안·결과는 바뀌지 않습니다. 초안은 공개 때 적용할 범위를 정해 둡니다.</p>
        {ov.sets.length === 0 ? <p className="mt-2 text-xs text-grey-400">AP 세트가 없습니다.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs"><thead><tr className="text-left text-grey-500"><th className="py-1 pr-2">세트</th><th className="py-1 pr-2">상태</th><th className="py-1 pr-2">공개 범위</th><th className="py-1">변경</th></tr></thead>
              <tbody>{ov.sets.map((s) => <TierRow key={s.id} s={s} canWrite={view.target.canWrite} onDone={load} />)}</tbody></table>
          </div>
        )}
      </div>
    </section>
  );
}
