import { describe, expect, it } from "vitest";
import { gateCandidate, type ApCandidateLike } from "./gate";

const cand = (data: Record<string, unknown>, stem: string): ApCandidateLike => ({ candidateKey: "t", apSubjectCode: "ap_statistics", kind: "mc", payload: { stem, options: ["a", "b", "c", "d"], stimulus: { kind: "stat_chart", description: "figure", data } } });
const STEM = "The histogram shown summarizes the data.";
const normal = (mean: number, sd: number, lo: number, hi: number) => Array.from({ length: 81 }, (_, i) => { const x = lo + ((hi - lo) * i) / 80; return [x, Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))]; });

describe("ap_stat_chart adapter (SAT chart templates -> AP figure gate)", () => {
  it("passes a histogram and reports its render type, need and English alt", () => {
    const r = gateCandidate(cand({ chart: "histogram", data: { xTitle: "Time (min)", yTitle: "Frequency", bins: [{ from: 0, to: 10, count: 3 }, { from: 10, to: 20, count: 8 }, { from: 20, to: 30, count: 5 }] } }, STEM));
    expect(r.status).toBe("pass"); expect(r.renderType).toBe("ap_stat_chart:histogram"); expect(r.need).toBe("required"); expect(r.alt).toMatch(/^Histogram/);
  });
  it("rejects unequal class widths in a histogram", () => {
    const r = gateCandidate(cand({ chart: "histogram", data: { bins: [{ from: 0, to: 10, count: 3 }, { from: 10, to: 25, count: 8 }] } }, STEM));
    expect(r.status).toBe("fail"); expect(r.issues.map((i) => i.code)).toContain("histogram_unequal_bins");
  });
  it("draws boxplot outliers and rejects an outlier inside the whiskers", () => {
    const box = (outliers: number[]) => cand({ chart: "boxplot", data: { xTitle: "Minutes", boxes: [{ name: "Route A", min: 10, q1: 14, median: 17, q3: 21, max: 27, outliers }] } }, "The boxplot shown summarizes the times.");
    const ok = gateCandidate(box([41]));
    expect(ok.status).toBe("pass"); expect(ok.output).toContain("<circle"); expect(ok.alt).toMatch(/outliers at 41/);
    expect(gateCandidate(box([20])).status).toBe("fail");
  });
  it("highlights a scatterplot point with an explicit axis range", () => {
    const r = gateCandidate(cand({ chart: "scatter", data: { xTitle: "Hours", yTitle: "Score", xMin: 10, xMax: 30, xStep: 5, points: [[12, 50], [15, 56], [20, 66], [25, 75], [28, 40]], highlights: [{ index: 4, label: "P" }] } }, "The scatterplot shown displays the data."));
    expect(r.status).toBe("pass"); expect(r.alt).toMatch(/Highlighted point/);
  });
  it("renders a two-way table and a probability tree, and rejects a tree whose probabilities do not sum to 1", () => {
    expect(gateCandidate(cand({ chart: "two_way", data: { rowHeader: "Sport", rowLabels: ["Yes", "No"], colLabels: ["Junior", "Senior"], cells: [[20, 30], [40, 10]] } }, "The two-way table shown summarizes a survey.")).status).toBe("pass");
    const tree = (p: string) => cand({ chart: "tree", tree: { branches: [{ name: "A", label: p, next: [{ name: "X", label: "0.4" }, { name: "Y", label: "0.6" }] }, { name: "B", label: "0.7", next: [{ name: "X", label: "0.2" }, { name: "Y", label: "0.8" }] }] } }, "The probability tree shown models the process.");
    expect(gateCandidate(tree("0.3")).status).toBe("pass");
    expect(gateCandidate(tree("0.5")).issues.map((i) => i.code)).toContain("tree_probabilities_not_one");
  });
  it("renders a dual-scale density curve with a shaded tail and rejects a non-density curve", () => {
    const good = cand({ chart: "curve", title: "Normal distribution", curve: { family: "normal", x: { label: "Weight (g)", min: 40, max: 80, ticks: [40, 50, 60, 70, 80] }, z: { mean: 60, sd: 5, ticks: [-4, -2, 0, 2, 4] }, points: normal(60, 5, 40, 80), shades: [{ from: 65, to: 80 }], marks: [{ at: 65, label: "65" }] } }, "The normal curve shown models the weights.");
    const r = gateCandidate(good);
    expect(r.issues).toEqual([]); expect(r.status).toBe("pass"); expect(r.output).toContain("<polygon"); expect(r.alt).toMatch(/second z-score scale/);
    const bad = cand({ chart: "curve", curve: { x: { label: "x", min: 40, max: 80, ticks: [40, 60, 80] }, points: normal(60, 5, 40, 80).map(([x, y]) => [x, y * 3]) } }, "The curve shown is a model.");
    expect(gateCandidate(bad).issues.map((i) => i.code)).toContain("curve_not_density");
  });
  it("renders a computer-output block and rejects empty cells", () => {
    const out = (cell: string | number) => cand({ chart: "output", output: { title: "Chi-Square Test", sections: [{ columns: ["Statistic", "Value"], rows: [["Chi-square", 6.84], ["df", 2], ["P-value", cell]] }] } }, "The computer output shown is from a chi-square test.");
    const ok = gateCandidate(out(0.0327));
    expect(ok.status).toBe("pass"); expect(ok.alt).toMatch(/^Computer output/);
    expect(gateCandidate(out("")).issues.map((i) => i.code)).toContain("output_empty_cell");
  });
  it("fails on an unknown chart kind", () => { expect(gateCandidate(cand({ chart: "pie3d" }, STEM)).status).toBe("fail"); });
});
