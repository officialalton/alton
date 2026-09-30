import { annotationScale } from "./annotation-scale";
import type { PageStrokePayload } from "./annotation-events-actions";

// PDF 페이지 필기(수업 레이어)와 교사용 팁 레이어가 같이 쓰는 조각 그리기 — 펜·지우개·텍스트·전체 지우기.
// 좌표는 그릴 때의 캔버스 너비(seg.w) 대비 비율로 현재 캔버스에 환산한다(annotation-scale).

// 텍스트 상자 글자 크기(캔버스 px, 그릴 때 너비 기준) — 2026-09-14 UAT: PC 수업 교사의 타이핑 필기.
export const TEXT_SIZE = 18;
export const TEXT_LINE_HEIGHT = 1.3;

export function drawPageSegment(
  canvas: HTMLCanvasElement | null,
  seg: PageStrokePayload,
  penWidth: number
): void {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  const scale = annotationScale(canvas.width, seg.w);
  if (seg.tool === "clear") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (seg.tool === "text") {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = seg.color;
    const size = (seg.size ?? TEXT_SIZE) * scale;
    ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "top";
    (seg.text ?? "").split("\n").forEach((line, i) => {
      ctx.fillText(line, seg.x0 * scale, seg.y0 * scale + i * size * TEXT_LINE_HEIGHT);
    });
    return;
  }
  ctx.lineCap = "round";
  if (seg.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 22 * scale;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = penWidth * scale;
  }
  ctx.beginPath();
  ctx.moveTo(seg.x0 * scale, seg.y0 * scale);
  ctx.lineTo(seg.x1 * scale, seg.y1 * scale);
  ctx.stroke();
}
