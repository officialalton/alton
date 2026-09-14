"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MaterialAsset } from "./material-data";
import type { MaterialLayerRole } from "./MaterialAnnotationLayers";
import { getAssetVersionUrlAction } from "@/app/materials/asset-actions";
import { nextPosition, pageCountOf, prevPosition, tableOfContents, type AssetPosition } from "./asset-navigation";
import PdfPageCanvas from "./PdfMaterialViewer";
import VideoMaterialPlayer from "./VideoMaterialPlayer";
import PdfPageAnnotationLayer, { type PdfPageAnnotationHandle } from "./PdfPageAnnotationLayer";

// 파일 자료(PDF·영상)를 순서대로 보는 뷰어 — 수업 준비·수업·과목 전체 보기가 같이 쓴다.
//
//   PDF   한 페이지씩. 목차·이전/다음·확대. 마지막 페이지의 다음은 다음 자료.
//   영상  같은 자리에서 재생. 다른 자료로 가면 정지(플레이어 언마운트).
//   필기  PDF 페이지마다(sessionId 가 있을 때만). 첫 버전은 **저장이 끝나기 전 이동을
//         잠깐 막는다** — 저장 실패면 미저장 상태와 다시 시도를 보여주고 이동하지 않는다.
//
// 자료 주소는 공개 버전(versionId)으로 받는 짧은 서명 URL 이다. 자료마다 한 번 받아 둔다.

