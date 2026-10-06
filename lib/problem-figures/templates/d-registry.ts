// 수직선·줄기-잎·원그래프·도수다각형/누적도수곡선·누적 막대 — 새 렌더러 5종의 등록부(검증·렌더·지문 검사를 한 곳에서 돌린다).
// 공용 파일(spec.ts·render.ts·check.ts·alt.ts)은 이 등록부만 부른다.
import type { FigureIssue } from "./_layout";
import { lintNumberLineAgainstText, renderNumberLine, validateNumberLine, type NumberLineSpec } from "./number-line";
import { lintStemLeafAgainstText, renderStemLeaf, validateStemLeaf, type StemLeafSpec } from "./stem-leaf";
import { lintPieAgainstText, renderPie, validatePie, type PieSpec } from "./pie";
import { lintFreqChartAgainstText, renderFreqChart, validateFreqChart, type FreqChartSpec } from "./freq-chart";
import { lintStackedBarAgainstText, renderStackedBar, validateStackedBar, type StackedBarSpec } from "./stacked-bar";

export type DSpec = NumberLineSpec | StemLeafSpec | PieSpec | FreqChartSpec | StackedBarSpec;
export const D_FIGURE_TYPES: readonly string[] = ["number_line", "stem_leaf", "pie", "freq_chart", "stacked_bar"];

export const isDSpec = (spec: { type: string }): spec is DSpec => D_FIGURE_TYPES.includes(spec.type);

export function validateD(s: Record<string, unknown>): { ok: true; spec: DSpec } | { ok: false; error: string } {
  switch (s.type) {
    case "number_line": return validateNumberLine(s);
    case "stem_leaf": return validateStemLeaf(s);
    case "pie": return validatePie(s);
    case "freq_chart": return validateFreqChart(s);
    default: return validateStackedBar(s);
  }
}
export function renderD(spec: DSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  switch (spec.type) {
    case "number_line": return renderNumberLine(spec);
    case "stem_leaf": return renderStemLeaf(spec);
    case "pie": return renderPie(spec);
    case "freq_chart": return renderFreqChart(spec);
    case "stacked_bar": return renderStackedBar(spec);
  }
}
export function lintD(spec: DSpec, passage: string): FigureIssue[] {
  switch (spec.type) {
    case "number_line": return lintNumberLineAgainstText(spec, passage);
    case "stem_leaf": return lintStemLeafAgainstText(spec, passage);
    case "pie": return lintPieAgainstText(spec, passage);
    case "freq_chart": return lintFreqChartAgainstText(spec, passage);
    case "stacked_bar": return lintStackedBarAgainstText(spec, passage);
  }
}
