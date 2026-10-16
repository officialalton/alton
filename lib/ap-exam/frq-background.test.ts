import { describe, expect, it } from "vitest";
import { INK_BACKGROUNDS, backgroundSegments, defaultBackgroundForPrompt, normalizeBackground, withBackground } from "./frq-background";
import { strokesToSvg } from "./frq-ink";

describe("FRQ 배경 프리셋", () => {
  it("blank 는 선분이 없고 나머지는 모두 800×H 안에 그려진다", () => {
    expect(backgroundSegments("blank", 500)).toEqual([]);
    for (const { id } of INK_BACKGROUNDS) {
      for (const h of [300, 500, 1600]) {
        for (const s of backgroundSegments(id, h)) {
          for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(800); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(h); }
        }
      }
    }
  });
  it("Two-panel 은 x 축 두 벌(원점 두 개)", () => {
    const horiz = backgroundSegments("axes_two", 800).filter((s) => s.y1 === s.y2 && s.x1 === 80 && s.x2 === 780);
    expect(horiz.map((s) => s.y1)).toEqual([370, 770]);
  });
  it("모르는 id 는 blank 로", () => {
    expect(normalizeBackground("bogus")).toBe("blank");
    expect(normalizeBackground(undefined)).toBe("blank");
    expect(normalizeBackground("axes_grid")).toBe("axes_grid");
  });
  it("지문에 axes 또는 sketch+graph 가 있으면 기본 Axes", () => {
    expect(defaultBackgroundForPrompt("Sketch a graph of velocity versus time.")).toBe("axes");
    expect(defaultBackgroundForPrompt("Blank axes are provided on the answer sheet.")).toBe("axes");
    expect(defaultBackgroundForPrompt("Explain why the rate increases.")).toBe("blank");
    expect(defaultBackgroundForPrompt("Sketch the setup.")).toBe("blank");
    expect(defaultBackgroundForPrompt(null)).toBe("blank");
  });
  it("결과 SVG: 배경은 획 아래(앞)에 깔리고 viewBox·획은 그대로, blank/미지정은 원본 그대로", () => {
    const svg = strokesToSvg([{ c: 0, p: [10, 10, 50, 50] }], 500);
    expect(withBackground(svg, "blank")).toBe(svg);
    expect(withBackground(svg, undefined)).toBe(svg);
    const out = withBackground(svg, "axes");
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">')).toBe(true);
    expect(out.indexOf("<line")).toBeLessThan(out.indexOf("<path"));
    expect(out.endsWith("</svg>")).toBe(true);
    expect(out).toContain('<path d="M10 10L50 50"');
  });
});
