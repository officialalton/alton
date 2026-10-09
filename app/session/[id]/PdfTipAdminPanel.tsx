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
    if (!r.ok) return setError(r.error ?? "Couldn't mark as reviewed.");
    setNotice(`Page ${page} reviewed. It is now visible to teachers.`);
    await refresh();
    onChanged();
  }
  async function confirmAll() {
    const r = await markPdfTipVersionReviewedAction(versionId);
    if (!r.ok) return setError(r.error ?? "Couldn't mark all pages as reviewed.");
    setNotice(`${r.count ?? 0} ${(r.count ?? 0) === 1 ? "page" : "pages"} reviewed. They are now visible to teachers.`);
    await refresh();
    onChanged();
  }
  async function moveOrCopy(move: boolean) {
    const to = Number(targetPage);
    if (!Number.isInteger(to) || to < 1 || to > pageCount) return setError(`Enter a page number between 1 and ${pageCount}.`);
    if (to === page) return setError("Can't move to the same page.");
    let r = await copyPdfTipPageAction({ versionId, fromPage: page, toPage: to, move, overwrite: false });
    if (r.ok && r.status === "needs_confirmation") {
      if (!window.confirm(`Page ${to} already has tips. Overwrite them?`)) return;
      r = await copyPdfTipPageAction({ versionId, fromPage: page, toPage: to, move, overwrite: true });
    }
    if (!r.ok) return setError(r.error);
    if (r.status === "empty") return setError("This page has no tips to move.");
    setError(null);
    setNotice(`${move ? "Moved" : "Copied"} tips from page ${page} to page ${to}.`);
    await refresh();
    onChanged();
  }

  return (
    <div className="border border-grey-200 rounded-lg p-3 mb-3 text-[12.5px] space-y-2" data-testid="pdf-tip-admin-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold" style={{ color: "#7B3FA0" }}>Teacher tips editor</span>
        <span className="text-grey-500">{state ? `${state.tipPages.length} ${state.tipPages.length === 1 ? "page" : "pages"} with tips` : "Loading…"}</span>
        {state && pending.length > 0 && (
          <span className="font-bold text-red" data-testid="pdf-tip-pending-count">
            {pending.length} unreviewed {pending.length === 1 ? "page" : "pages"} — hidden from teachers until reviewed
          </span>
        )}
      </div>

      {countChanged && state && (
        <p className="text-[12px] font-semibold text-red bg-red-bg rounded px-2 py-1" data-testid="pdf-tip-count-warning">
          Page count changed. Check whether pages have shifted. (previous: {state.fromPageCount} pages → new: {state.toPageCount} pages)
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {pageIsPending && (
          <>
            <span className="text-[11.5px] font-bold text-red">This page is unreviewed</span>
            <button type="button" onClick={() => void confirmPage()} className="text-[12px] font-bold px-2 py-1 rounded bg-ink text-white">
              Mark page reviewed
            </button>
          </>
        )}
        {pending.length > 0 && (
          <button type="button" onClick={() => void confirmAll()} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">
            Mark all reviewed ({pending.length})
          </button>
        )}
        <span className="text-grey-500 ml-auto">Tips on this page:</span>
        <input
          aria-label="Target page number"
          inputMode="numeric"
          value={targetPage}
          onChange={(e) => setTargetPage(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Page"
          className="w-14 border border-grey-200 rounded px-1.5 py-1"
        />
        <button type="button" onClick={() => void moveOrCopy(false)} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">Copy to page</button>
        <button type="button" onClick={() => void moveOrCopy(true)} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">Move to page</button>
        <button type="button" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">
          Import tips from a previous version
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
      const ok = window.confirm(`${r.conflicts.length === 1 ? "Page" : "Pages"} ${r.conflicts.join(", ")} already ${r.conflicts.length === 1 ? "has" : "have"} tips. Overwrite them?`);
      if (!ok) {
        setBusy(false);
        return setSummary("Overwrite cancelled. Nothing was changed.");
      }
      r = await copyPdfTipsMappedAction({ fromVersionId: sourceId, toVersionId: versionId, mapping: rows, overwrite: true });
    }
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSummary(
      `Copied ${r.copied.length} ${r.copied.length === 1 ? "page" : "pages"}${r.copied.length ? ` (${r.copied.join(", ")})` : ""} · skipped ${r.skipped.length} already imported · overwrote ${r.conflicts.length}. Imported tips are unreviewed and hidden from teachers until you mark them reviewed.`
    );
    await onImported();
  }

  return (
    <div className="border-t border-grey-200 pt-2 space-y-2" data-testid="pdf-tip-import-panel">
      {!versions && !error && <p className="text-grey-500">Loading previous versions…</p>}
      {versions && versions.length === 0 && <p className="text-grey-500">No previous versions to import from.</p>}
      {versions && versions.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="font-semibold">Source version</span>
          <select value={sourceId} onChange={(e) => void chooseSource(e.target.value)} className="border border-grey-200 rounded px-1.5 py-1">
            <option value="">Select</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber}{v.pageCount ? ` · ${v.pageCount} ${v.pageCount === 1 ? "page" : "pages"}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {rows && rows.length === 0 && <p className="text-grey-500">That version has no tips to import.</p>}
      {rows && rows.length > 0 && (
        <>
          {sourceCount !== toPageCount && (
            <p className="text-[12px] font-semibold text-red">Page count changed. Check whether pages have shifted. (previous: {sourceCount} pages → new: {toPageCount} pages)</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-semibold">Quick adjust</span>
            <input aria-label="Shift from page" inputMode="numeric" value={shiftPage} onChange={(e) => setShiftPage(e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border border-grey-200 rounded px-1.5 py-1" />
            <span>onward</span>
            <button type="button" onClick={() => setRows((r) => (r ? shiftFrom(r, Number(shiftPage) || 1, 1, toPageCount) : r))} className="font-bold px-2 py-1 rounded border border-grey-200">Shift +1</button>
            <button type="button" onClick={() => setRows((r) => (r ? shiftFrom(r, Number(shiftPage) || 1, -1, toPageCount) : r))} className="font-bold px-2 py-1 rounded border border-grey-200">Shift -1</button>
            <span className="ml-2">Swap</span>
            <input aria-label="Swap page A" inputMode="numeric" value={swapA} onChange={(e) => setSwapA(e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border border-grey-200 rounded px-1.5 py-1" />
            <input aria-label="Swap page B" inputMode="numeric" value={swapB} onChange={(e) => setSwapB(e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border border-grey-200 rounded px-1.5 py-1" />
            <button type="button" onClick={() => setRows((r) => (r ? swapTargets(r, Number(swapA), Number(swapB)) : r))} className="font-bold px-2 py-1 rounded border border-grey-200">Swap</button>
            <button type="button" onClick={() => void chooseSource(sourceId)} className="px-2 py-1 rounded text-grey-500 underline">Reset</button>
          </div>

          <ul className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1" data-testid="pdf-tip-import-rows">
            {rows.map((row) => (
              <li key={row.from} className="flex items-center gap-2">
                <div className="w-[84px] flex-shrink-0">
                  {sourceUrl ? (
                    <PdfPageThumbnail url={sourceUrl} page={row.from} width={80} active={false} label={`Old page ${row.from} · has tips`} onSelect={() => undefined} />
                  ) : (
                    <span className="text-[11px] text-grey-500">Old page {row.from} · has tips</span>
                  )}
                </div>
                <span>→ new</span>
                <select
                  aria-label={`Target page for old page ${row.from}`}
                  value={row.to ?? ""}
                  onChange={(e) => setRows((r) => (r ? setTarget(r, row.from, e.target.value === "" ? null : Number(e.target.value)) : r))}
                  className={"border rounded px-1.5 py-1 " + (row.to !== null && dups.includes(row.to) ? "border-red" : "border-grey-200")}
                >
                  <option value="">Skip</option>
                  {toOptions.map((p) => (
                    <option key={p} value={p}>Page {p}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {dups.length > 0 && (
            <p className="text-[12px] font-semibold text-red" role="alert" data-testid="pdf-tip-dup-error">
              Can&apos;t run: more than one source maps to the same target page ({dups.join(", ")}). Change the target or skip it.
            </p>
          )}
          <button
            type="button"
            disabled={busy || dups.length > 0 || rows.every((r) => r.to === null)}
            onClick={() => void run(false)}
            className="text-[12.5px] font-bold px-3 py-1.5 rounded bg-ink text-white disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import tips"}
          </button>
        </>
      )}
      {summary && <p className="text-[12px] text-green" role="status" data-testid="pdf-tip-import-summary">{summary}</p>}
      {error && <p className="text-[12px] text-red" role="alert">{error}</p>}
    </div>
  );
}
