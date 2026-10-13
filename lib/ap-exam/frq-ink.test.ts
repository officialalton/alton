import { describe, expect, it } from "vitest";
import { AP_FRQ_DELIVERY, apFrqIsPaper } from "./frq-delivery";
import { INK_MAX_H, INK_MIN_H, INK_MAX_STROKES, clampBoardHeight, eraseStrokesNear, inkSizeProblem, simplifyPoints, strokesToSvg, svgDataUrl, type InkStroke } from "./frq-ink";

describe("FRQ 전달 방식 표", () => {
  it("종이 7과목 / 디지털 3과목(Statistics·CS A·English Language)", () => {
    expect(Object.entries(AP_FRQ_DELIVERY).filter(([, m]) => m === "paper").map(([k]) => k).sort()).toEqual(
      ["ap_biology", "ap_calculus_ab", "ap_calculus_bc", "ap_chemistry", "ap_macroeconomics", "ap_microeconomics", "ap_physics_1"]);
    for (const k of ["ap_statistics", "ap_computer_science_a", "ap_english_language"]) expect(apFrqIsPaper(k)).toBe(false);
    expect(apFrqIsPaper(null)).toBe(false);
    expect(apFrqIsPaper("ap_unknown")).toBe(false);
  });
});

describe("획 단순화·미리보기", () => {
  it("직선 위 점은 솎아내고 정수로 반올림, 끝점은 유지", () => {
    const raw: number[] = []; for (let i = 0; i <= 100; i++) raw.push(i * 2 + 0.2, 50.4);
    expect(simplifyPoints(raw)).toEqual([0, 50, 200, 50]);
  });
  it("점 하나(탭)는 같은 점 두 개로 — 점으로 그려진다", () => {
    expect(simplifyPoints([10.4, 20.6])).toEqual([10, 21, 10, 21]);
  });
  it("미리보기는 허용 목록 SVG(path 만)이고 보드 높이를 viewBox 에 담는다", () => {
    const strokes: InkStroke[] = [{ c: 1, p: [1, 2, 30, 40] }];
    const svg = strokesToSvg(strokes, 900);
    expect(svg).toContain('viewBox="0 0 800 900"');
    expect(svg).toMatch(/^<svg [^>]*>(<path d="M[0-9 L]+" stroke="#[0-9a-f]{6}"[^>]*\/>)+<\/svg>$/);
    expect(svgDataUrl(svg)).toMatch(/^data:image\/svg\+xml/);
  });
});

describe("보드 크기", () => {
  it("범위로 고정(300..1600)", () => {
    expect(clampBoardHeight(10)).toBe(INK_MIN_H);
    expect(clampBoardHeight(99999)).toBe(INK_MAX_H);
    expect(clampBoardHeight(NaN)).toBe(500);
  });
  it("그린 획 아래로는 줄이지 않는다(획이 잘리거나 변형되지 않게)", () => {
    expect(clampBoardHeight(300, [{ p: [10, 700] }])).toBe(710);
  });
  it("키워도 획 데이터는 변하지 않는다(논리 좌표 고정)", () => {
    const strokes: InkStroke[] = [{ c: 0, p: [10, 10, 100, 200] }];
    const before = JSON.stringify(strokes);
    clampBoardHeight(1200, strokes);
    strokesToSvg(strokes, 1200);
    expect(JSON.stringify(strokes)).toBe(before);
  });
});

describe("크기 상한·지우개", () => {
  it("획 수 초과는 안내 문구", () => {
    expect(inkSizeProblem(Array.from({ length: INK_MAX_STROKES + 1 }, () => ({ c: 0, p: [1, 1, 2, 2] })))).toMatch(/too large/);
    expect(inkSizeProblem([{ c: 0, p: [1, 1, 2, 2] }])).toBeNull();
  });
  it("지우개는 가까운 획만 지운다", () => {
    const s: InkStroke[] = [{ c: 0, p: [0, 0, 100, 0] }, { c: 0, p: [0, 300, 100, 300] }];
    expect(eraseStrokesNear(s, 50, 3)).toEqual([s[1]]);
  });
});
