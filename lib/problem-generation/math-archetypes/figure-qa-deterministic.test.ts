// 시각 검수 렌더의 결정성 회귀 — 같은 코드·시드면 HTML(그림 SVG 포함)이 항상 같아야 하고, PNG 단계의 래스터 비결정은 렌더 스크립트의 결정적 모드로 막는다.
//   (PNG 바이트 비결정의 원인: Chromium 의 안티앨리어싱 래스터가 실행마다 1~50픽셀 달랐다. HTML 은 같았다 — 2026-10-07 실측.)
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { qaSamples } from "./figure-qa-samples";
import { problemText } from "../../problem-figures/label-rule";

vi.mock("../../../app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: async () => ({ ok: false, error: "mock" }) }));
import ProblemFigure from "../../../app/session/[id]/ProblemFigure";

const AFFECTED = [
  "one_variable_data.mean.DP.C", "two_variable_data.scatter_count_above.SC.C", "right_triangles_trigonometry.sinusoid_graph.TC.C",
  "linear_inequalities.solve_one_var.NL.C", "linear_inequalities.compound_inequality_number_line.NL.C", "one_variable_data.median.BX.C", "one_variable_data.spread_comparison.HG.C", "one_variable_data.grouped_median_interval.HG.C",
];
const html = (itemId: string) => qaSamples(itemId).map((s) => renderToStaticMarkup(createElement(ProblemFigure, { spec: s.inst.figure, text: problemText(s.inst.stimulus, s.inst.question, s.inst.options) })));

describe("시각 검수 렌더 결정성", () => {
  for (const id of AFFECTED) it(`${id}: 같은 샘플을 두 번 그리면 HTML 이 같다`, () => { const a = html(id), b = html(id); expect(a.length).toBeGreaterThan(0); expect(b).toEqual(a); });
  it("PNG 렌더 스크립트는 결정적 모드(--deterministic-mode, sRGB 고정)로 Chromium 을 띄운다", () => {
    const src = readFileSync("scripts/mock-exam-generation/figure-qa-render.mjs", "utf-8");
    expect(src).toContain("--deterministic-mode"); expect(src).toContain("--force-color-profile=srgb"); expect(src).toMatch(/chromium\.launch\(\{ args: DETERMINISTIC_ARGS \}\)/);
  });
});
