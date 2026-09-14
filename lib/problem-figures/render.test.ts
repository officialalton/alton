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

  it("image 는 bucket/path 가 있어야 하고 상위 경로는 막는다(④)", () => {
    expect(validateFigureSpec({ type: "image", bucket: "problem-assets", path: "p/x.png" })).toMatchObject({ ok: true });
    expect(validateFigureSpec({ type: "image", bucket: "problem-assets", path: "../x.png" })).toMatchObject({ ok: false });
    expect(renderFigureSvg({ type: "image", bucket: "b", path: "p" })).toBe("");
  });

  it("평행선의 각은 교점·사분면으로 놓이고 호가 그려진다; 좌표평면은 축 설명·원점 O 를 그린다", () => {
    const g = validateFigureSpec({
      type: "geometry",
      shapes: [{ kind: "parallel_lines", y1: 3, y2: 0, transversal: [[1, 4], [4, -1]], labels: ["m", "n", "k"], angles: [{ line: "y1", quadrant: "NE", text: "118°" }, { line: "y2", quadrant: "SW", text: "x°" }] }],
    });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const svg = renderFigureSvg(g.spec);
    expect((svg.match(/<path d="M[^"]*A/g) ?? []).length).toBe(2); // 호 2개
    expect(svg).toContain(">118°<");
    expect(validateFigureSpec({ type: "geometry", shapes: [{ kind: "parallel_lines", y1: 1, y2: 0, transversal: [[0, 0], [1, 1]], angles: [{ line: "y3", quadrant: "NE", text: "a" }] }] })).toMatchObject({ ok: false });

    const pl = validateFigureSpec({ type: "coordinate_plane", xRange: [0, 3], yRange: [0, 12], xTitle: "Time (seconds)", yTitle: "Height (meters)", items: [{ kind: "function", fn: "quadratic", params: [-4, 0, 10] }] });
    expect(pl.ok).toBe(true);
    if (!pl.ok) return;
    const p = renderFigureSvg(pl.spec);
    expect(p).toContain("Time (seconds)");
    expect(p).toContain("rotate(-90)");
    expect(p).toContain(">O<");
  });
});
