import { createHash } from "node:crypto";

// 고정 사본을 만들기 전에 파일이 무엇인지 확인한다 — 페이지 수와 내용 지문.
//
// 페이지 수는 공개 버전 스냅샷(asset.pageCount)에 들어가고, 페이지 필기 저장이
// 그 범위를 검증한다(append_page_stroke_events). 지문(sha256)은 같은 내용을 다시
// 공개했을 때 새 버전을 만들지 않는 기준이다.

export type PdfProbe = { pageCount: number; sha256: string; bytes: number };

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * pdf.js(legacy 빌드, Node)로 페이지 수를 읽는다. 파싱에 실패하면 던진다 — 페이지
 * 수를 모르는 PDF 를 공개하지 않는다.
 */
export async function probePdf(data: Uint8Array): Promise<PdfProbe> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // 워커 경로를 실제 파일로 고정한다. 기본값(자기 청크 옆 ./pdf.worker.mjs)은 번들된 서버에서
  // 존재하지 않는다. serverExternalPackages 로 패키지가 node_modules 에 그대로 있으므로
  // require.resolve 가 그 파일을 가리킨다.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, verbosity: 0 });
  try {
    const doc = await task.promise;
    const pageCount = doc.numPages;
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new Error("PDF 페이지 수를 읽지 못했습니다.");
    }
    return { pageCount, sha256: sha256Hex(data), bytes: data.byteLength };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

/** 파일 종류. 다른 것은 자료로 등록하지 않는다(Drive 폴더에 섞여 있어도 건너뛴다). */
export function kindForMime(mimeType: string | null | undefined): "pdf" | "video" | null {
  const m = (mimeType ?? "").toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("video/")) return "video";
  return null;
}

export function extensionForKind(kind: "pdf" | "video", mimeType: string): string {
  if (kind === "pdf") return "pdf";
  const sub = mimeType.split("/")[1] ?? "mp4";
  return sub.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
}
