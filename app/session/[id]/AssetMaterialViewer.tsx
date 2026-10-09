"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MaterialAsset } from "./material-data";
import type { MaterialLayerRole } from "./MaterialAnnotationLayers";
import { getAssetVersionUrlAction } from "@/app/materials/asset-actions";
import { nextPosition, pageCountOf, prevPosition, type AssetPosition } from "./asset-navigation";
import PdfPageCanvas, { PdfPageThumbnail } from "./PdfMaterialViewer";
import VideoMaterialPlayer from "./VideoMaterialPlayer";
import PdfPageAnnotationLayer, { type PdfPageAnnotationHandle } from "./PdfPageAnnotationLayer";
import PdfTipLayer, { type PdfTipLayerHandle } from "./PdfTipLayer";
import PdfTipAdminPanel from "./PdfTipAdminPanel";

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

// 교사용 팁 보기/숨기기 — 선생님 기기에 선택을 남긴다(저장소를 못 쓰는 환경이면 기본값 = 표시).
const TIP_VISIBLE_KEY = "alton:pdf-tip-visible";
function readTipVisible(): boolean {
  try {
    return window.localStorage.getItem(TIP_VISIBLE_KEY) !== "0";
  } catch {
    return true;
  }
}

const signedUrlCache = new Map<string, { url: string; mimeType: string; expiresAt: number }>();
const positionMemory = new Map<string, AssetPosition>();

