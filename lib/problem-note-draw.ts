// problem_note_strokes 선분 그리기(레거시 ProblemNoteCanvas 에서 이동 — 공유 보드·스냅샷이 함께 쓴다). w(저장 당시 캔버스 폭)가 있으면 현재 폭으로 환산한다.
import type { StrokeSegment } from "@/lib/problem-notes-actions";

export function drawAll(ctx: CanvasRenderingContext2D, strokes: StrokeSegment[], width: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of strokes) {
    const scale = s.w ? width / s.w : 1;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x0 * scale, s.y0 * scale);
    ctx.lineTo(s.x1 * scale, s.y1 * scale);
    ctx.stroke();
  }
}
