import { describe, expect, it } from "vitest";
import { renderFigureSvg } from "./render";
import { validateFigureSpec } from "./spec";

describe("문제 도형 생성기(2026-09-14 문제 템플릿 ③)", () => {
  it("좌표평면: 축·격자·눈금·직선·점·포물선을 그리고 라벨은 이스케이프한다", () => {
    const v = validateFigureSpec({
      type: "coordinate_plane",
      xRange: [-2, 8],
      yRange: [-2, 8],
      items: [
        { kind: "line", through: [[0, 4], [4, 0]], label: "y = -x + 4" },
        { kind: "function", fn: "quadratic", params: [1, 0, -1], label: "<f>" },
        { kind: "points", points: [[1, 3]], labels: ["A"] },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const svg = renderFigureSvg(v.spec);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("&lt;f&gt;");
    expect(svg).not.toContain("<f>");
    expect((svg.match(/<line /g) ?? []).length).toBeGreaterThan(10); // 격자 + 축 + 직선
    expect(svg).toContain("<path d=\"M"); // 포물선
    expect(svg).toContain("<circle"); // 점
  });

  it("기하: 삼각형 꼭짓점·각·변 라벨, 직각 표시, 'not drawn to scale' 표기", () => {
    const v = validateFigureSpec({
      type: "geometry",
      shapes: [
        { kind: "polygon", points: [[0, 0], [6, 0], [0, 4]], vertexLabels: ["R", "S", "T"], angleLabels: [{ at: 1, text: "63°" }], sideLabels: ["6", "", "4"], rightAngleAt: [0] },
        { kind: "circle", center: [10, 2], radius: 2, centerLabel: "O", radiusLabel: "r" },
      ],
      notToScale: true,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const svg = renderFigureSvg(v.spec);
    expect(svg).toContain(">R<");
    expect(svg).toContain(">63°<");
    expect(svg).toContain("Note: Figure not drawn to scale.");
    expect(svg).toContain("<circle");
  });

  it("모양이 틀리면 사유를 돌려주고 렌더하지 않는다", () => {
    expect(validateFigureSpec({ type: "coordinate_plane", xRange: [5, 1], yRange: [0, 1], items: [] })).toMatchObject({ ok: false });
    expect(validateFigureSpec({ type: "geometry", shapes: [{ kind: "polygon", points: [[0, 0]] }] })).toMatchObject({ ok: false });
    expect(validateFigureSpec({ type: "nope" })).toMatchObject({ ok: false });
    expect(validateFigureSpec({ type: "coordinate_plane", xRange: [0, 1], yRange: [0, 1], items: [{ kind: "line", slope: 1 }] })).toMatchObject({ ok: false });
  });
});
