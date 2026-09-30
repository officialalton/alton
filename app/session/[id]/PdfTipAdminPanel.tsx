"use client";

import { useCallback, useEffect, useState } from "react";
import { getAssetVersionUrlAction } from "@/app/materials/asset-actions";
import {
  copyPdfTipPageAction,
  copyPdfTipsMappedAction,
  getPdfTipReviewStateAction,
  listPdfTipSourceVersionsAction,
  markPdfTipPageReviewedAction,
  markPdfTipVersionReviewedAction,
  type CopyTipsResult,
  type PdfTipReviewState,
  type PdfTipVersionOption,
} from "./pdf-tip-actions";
import { PdfPageThumbnail } from "./PdfMaterialViewer";
import { duplicateTargets, identityMapping, setTarget, shiftFrom, swapTargets, type TipMapRow } from "./pdf-tip-mapping";

// 관리자 자료 화면의 '팁 편집' 보조 패널 (2026-10-01).
//   검토 전 상태(이전 버전에서 불러온 팁은 확인 전까지 선생님에게 숨김) · 쪽수 경고 · 쪽별/전체 확인
//   같은 버전 안 쪽 복사·이동 · 이전 버전에서 불러오기(쪽 매핑 수동 조정).

export default function PdfTipAdminPanel({
  docId,
  versionId,
  page,
  pageCount,
  refreshSignal,
  onChanged,
}: {
  docId: string;
  versionId: string;
  page: number;
  pageCount: number;
  /** 저장·가져오기 뒤 올라가는 값 — 바뀌면 상태를 다시 읽는다. */
  refreshSignal: number;
  /** 확인·복사·불러오기로 팁이 바뀌었을 때(화면의 현재 쪽을 다시 읽게 한다). */
  onChanged: () => void;
}) {
  const [state, setState] = useState<PdfTipReviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [targetPage, setTargetPage] = useState("");

  const refresh = useCallback(async () => {
    const r = await getPdfTipReviewStateAction(versionId);
    if (r.ok) {
      setState(r.state);
      setError(null);
    } else setError(r.error);
  }, [versionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, refreshSignal]);

  const pending = state?.pendingPages ?? [];
  const pageIsPending = pending.includes(page);
  const countChanged = Boolean(state?.copiedFromVersionId && state.fromPageCount !== null && state.fromPageCount !== state.toPageCount);

  async function confirmPage() {
    const r = await markPdfTipPageReviewedAction(versionId, page);
    if (!r.ok) return setError(r.error ?? "확인 처리하지 못했습니다.");
    setNotice(`${page}쪽을 확인했습니다. 선생님에게 공개됩니다.`);
    await refresh();
    onChanged();
  }
  async function confirmAll() {
    const r = await markPdfTipVersionReviewedAction(versionId);
    if (!r.ok) return setError(r.error ?? "전체 확인 처리하지 못했습니다.");
    setNotice(`${r.count ?? 0}쪽을 확인했습니다. 선생님에게 공개됩니다.`);
    await refresh();
    onChanged();
  }
  async function moveOrCopy(move: boolean) {
    const to = Number(targetPage);
    if (!Number.isInteger(to) || to < 1 || to > pageCount) return setError(`1~${pageCount} 사이의 쪽 번호를 입력하세요.`);
    if (to === page) return setError("같은 쪽으로는 옮길 수 없습니다.");
    let r = await copyPdfTipPageAction({ versionId, fromPage: page, toPage: to, move, overwrite: false });
    if (r.ok && r.status === "needs_confirmation") {
      if (!window.confirm(`${to}쪽에 이미 팁이 있습니다. 덮어쓸까요?`)) return;
      r = await copyPdfTipPageAction({ versionId, fromPage: page, toPage: to, move, overwrite: true });
    }
    if (!r.ok) return setError(r.error);
    if (r.status === "empty") return setError("이 쪽에는 옮길 팁이 없습니다.");
    setError(null);
    setNotice(`${page}쪽의 팁을 ${to}쪽으로 ${move ? "이동" : "복사"}했습니다.`);
    await refresh();
    onChanged();
  }

  return (
    <div className="border border-grey-200 rounded-lg p-3 mb-3 text-[12.5px] space-y-2" data-testid="pdf-tip-admin-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold" style={{ color: "#7B3FA0" }}>교사용 팁 편집</span>
        <span className="text-grey-500">{state ? `팁이 있는 쪽 ${state.tipPages.length}개` : "불러오는 중…"}</span>
        {state && pending.length > 0 && (
          <span className="font-bold text-red" data-testid="pdf-tip-pending-count">
            검토 전 {pending.length}쪽 — 확인하기 전에는 선생님에게 보이지 않습니다
          </span>
        )}
      </div>

      {countChanged && state && (
        <p className="text-[12px] font-semibold text-red bg-red-bg rounded px-2 py-1" data-testid="pdf-tip-count-warning">
          쪽수가 달라졌습니다. 페이지가 밀렸는지 확인하세요. (이전 {state.fromPageCount}쪽 → 새 {state.toPageCount}쪽)
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {pageIsPending && (
          <>
            <span className="text-[11.5px] font-bold text-red">이 쪽은 검토 전</span>
            <button type="button" onClick={() => void confirmPage()} className="text-[12px] font-bold px-2 py-1 rounded bg-ink text-white">
              이 쪽 확인
            </button>
          </>
        )}
        {pending.length > 0 && (
          <button type="button" onClick={() => void confirmAll()} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">
            전체 확인 ({pending.length}쪽)
          </button>
        )}
        <span className="text-grey-500 ml-auto">이 쪽 팁을</span>
        <input
          aria-label="옮길 쪽 번호"
          inputMode="numeric"
          value={targetPage}
          onChange={(e) => setTargetPage(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="쪽"
          className="w-14 border border-grey-200 rounded px-1.5 py-1"
        />
        <button type="button" onClick={() => void moveOrCopy(false)} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">쪽으로 복사</button>
        <button type="button" onClick={() => void moveOrCopy(true)} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">쪽으로 이동</button>
        <button type="button" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">
          이전 버전에서 팁 불러오기
        </button>
      </div>

      {importOpen && (
        <PdfTipImportPanel
          docId={docId}
          versionId={versionId}
          toPageCount={pageCount}
          onImported={async () => {
            await refresh();
            onChanged();
          }}
        />
      )}
      {notice && <p className="text-[12px] text-green" role="status">{notice}</p>}
      {error && <p className="text-[12px] text-red" role="alert">{error}</p>}
    </div>
  );
}

function PdfTipImportPanel({
  docId,
  versionId,
  toPageCount,
  onImported,
}: {
  docId: string;
  versionId: string;
  toPageCount: number;
  onImported: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<PdfTipVersionOption[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [rows, setRows] = useState<TipMapRow[] | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [shiftPage, setShiftPage] = useState("1");
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await listPdfTipSourceVersionsAction(docId, versionId);
      if (cancelled) return;
      if (r.ok) setVersions(r.versions);
      else setError(r.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [docId, versionId]);

  async function chooseSource(id: string) {
    setSourceId(id);
    setRows(null);
    setSummary(null);
    setError(null);
    setSourceUrl(null);
    if (!id) return;
    const [st, url] = await Promise.all([getPdfTipReviewStateAction(id), getAssetVersionUrlAction(id)]);
    if (!st.ok) return setError(st.error);
    setSourceCount(st.state.toPageCount);
    setRows(identityMapping(st.state.tipPages, toPageCount));
    if (url.ok) setSourceUrl(url.url);
  }

  const dups = rows ? duplicateTargets(rows) : [];
  const toOptions = Array.from({ length: toPageCount }, (_, i) => i + 1);

  async function run(overwrite: boolean) {
    if (!rows || dups.length) return;
    setBusy(true);
    setError(null);
    let r: CopyTipsResult = await copyPdfTipsMappedAction({ fromVersionId: sourceId, toVersionId: versionId, mapping: rows, overwrite });
    if (r.ok && r.status === "needs_confirmation") {
      const ok = window.confirm(`${r.conflicts.join(", ")}쪽에 이미 팁이 있습니다. 덮어쓸까요?`);
      if (!ok) {
        setBusy(false);
        return setSummary("덮어쓰기를 취소했습니다. 아무것도 바뀌지 않았습니다.");
      }
      r = await copyPdfTipsMappedAction({ fromVersionId: sourceId, toVersionId: versionId, mapping: rows, overwrite: true });
    }
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSummary(
      `복사 ${r.copied.length}쪽${r.copied.length ? `(${r.copied.join(", ")})` : ""} · 이미 가져와 건너뜀 ${r.skipped.length}쪽 · 덮어쓴 쪽 ${r.conflicts.length}쪽. 불러온 팁은 검토 전 상태라 확인하기 전에는 선생님에게 보이지 않습니다.`
    );
    await onImported();
  }

  return (
    <div className="border-t border-grey-200 pt-2 space-y-2" data-testid="pdf-tip-import-panel">
      {!versions && !error && <p className="text-grey-500">이전 버전을 불러오는 중…</p>}
      {versions && versions.length === 0 && <p className="text-grey-500">가져올 이전 버전이 없습니다.</p>}
      {versions && versions.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="font-semibold">가져올 버전</span>
          <select value={sourceId} onChange={(e) => void chooseSource(e.target.value)} className="border border-grey-200 rounded px-1.5 py-1">
            <option value="">선택</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber}{v.pageCount ? ` · ${v.pageCount}쪽` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {rows && rows.length === 0 && <p className="text-grey-500">그 버전에는 불러올 팁이 없습니다.</p>}
      {rows && rows.length > 0 && (
        <>
          {sourceCount !== toPageCount && (
            <p className="text-[12px] font-semibold text-red">쪽수가 달라졌습니다. 페이지가 밀렸는지 확인하세요. (이전 {sourceCount}쪽 → 새 {toPageCount}쪽)</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-semibold">빠른 조작</span>
            <input aria-label="밀기 시작 쪽" inputMode="numeric" value={shiftPage} onChange={(e) => setShiftPage(e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border border-grey-200 rounded px-1.5 py-1" />
            <span>쪽부터</span>
            <button type="button" onClick={() => setRows((r) => (r ? shiftFrom(r, Number(shiftPage) || 1, 1, toPageCount) : r))} className="font-bold px-2 py-1 rounded border border-grey-200">+1 밀기</button>
            <button type="button" onClick={() => setRows((r) => (r ? shiftFrom(r, Number(shiftPage) || 1, -1, toPageCount) : r))} className="font-bold px-2 py-1 rounded border border-grey-200">-1 밀기</button>
            <span className="ml-2">맞바꾸기</span>
            <input aria-label="맞바꿀 쪽 A" inputMode="numeric" value={swapA} onChange={(e) => setSwapA(e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border border-grey-200 rounded px-1.5 py-1" />
            <input aria-label="맞바꿀 쪽 B" inputMode="numeric" value={swapB} onChange={(e) => setSwapB(e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border border-grey-200 rounded px-1.5 py-1" />
            <button type="button" onClick={() => setRows((r) => (r ? swapTargets(r, Number(swapA), Number(swapB)) : r))} className="font-bold px-2 py-1 rounded border border-grey-200">바꾸기</button>
            <button type="button" onClick={() => void chooseSource(sourceId)} className="px-2 py-1 rounded text-grey-500 underline">초기화</button>
          </div>

          <ul className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1" data-testid="pdf-tip-import-rows">
            {rows.map((row) => (
              <li key={row.from} className="flex items-center gap-2">
                <div className="w-[84px] flex-shrink-0">
                  {sourceUrl ? (
                    <PdfPageThumbnail url={sourceUrl} page={row.from} width={80} active={false} label={`옛 ${row.from}쪽 · 팁 있음`} onSelect={() => undefined} />
                  ) : (
                    <span className="text-[11px] text-grey-500">옛 {row.from}쪽 · 팁 있음</span>
                  )}
                </div>
                <span>→ 새</span>
                <select
                  aria-label={`옛 ${row.from}쪽의 대상 쪽`}
                  value={row.to ?? ""}
                  onChange={(e) => setRows((r) => (r ? setTarget(r, row.from, e.target.value === "" ? null : Number(e.target.value)) : r))}
                  className={"border rounded px-1.5 py-1 " + (row.to !== null && dups.includes(row.to) ? "border-red" : "border-grey-200")}
                >
                  <option value="">건너뛰기</option>
                  {toOptions.map((p) => (
                    <option key={p} value={p}>{p}쪽</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {dups.length > 0 && (
            <p className="text-[12px] font-semibold text-red" role="alert" data-testid="pdf-tip-dup-error">
              같은 대상 쪽({dups.join(", ")}쪽)으로 둘 이상 지정돼 실행할 수 없습니다. 대상을 바꾸거나 건너뛰세요.
            </p>
          )}
          <button
            type="button"
            disabled={busy || dups.length > 0 || rows.every((r) => r.to === null)}
            onClick={() => void run(false)}
            className="text-[12.5px] font-bold px-3 py-1.5 rounded bg-ink text-white disabled:opacity-50"
          >
            {busy ? "불러오는 중…" : "팁 불러오기"}
          </button>
        </>
      )}
      {summary && <p className="text-[12px] text-green" role="status" data-testid="pdf-tip-import-summary">{summary}</p>}
      {error && <p className="text-[12px] text-red" role="alert">{error}</p>}
    </div>
  );
}
