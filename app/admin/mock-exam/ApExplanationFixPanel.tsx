"use client";

import { useEffect, useState } from "react";
import { apExplanationFixExecuteAction, apExplanationFixPreviewAction, apRefreshDraftAction, type ApFixResult } from "../ap-explanation-fix-actions";
import { getApNewVersionOverviewAction, type ApSetRow } from "../ap-new-version-actions";

// 'AP 설명 수정 새 버전'(2026-10-12). 해설·참고 답안의 원문 TeX 를 고친다. 공개된 문제 버전과 세트 스냅샷은 불변이므로 새 버전으로만 고친다.
// ① 문제 단위: 교정 파일 미리보기 → 확인 체크 → 새 버전(해설만 다름) 공개·연결. ② 세트 단위: 교정된 버전을 쓰는 v+1 초안 만들기 → (기존 '새 버전 공개'로 공개).
// 본문·선지·정답·그림, 응시·답안·결과, 이전 공개본은 바뀌지 않는다. 문서: docs/ap/tex-audit.md

function ResultView({ r, testid }: { r: ApFixResult; testid: string }) {
  return (
    <div className="mt-2 rounded border border-grey-200 bg-grey-50 p-2 text-xs" data-testid={testid}>
      <p className="font-bold">{r.mode === "execute" ? (r.executed ? "실행 완료" : "실행 안 됨") : "미리보기"}{r.blocked ? ` — ${r.blocked}` : ""}</p>
      {r.lines.length > 0 && <ul className="mt-1 max-h-60 list-disc space-y-0.5 overflow-y-auto pl-4 text-grey-600">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {r.auditWarning && <p className="mt-1 text-red">{r.auditWarning}</p>}
    </div>
  );
}

export default function ApExplanationFixPanel({ canWrite }: { canWrite: boolean }) {
  const [preview, setPreview] = useState<ApFixResult | null>(null);
  const [result, setResult] = useState<ApFixResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<ApSetRow[]>([]);
  const [setId, setSetId] = useState("");
  const [rPreview, setRPreview] = useState<ApFixResult | null>(null);
  const [rResult, setRResult] = useState<ApFixResult | null>(null);
  const [rConfirm, setRConfirm] = useState(false);

  useEffect(() => { getApNewVersionOverviewAction().then((o) => setSets(o.sets.filter((s) => s.status === "published"))).catch(() => setSets([])); }, []);

  const guard = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "실패했습니다."); } finally { setBusy(false); } };
  const canRun = canWrite && !!preview?.planHash && !preview.blocked && confirm && !busy;
  const canRefresh = canWrite && !!rPreview?.planHash && !rPreview.blocked && rConfirm && !busy;

  return (
    <div className="mt-4 rounded border border-grey-200 p-3" data-testid="ap-fix">
      <h4 className="text-[13px] font-bold">AP 설명 수정 새 버전</h4>
      <p className="mt-0.5 text-xs text-grey-500">해설·참고 답안에 글자 그대로 보이는 수식(\frac, \int …)을 고칩니다. 공개된 문제·세트는 수정할 수 없어 새 버전으로만 고치며, 본문·선지·정답·그림과 기존 응시·답안·결과는 바뀌지 않습니다.</p>
      {!canWrite && <p className="mt-1 text-xs text-red">이 환경은 쓰기가 허용되지 않아 미리보기만 가능합니다.</p>}
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}

      <div className="mt-3 rounded border border-grey-200 p-2" data-testid="ap-fix-problems">
        <p className="text-xs font-bold">① 문제 단위: 해설 교정 새 버전</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" disabled={busy} className="min-h-9 rounded border border-grey-300 px-3 font-bold disabled:opacity-50" onClick={() => guard(async () => { setPreview(await apExplanationFixPreviewAction()); setResult(null); setConfirm(false); })}>미리보기(읽기 전용)</button>
          <label className="flex items-center gap-1"><input type="checkbox" checked={confirm} disabled={!preview?.planHash} onChange={(e) => setConfirm(e.target.checked)} />미리보기 내용을 확인했습니다</label>
          <button type="button" disabled={!canRun} className="min-h-9 rounded bg-ink px-3 font-bold text-white disabled:opacity-40" onClick={() => guard(async () => { const r = await apExplanationFixExecuteAction({ planHash: preview?.planHash ?? null }); setResult(r); setPreview(null); setConfirm(false); })}>설명 수정 새 버전 실행</button>
        </div>
        {preview && <ResultView r={preview} testid="ap-fix-preview" />}
        {result && <ResultView r={result} testid="ap-fix-result" />}
      </div>

      <div className="mt-3 rounded border border-grey-200 p-2" data-testid="ap-fix-sets">
        <p className="text-xs font-bold">② 세트 단위: 교정 반영 새 버전 초안</p>
        <p className="mt-0.5 text-xs text-grey-500">①을 마친 뒤, 공개 중인 세트에서 교정된 문제 버전을 쓰는 다음 버전 초안을 만듭니다. 공개는 위 'AB/AP 세트 새 버전'의 '새 버전 공개'로 합니다.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <select aria-label="공개 세트" className="min-h-9 rounded border border-grey-300 px-2" value={setId} onChange={(e) => { setSetId(e.target.value); setRPreview(null); setRResult(null); setRConfirm(false); }}>
            <option value="">공개 세트 선택</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{s.name} v{s.versionNo}</option>)}
          </select>
          <button type="button" disabled={!setId || busy} className="min-h-9 rounded border border-grey-300 px-3 font-bold disabled:opacity-50" onClick={() => guard(async () => { setRPreview(await apRefreshDraftAction({ sourceSetId: setId, execute: false })); setRResult(null); setRConfirm(false); })}>미리보기</button>
          <label className="flex items-center gap-1"><input type="checkbox" checked={rConfirm} disabled={!rPreview?.planHash} onChange={(e) => setRConfirm(e.target.checked)} />확인했습니다</label>
          <button type="button" disabled={!canRefresh} className="min-h-9 rounded bg-ink px-3 font-bold text-white disabled:opacity-40" onClick={() => guard(async () => { const r = await apRefreshDraftAction({ sourceSetId: setId, execute: true, planHash: rPreview?.planHash ?? null }); setRResult(r); setRPreview(null); setRConfirm(false); })}>새 버전 초안 만들기</button>
        </div>
        {rPreview && <ResultView r={rPreview} testid="ap-fix-set-preview" />}
        {rResult && <ResultView r={rResult} testid="ap-fix-set-result" />}
      </div>
    </div>
  );
}