export default function AssetMaterialViewer({
  assets,
  sessionId,
  curriculumDocIdOf,
  role,
  viewerUserId,
  initialPosition,
  extraControls,
  tipAccess = "none",
}: {
  assets: MaterialAsset[];
  /** 없으면 읽기 전용(과목 전체 보기·미리보기) — 필기 레이어를 두지 않는다. */
  sessionId?: string | null;
  curriculumDocIdOf?: (asset: MaterialAsset) => string;
  role: MaterialLayerRole;
  viewerUserId?: string;
  initialPosition?: AssetPosition;
  /** 2026-09-22(사용자 지시) — PDF 필기 툴바("필기 시작") 옆에 끼워 넣을 컨트롤(단어 저장 등). */
  extraControls?: React.ReactNode;
  /**
   * 교사용 팁(2026-10-01) — view: 선생님·관리자가 팁을 겹쳐 본다(토글), edit: 관리자가 팁을 쓴다,
   * none: 학생·보호자·그 밖 — 레이어·토글·요청이 아예 없다(서버도 읽기를 거절한다).
   */
  tipAccess?: "none" | "view" | "edit";
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
  // 2026-09-22(사용자 지시) — 확대 컨트롤이 있던 툴바를 통째로 없앴다. 배율은 항상 맞춤(1).
  const zoom = 1;
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
  const [collapsedAssets, setCollapsedAssets] = useState<Set<string>>(new Set());
  const layerRef = useRef<PdfPageAnnotationHandle | null>(null);
  const tipLayerRef = useRef<PdfTipLayerHandle | null>(null);
  // null = 아직 기기 선택을 읽지 않음 — 읽기 전에는 레이어를 올리지 않아 숨김 선택인 선생님에게 불필요한 조회가 나가지 않는다.
  const [tipVisible, setTipVisibleState] = useState<boolean | null>(null);
  const [tipEditing, setTipEditing] = useState(false);
  const [tipRefresh, setTipRefresh] = useState(0);
  const [tipReload, setTipReload] = useState(0);
  const [tipSaveState, setTipSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    if (tipAccess !== "view") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTipVisibleState(readTipVisible());
  }, [tipAccess]);
  function toggleTips() {
    setTipVisibleState((v) => {
      const next = !(v ?? true);
      try {
        window.localStorage.setItem(TIP_VISIBLE_KEY, next ? "1" : "0");
      } catch {
        // 저장소를 못 써도 이번 화면에서는 동작한다.
      }
      return next;
    });
  }
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
      for (const layer of [layerRef.current, tipLayerRef.current]) {
        if (layer && layer.hasUnsaved()) {
          const ok = await layer.flush();
          if (!ok) {
            setNavError("You have unsaved notes, so navigation was cancelled. Retry saving, then move on.");
            return;
          }
        }
      }
      setRendered({ width: 0, height: 0 });
      setPos(next);
    },
    [setPos]
  );

  if (!asset) return null;

  const signed = urls[asset.versionId];
  const total = pageCountOf(asset);
  const docId = curriculumDocIdOf ? curriculumDocIdOf(asset) : asset.docId;
  const showTipLayer =
    asset.kind === "pdf" && ((tipAccess === "view" && tipVisible === true) || (tipAccess === "edit" && tipEditing));
  const canAnnotate = Boolean(sessionId) && asset.kind === "pdf" && (role === "teacher" || role === "student");

  return (
    <div className="md:grid md:grid-cols-[220px_1fr]" data-testid="asset-material-viewer">
      <nav className="border-b md:border-b-0 md:border-r border-grey-200 p-4 md:sticky md:top-0 md:self-start md:h-[calc(100vh-56px)] md:overflow-y-auto flex md:block gap-1.5 overflow-x-auto">
        <div className="hidden md:block text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
          Materials
        </div>
        {assets.map((a, i) => {
          const active = i === pos.assetIndex;
          const signedFor = urls[a.versionId];
          const collapsed = collapsedAssets.has(a.versionId);
          return (
            <div key={a.versionId} className="flex-shrink-0 md:block">
              <button
                // 2026-09-14 UAT: 열려 있는 자료를 다시 누르면 페이지 목록을 접는다 — 다른 자료를 빨리 고를 수 있게.
                aria-expanded={active ? !collapsed : undefined}
                onClick={() => {
                  if (active) {
                    setCollapsedAssets((prev) => {
                      const next = new Set(prev);
                      if (next.has(a.versionId)) next.delete(a.versionId);
                      else next.add(a.versionId);
                      return next;
                    });
                    return;
                  }
                  setCollapsedAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(a.versionId);
                    return next;
                  });
                  void guardedGo({ assetIndex: i, page: 1 });
                }}
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
              {active && !collapsed && a.kind === "pdf" && signedFor && (
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
        {/* 2026-09-22(사용자 지시) — 제목·페이지·확대 띠가 페이지 내용을 가려서
            자꾸 문제가 됐다. 옮기는 대신 아예 없앤다(이전/다음 화살표만 페이지
            위에 떠 있는다). */}

        {prevPosition(assets, pos) && (
          <button
            aria-label="Previous page"
            onClick={() => void guardedGo(prevPosition(assets, pos))}
            className="absolute bottom-4 left-4 sm:left-6 z-10 w-11 h-11 rounded-full bg-white/70 backdrop-blur-sm border border-white/60 shadow text-[18px] font-bold text-ink"
          >
            ←
          </button>
        )}
        {nextPosition(assets, pos) && (
          <button
            aria-label={asset.kind === "pdf" && pos.page >= total ? "Next material" : "Next page"}
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
          <p className="text-[12.5px] text-grey-500 mb-2">This material can&apos;t be shown because no fixed copy was recorded.</p>
        )}

        {asset.kind === "pdf" && tipAccess === "edit" && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setTipEditing((v) => !v)}
              aria-pressed={tipEditing}
              data-testid="pdf-tip-edit-toggle"
              className={"text-[12.5px] font-bold px-3 py-1.5 rounded border " + (tipEditing ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")}
            >
              {tipEditing ? "Finish editing tips" : "Edit tips"}
            </button>
            {tipEditing && tipSaveState === "error" && (
              <span className="ml-2 text-[12px] text-red">Tips weren&apos;t saved. Check your connection and try again.</span>
            )}
          </div>
        )}
        {asset.kind === "pdf" && tipAccess === "edit" && tipEditing && (
          <PdfTipAdminPanel
            docId={asset.docId}
            versionId={asset.versionId}
            page={pos.page}
            pageCount={total}
            refreshSignal={tipRefresh}
            onChanged={() => setTipReload((n) => n + 1)}
          />
        )}

        <div ref={frameRef} className="relative w-full overflow-auto flex justify-center" style={{ minHeight: fitHeight || undefined }}>
          {asset.kind === "video" ? (
            signed ? <VideoMaterialPlayer url={signed.url} mimeType={signed.mimeType} title={asset.title} /> : <p className="text-[12.5px] text-grey-500">Loading material…</p>
          ) : signed ? (
            <div className="relative inline-block">
              <PdfPageCanvas
                url={signed.url}
                page={pos.page}
                zoom={zoom}
                fitWidth={fitWidth}
                fitHeight={fitHeight}
                onRendered={onRendered}
                onError={onError}
              />
              {showTipLayer && (
                <PdfTipLayer
                  key={`tip:${asset.versionId}:${pos.page}:${tipReload}`}
                  ref={tipLayerRef}
                  versionId={asset.versionId}
                  page={pos.page}
                  mode={tipAccess === "edit" ? "edit" : "view"}
                  viewerUserId={viewerUserId}
                  width={rendered.width}
                  height={rendered.height}
                  onSaveStateChange={setTipSaveState}
                  onSaved={() => setTipRefresh((n) => n + 1)}
                />
              )}
              {tipAccess === "view" && asset.kind === "pdf" && tipVisible !== null && (
                <button
                  type="button"
                  onClick={toggleTips}
                  aria-pressed={tipVisible}
                  data-testid="pdf-tip-toggle"
                  className="absolute top-2 left-2 z-[8] text-[11.5px] font-bold px-2 py-1 rounded-lg bg-white/70 backdrop-blur-sm border shadow-sm"
                  style={{ color: "#7B3FA0", borderColor: "rgba(123,63,160,0.4)" }}
                >
                  {tipVisible ? "Hide teacher tips" : "Show teacher tips"}
                </button>
              )}
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
                  extraControls={extraControls}
                />
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-grey-500">Loading material…</p>
          )}
        </div>
        {saveState === "error" && (
          <p className="text-[12px] text-red mt-2">Notes weren&apos;t saved. Check your connection and try again.</p>
        )}
      </div>
    </div>
  );
}
