/**
 * 필기는 교재 본문·풀이판 위에 얹힌다. 창 크기나 확대 배율이 바뀌면 콘텐츠가
 * 다시 흐르고 캔버스 너비도 달라지므로, 좌표를 절대 px로만 쓰면 그 순간부터
 * 필기가 원래 자리에서 어긋난다.
 *
 * 그릴 때의 기준 너비를 함께 저장해 두고, 다시 그릴 때 현재 너비 비율로
 * 환산한다. 기준 너비가 없는 과거 필기는 "지금 너비에서 그렸다"고 보고 1배로
 * 둔다 — 없던 정보를 지어내지 않는다.
 */
export function annotationScale(
  currentCanvasWidth: number,
  strokeReferenceWidth: number | undefined
): number {
  if (!strokeReferenceWidth || strokeReferenceWidth <= 0) return 1;
  if (!currentCanvasWidth || currentCanvasWidth <= 0) return 1;
  return currentCanvasWidth / strokeReferenceWidth;
}

/** 포인터 좌표를 캔버스 내부 픽셀 좌표로 옮긴다(CSS 크기 ≠ 내부 픽셀 크기). */
export function pointerToCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  canvas: { width: number; height: number }
): { x: number; y: number } {
  const sx = rect.width > 0 ? canvas.width / rect.width : 1;
  const sy = rect.height > 0 ? canvas.height / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}
