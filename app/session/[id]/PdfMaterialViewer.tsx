"use client";

import { useEffect, useRef, useState } from "react";

// PDF 한 페이지를 캔버스에 그린다(pdf.js). 브라우저 내장 PDF iframe 위에 얹지 않는다 —
// 필기 레이어가 페이지 픽셀 크기에 정확히 맞아야 하기 때문이다.
//
// 늦게 끝난 이전 페이지의 렌더가 현재 페이지를 덮지 않도록 렌더마다 세대 번호를 붙이고,
// 진행 중인 렌더는 취소한다. 렌더가 끝난 뒤에야 부모에게 크기를 알려 입력을 연다.

type PdfDocumentLike = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
      promise: Promise<void>;
      cancel: () => void;
    };
  }>;
  destroy: () => Promise<void>;
};

const docCache = new Map<string, Promise<PdfDocumentLike>>();

async function loadPdf(url: string): Promise<PdfDocumentLike> {
  let cached = docCache.get(url);
  if (!cached) {
    cached = (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const task = pdfjs.getDocument({ url });
      return (await task.promise) as unknown as PdfDocumentLike;
    })();
    docCache.set(url, cached);
    cached.catch(() => docCache.delete(url));
  }
  return cached;
}

export default function PdfPageCanvas({
  url,
  page,
  zoom,
  fitWidth,
  onRendered,
  onError,
}: {
  url: string;
  page: number;
  /** 1 = 가로 맞춤. */
  zoom: number;
  /** 가로 맞춤 기준 너비(px). */
  fitWidth: number;
  onRendered: (size: { width: number; height: number }) => void;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const generationRef = useRef(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelRender: (() => void) | null = null;
    let disposed = false;

    (async () => {
      try {
        const doc = await loadPdf(url);
        if (disposed || generation !== generationRef.current) return;
        const pdfPage = await doc.getPage(page);
        if (disposed || generation !== generationRef.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = (fitWidth > 0 ? fitWidth / base.width : 1) * zoom;
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const width = Math.floor(viewport.width);
        const height = Math.floor(viewport.height);
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const task = pdfPage.render({ canvasContext: ctx, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
        if (disposed || generation !== generationRef.current) return;
        setSize({ width, height });
        onRendered({ width, height });
      } catch (e) {
        if (disposed || generation !== generationRef.current) return;
        const name = (e as { name?: string })?.name;
        if (name === "RenderingCancelledException") return;
        onError(e instanceof Error ? e.message : "PDF 를 그리지 못했습니다.");
      }
    })();

    return () => {
      disposed = true;
      cancelRender?.();
    };
  }, [url, page, zoom, fitWidth, onRendered, onError]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="pdf-page-canvas"
      data-page={page}
      className="block bg-white shadow-sm"
      style={size ? { width: size.width, height: size.height } : undefined}
    />
  );
}

/**
 * 페이지 썸네일 — 목차용 작은 미리보기. 화면에 보일 때만 그린다(IntersectionObserver).
 * 99쪽짜리 자료도 보이는 몇 장만 렌더하므로 가볍다. 문서는 같은 URL 캐시를 쓴다.
 */
export function PdfPageThumbnail({
  url,
  page,
  width,
  active,
  label,
  onSelect,
}: {
  url: string;
  page: number;
  width: number;
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holderRef = useRef<HTMLButtonElement | null>(null);
  // IntersectionObserver 가 없는 환경(테스트)은 처음부터 보이는 것으로 둔다 — 효과 안에서
  // 동기 setState 를 하지 않는다.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = holderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || drawn) return;
    let disposed = false;
    (async () => {
      try {
        const doc = await loadPdf(url);
        const pdfPage = await doc.getPage(page);
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: width / base.width });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || disposed) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!disposed) setDrawn(true);
      } catch {
        // 썸네일은 실패해도 라벨만 남긴다.
      }
    })();
    return () => {
      disposed = true;
    };
  }, [visible, drawn, url, page, width]);

  return (
    <button
      ref={holderRef}
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={
        "block w-full text-left rounded-lg p-1.5 mb-1.5 border-[1.5px] " +
        (active ? "border-red bg-red-bg" : "border-transparent hover:bg-grey-100")
      }
    >
      <canvas
        ref={canvasRef}
        data-testid={`pdf-thumb-${page}`}
        className="block w-full bg-white border border-grey-200 rounded"
        style={{ aspectRatio: drawn ? undefined : "16 / 9" }}
      />
      <div className={"text-[11px] mt-1 " + (active ? "text-red font-bold" : "text-grey-500")}>{label}</div>
    </button>
  );
}
