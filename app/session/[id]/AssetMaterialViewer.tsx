"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MaterialAsset } from "./material-data";
import type { MaterialLayerRole } from "./MaterialAnnotationLayers";
import { getAssetVersionUrlAction } from "@/app/materials/asset-actions";
import { nextPosition, pageCountOf, prevPosition, type AssetPosition } from "./asset-navigation";
import PdfPageCanvas, { PdfPageThumbnail } from "./PdfMaterialViewer";
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
//
// 2026-09-14 UAT: 탭을 오갈 때마다 PDF 를 다시 받았다(컴포넌트가 내려가며 URL·위치를 잃음).
// 서명 URL 과 보던 위치는 모듈 수준에 두어 다시 마운트돼도 그대로 쓴다 — URL 이 같으면
// pdf.js 문서 캐시(PdfMaterialViewer)도 그대로 맞는다. 99쪽짜리 목차 대신 자료 목록 + 페이지
// 번호 입력으로 이동한다.

const signedUrlCache = new Map<string, { url: string; mimeType: string; expiresAt: number }>();
const positionMemory = new Map<string, AssetPosition>();

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
  const memoryKey = `${sessionId ?? "library"}:${assets.map((a) => a.versionId).join(",")}`;
  const [pos, setPosState] = useState<AssetPosition>(
    initialPosition ?? positionMemory.get(memoryKey) ?? { assetIndex: 0, page: 1 }
  );
  const setPos = useCallback(
    (next: AssetPosition) => {
      positionMemory.set(memoryKey, next);
      setPosState(next);
    },
    [memoryKey]
  );
  const [zoom, setZoom] = useState(1);
  const [urls, setUrls] = useState<Record<string, { url: string; mimeType: string }>>(() => {
    const now = Date.now();
    const initial: Record<string, { url: string; mimeType: string }> = {};
    for (const a of assets) {
      const hit = signedUrlCache.get(a.versionId);
      if (hit && hit.expiresAt > now) initial[a.versionId] = { url: hit.url, mimeType: hit.mimeType };
    }
    return initial;
  });
  const [urlError, setUrlError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendered, setRendered] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [fitWidth, setFitWidth] = useState(0);
  const [navError, setNavError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pageInput, setPageInput] = useState("");
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
        // 만료 1분 전까지만 재사용한다.
        signedUrlCache.set(asset.versionId, {
          url: result.url,
          mimeType: result.mimeType,
          expiresAt: Date.now() + Math.max(0, result.expiresInSeconds - 60) * 1000,
        });
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

  // 맞춤 기준 — 프레임 너비와, 프레임 위쪽부터 화면 아래까지의 높이(한 페이지가 다 들어오게).
  const [fitHeight, setFitHeight] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      setFitWidth(Math.max(0, el.clientWidth - 2));
      const top = el.getBoundingClientRect().top;
      setFitHeight(Math.max(0, window.innerHeight - top - 8));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
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
        {assets.map((a, i) => {
          const active = i === pos.assetIndex;
          const signedFor = urls[a.versionId];
          return (
            <div key={a.versionId} className="flex-shrink-0 md:block">
              <button
                onClick={() => void guardedGo({ assetIndex: i, page: 1 })}
                className={
                  "md:w-full text-left px-2.5 py-2 rounded-lg text-[13px] mb-0.5 whitespace-nowrap md:whitespace-normal " +
                  (active ? "text-red font-bold" : "text-ink hover:bg-grey-100")
                }
              >
                {a.kind === "video" ? "▶ " : "📄 "}
                {a.title}
                {a.kind === "pdf" && (
                  <span className="text-[11px] text-grey-500 ml-1.5">{pageCountOf(a)} pages</span>
                )}
              </button>
              {/* 현재 PDF 자료는 페이지 미리보기로 이동한다(보이는 것만 그린다). */}
              {active && a.kind === "pdf" && signedFor && (
                <div className="hidden md:block pl-1 pr-1 mb-2" data-testid="pdf-thumbnails">
                  {Array.from({ length: pageCountOf(a) }, (_, k) => k + 1).map((n) => (
                    <PdfPageThumbnail
                      key={n}
                      url={signedFor.url}
                      page={n}
                      width={150}
                      active={n === pos.page}
                      label={`Page ${n}`}
                      onSelect={() => void guardedGo({ assetIndex: i, page: n })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="relative px-2 sm:px-4 py-2">
        {/* 2026-09-14 UAT — 수업 중엔 교재가 화면을 채워야 한다. 제목·페이지·확대는 얇은 반투명
            띠로 위 왼쪽에, 이전/다음은 아래 양쪽 구석의 화살표로. 나머지는 전부 페이지. */}
        <div
          className="absolute top-3 left-4 sm:left-6 z-10 flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-white/60 shadow-sm rounded-lg px-2.5 py-1"
          data-testid="asset-viewer-controls"
        >
          <span className="text-[12px] font-bold text-ink max-w-[220px] truncate" title={asset.title}>
            {asset.title}
          </span>
          {asset.kind === "pdf" && (
            <form
              className="flex items-center gap-1 text-grey-500 font-semibold text-[12px]"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(pageInput);
                if (Number.isInteger(n) && n >= 1 && n <= total) void guardedGo({ assetIndex: pos.assetIndex, page: n });
                setPageInput("");
              }}
            >
              <input
                aria-label="페이지 번호"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                placeholder={String(pos.page)}
                inputMode="numeric"
                className="w-10 text-center text-[12px] border-[1.5px] border-grey-200 rounded px-1 py-0.5 bg-white/80"
              />
              <span>/ {total}</span>
            </form>
          )}
          {asset.kind === "pdf" && (
            <span className="flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} className="text-[12px] font-bold w-6 h-6 rounded border border-grey-200 bg-white/80">−</button>
              <span className="text-[11px] text-grey-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))} className="text-[12px] font-bold w-6 h-6 rounded border border-grey-200 bg-white/80">＋</button>
            </span>
          )}
        </div>

        {prevPosition(assets, pos) && (
          <button
            aria-label="이전 페이지"
            onClick={() => void guardedGo(prevPosition(assets, pos))}
            className="absolute bottom-4 left-4 sm:left-6 z-10 w-11 h-11 rounded-full bg-white/70 backdrop-blur-sm border border-white/60 shadow text-[18px] font-bold text-ink"
          >
            ←
          </button>
        )}
        {nextPosition(assets, pos) && (
          <button
            aria-label={asset.kind === "pdf" && pos.page >= total ? "다음 자료" : "다음 페이지"}
            onClick={() => void guardedGo(nextPosition(assets, pos))}
            className="absolute bottom-4 right-4 sm:right-6 z-10 w-11 h-11 rounded-full bg-white/70 backdrop-blur-sm border border-white/60 shadow text-[18px] font-bold text-ink"
          >
            →
          </button>
        )}

        {navError && <p className="text-[12.5px] text-red mb-2">{navError}</p>}
        {urlError && <p className="text-[12.5px] text-red mb-2">{urlError}</p>}
        {renderError && <p className="text-[12.5px] text-red mb-2">{renderError}</p>}
        {asset.unavailable && (
          <p className="text-[12.5px] text-grey-500 mb-2">이 자료의 고정 사본이 기록되지 않아 표시할 수 없습니다.</p>
        )}

        <div ref={frameRef} className="relative w-full overflow-auto flex justify-center" style={{ minHeight: fitHeight || undefined }}>
          {asset.kind === "video" ? (
            signed ? <VideoMaterialPlayer url={signed.url} mimeType={signed.mimeType} title={asset.title} /> : <p className="text-[12.5px] text-grey-500">자료를 불러오는 중…</p>
          ) : signed ? (
            <div className="relative inline-block" style={{ minWidth: rendered.width || undefined }}>
              <PdfPageCanvas
                url={signed.url}
                page={pos.page}
                zoom={zoom}
                fitWidth={fitWidth}
                fitHeight={fitHeight}
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
