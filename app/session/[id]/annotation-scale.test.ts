import { describe, expect, it } from "vitest";
import { annotationScale, pointerToCanvas } from "./annotation-scale";

describe("annotationScale — 화면 크기가 바뀌어도 필기가 원래 자리에 남는다", () => {
  it("너비가 절반이 되면 좌표도 절반으로 환산한다", () => {
    expect(annotationScale(400, 800)).toBe(0.5);
  });

  it("너비가 두 배가 되면 좌표도 두 배로 환산한다", () => {
    expect(annotationScale(1600, 800)).toBe(2);
  });

  it("같은 너비면 그대로 둔다", () => {
    expect(annotationScale(800, 800)).toBe(1);
  });

  it("기준 너비가 없는 과거 필기는 그대로 그린다(없던 정보를 지어내지 않는다)", () => {
    expect(annotationScale(400, undefined)).toBe(1);
    expect(annotationScale(400, 0)).toBe(1);
  });

  it("캔버스가 아직 측정되지 않았으면 그대로 둔다(0으로 뭉개지 않는다)", () => {
    expect(annotationScale(0, 800)).toBe(1);
  });
});

describe("pointerToCanvas — 확대·축소 상태에서도 찍은 곳에 그린다", () => {
  it("CSS 크기와 내부 픽셀 크기가 같으면 그대로 옮긴다", () => {
    expect(
      pointerToCanvas(110, 60, { left: 10, top: 10, width: 800, height: 400 }, { width: 800, height: 400 })
    ).toEqual({ x: 100, y: 50 });
  });

  it("절반으로 축소해 그려져 있으면 내부 좌표는 두 배가 된다", () => {
    expect(
      pointerToCanvas(110, 60, { left: 10, top: 10, width: 400, height: 200 }, { width: 800, height: 400 })
    ).toEqual({ x: 200, y: 100 });
  });

  it("아직 측정되지 않은 요소에서도 좌표를 뭉개지 않는다", () => {
    expect(
      pointerToCanvas(110, 60, { left: 10, top: 10, width: 0, height: 0 }, { width: 800, height: 400 })
    ).toEqual({ x: 100, y: 50 });
  });
});