export default function AssetMaterialViewer({
  assets,
  sessionId,
  curriculumDocIdOf,
  role,
  viewerUserId,
  initialPosition,
}: {
  assets: MaterialAsset[];
  /** 없으면 읽기 전용(과목 전체 보기·미리보기) — 필기 레이어를 두지 않는다. */
  sessionId?: string | null;
  curriculumDocIdOf?: (asset: MaterialAsset) => string;
  role: MaterialLayerRole;
  viewerUserId?: string;
  initialPosition?: AssetPosition;
}) {
  const [pos, setPos] = useState<AssetPosition>(initialPosition ?? { assetIndex: 0, page: 1 });
  const [zoom, setZoom] = useState(1);
  const [urls, setUrls] = useState<Record<string, { url: string; mimeType: string }>>({});
  const [urlError, setUrlError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendered, setRendered] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [fitWidth, setFitWidth] = useState(0);
  const [navError, setNavError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const layerRef = useRef<PdfPageAnnotationHandle | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const asset = assets[pos.assetIndex];

  // 서명 URL — 자료(버전)마다 한 번.
  useEffect(() => {
    if (!asset || urls[asset.versionId] || asset.unavailable) return;
    let cancelled = false;
    (async () => {
      const result = await getAssetVersionUrlAction(asset.versionId);
      if (cancelled) return;
      if (result.ok) {
        setUrls((prev) => ({ ...prev, [asset.versionId]: { url: result.url, mimeType: result.mimeType } }));
        setUrlError(null);
      } else {
        setUrlError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset, urls]);

  // 가로 맞춤 기준 — 프레임 너비.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFitWidth(Math.max(0, el.clientWidth - 2));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onRendered = useCallback((size: { width: number; height: number }) => {
    setRendered(size);
    setRenderError(null);
  }, []);
  const onError = useCallback((message: string) => setRenderError(message), []);

  /** 이동 전에 미저장 획을 저장한다. 실패하면 이동하지 않는다. */
  const guardedGo = useCallback(
    async (next: AssetPosition | null) => {
      if (!next) return;
      setNavError(null);
      const layer = layerRef.current;
      if (layer && layer.hasUnsaved()) {
        const ok = await layer.flush();
        if (!ok) {
          setNavError("저장되지 않은 필기가 있어 이동하지 않았습니다. 저장을 다시 시도한 뒤 이동하세요.");
          return;
        }
      }
      setRendered({ width: 0, height: 0 });
      setPos(next);
    },
    []
  );

  if (!asset) return null;

  const toc = tableOfContents(assets);
  const signed = urls[asset.versionId];
  const total = pageCountOf(asset);
  const docId = curriculumDocIdOf ? curriculumDocIdOf(asset) : asset.docId;
  const canAnnotate = Boolean(sessionId) && asset.kind === "pdf" && (role === "teacher" || role === "student");

  return (
    <div className="md:grid md:grid-cols-[220px_1fr]" data-testid="asset-material-viewer">
      <nav className="border-b md:border-b-0 md:border-r border-grey-200 p-4 md:sticky md:top-0 md:self-start md:h-[calc(100vh-56px)] md:overflow-y-auto flex md:block gap-1.5 overflow-x-auto">
        <div className="hidden md:block text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
          자료 목차
        </div>
        {toc.map((entry, i) => {
          const active =
            entry.position.assetIndex === pos.assetIndex && (entry.isPage ? entry.position.page === pos.page : false);
          return (
            <button
              key={i}
              onClick={() => void guardedGo(entry.position)}
              className={
                "md:w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] mb-0.5 whitespace-nowrap md:whitespace-normal flex-shrink-0 " +
                (entry.isPage ? "md:pl-6 " : "font-bold ") +
                (active ? "bg-red-bg text-red font-bold" : entry.isPage ? "text-grey-500 hover:bg-grey-100" : "text-ink")
              }
            >
              {entry.isPage ? entry.label : `${assets[entry.position.assetIndex].kind === "video" ? "▶ " : "📄 "}${entry.label}`}
            </button>
          );
        })}
      </nav>

      <div className="px-3 sm:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-[13px] font-bold text-ink">
            {asset.title}
            {asset.kind === "pdf" && <span className="text-grey-500 font-semibold ml-2">{pos.page} / {total}쪽</span>}
            {asset.kind === "video" && <span className="text-grey-500 font-semibold ml-2">영상</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {asset.kind === "pdf" && (
              <>
                <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">−</button>
                <span className="text-[11.5px] text-grey-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))} className="text-[12px] font-bold px-2 py-1 rounded border border-grey-200">＋</button>
              </>
            )}
            <button
              onClick={() => void guardedGo(prevPosition(assets, pos))}
              disabled={!prevPosition(assets, pos)}
              className="text-[12px] font-bold px-3 py-1 rounded border border-grey-200 disabled:opacity-40"
            >
              ← 이전
            </button>
            <button
              onClick={() => void guardedGo(nextPosition(assets, pos))}
              disabled={!nextPosition(assets, pos)}
              className="text-[12px] font-bold px-3 py-1 rounded border border-grey-200 disabled:opacity-40"
            >
              {asset.kind === "pdf" && pos.page >= total && nextPosition(assets, pos) ? "다음 자료 →" : "다음 →"}
            </button>
          </div>
        </div>

        {navError && <p className="text-[12.5px] text-red mb-2">{navError}</p>}
        {urlError && <p className="text-[12.5px] text-red mb-2">{urlError}</p>}
        {renderError && <p className="text-[12.5px] text-red mb-2">{renderError}</p>}
        {asset.unavailable && (
          <p className="text-[12.5px] text-grey-500 mb-2">이 자료의 고정 사본이 기록되지 않아 표시할 수 없습니다.</p>
        )}

        <div ref={frameRef} className="relative w-full overflow-auto">
          {asset.kind === "video" ? (
            signed ? <VideoMaterialPlayer url={signed.url} mimeType={signed.mimeType} title={asset.title} /> : <p className="text-[12.5px] text-grey-500">자료를 불러오는 중…</p>
          ) : signed ? (
            <div className="relative inline-block" style={{ minWidth: rendered.width || undefined }}>
              <PdfPageCanvas
                url={signed.url}
                page={pos.page}
                zoom={zoom}
                fitWidth={fitWidth}
                onRendered={onRendered}
                onError={onError}
              />
              {canAnnotate && sessionId && (
                <PdfPageAnnotationLayer
                  key={`${asset.versionId}:${pos.page}`}
                  ref={layerRef}
                  target={{ sessionId, curriculumDocId: docId, curriculumDocVersionId: asset.versionId, pageNumber: pos.page }}
                  role={role}
                  viewerUserId={viewerUserId}
                  width={rendered.width}
                  height={rendered.height}
                  onSaveStateChange={setSaveState}
                />
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-grey-500">자료를 불러오는 중…</p>
          )}
        </div>
        {saveState === "error" && (
          <p className="text-[12px] text-red mt-2">필기가 저장되지 않았습니다. 연결을 확인하고 다시 시도하세요.</p>
        )}
      </div>
    </div>
  );
}
