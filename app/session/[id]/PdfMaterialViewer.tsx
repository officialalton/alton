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
