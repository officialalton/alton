import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { checkFigure } from "../check";
import { lintDataAgainstText, renderData, validateData, type DataSpec } from "./data";

// 표준 렌더링 엔진 템플릿 4 — 표·데이터 그래프. 대표 10문항 통과, 항목·값·단위 불일치와 지원하지 않는 유형은 거부.

export const SAMPLES: { name: string; spec: DataSpec; passage: string }[] = [
  { name: "값 표(불량률)", spec: { type: "data", kind: "table", columns: ["Shift", "Bottles Inspected", "Defective Bottles"], rows: [["1", 240, 6], ["2", 300, 9], ["3", 180, 3], ["4", 350, 14], ["5", 280, 7]] }, passage: "The table shows bottles inspected and defective bottles for five shifts. Shift 4 had 14 defective bottles. Based on the shift with the highest defect rate, which is the closest estimate of the number of defective bottles in a day of 42,000 bottles?" },
  { name: "함수표", spec: { type: "data", kind: "table", columns: ["x", "f(x)"], rows: [[0, 5], [1, 8], [2, 11], [3, 14]] }, passage: "The table gives values of the linear function f for selected values of x. Which equation defines f?" },
  { name: "빈도표(비율)", spec: { type: "data", kind: "table", columns: ["Response", "Frequency"], rows: [["Yes", 42], ["No", 33], ["Undecided", 25]] }, passage: "The table shows the responses of 100 randomly selected voters. What percent of the respondents answered \"Undecided\"?" },
  { name: "숫자 목록", spec: { type: "data", kind: "number_list", values: [3, 5, 5, 8, 12, 12, 12, 15], label: "Data set A" }, passage: "The data set A is shown. What is the difference between the median and the mode?" },
  { name: "막대그래프(두 계열, 단위)", spec: { type: "data", kind: "bar", title: "Monthly Sales", categories: ["Jan", "Feb", "Mar", "Apr"], series: [{ name: "Store A", values: [1200, 1500, 1100, 1800] }, { name: "Store B", values: [900, 1300, 1600, 1400] }], yTitle: "Sales (dollars)" }, passage: "The bar graph shows monthly sales, in dollars, for two stores. In March, Store B had sales of 1,600. By what percent did Store A's sales increase from March to April?" },
  { name: "선그래프(속도)", spec: { type: "data", kind: "line", categories: ["0", "1", "2", "3", "4", "5"], series: [{ values: [0, 40, 80, 80, 120, 160] }], xTitle: "Time (hours)", yTitle: "Distance (miles)" }, passage: "The graph shows the distance, in miles, a car traveled over 5 hours. During which hour was the car's speed 0 miles per hour?" },
  { name: "히스토그램", spec: { type: "data", kind: "histogram", bins: [{ from: 0, to: 10, count: 3 }, { from: 10, to: 20, count: 7 }, { from: 20, to: 30, count: 12 }, { from: 30, to: 40, count: 5 }, { from: 40, to: 50, count: 1 }], xTitle: "Minutes spent", yTitle: "Number of students" }, passage: "The histogram shows the minutes 28 students spent on homework. How many students spent at least 20 minutes?" },
  { name: "산점도·추세선", spec: { type: "data", kind: "scatter", points: [[1, 2.1], [2, 2.9], [3, 4.2], [4, 4.8], [5, 6.1], [6, 6.8], [7, 7.9]], fitLine: { slope: 0.95, intercept: 1.1 }, xTitle: "Hours studied", yTitle: "Score (points)" }, passage: "The scatterplot shows hours studied and score, in points, for 7 students, with the line of best fit. For a student who studied 4 hours, how much greater is the actual score than the predicted score?" },
  { name: "상자그림 두 개", spec: { type: "data", kind: "boxplot", boxes: [{ name: "Class A", min: 55, q1: 65, median: 72, q3: 80, max: 95 }, { name: "Class B", min: 60, q1: 70, median: 75, q3: 85, max: 90 }], xTitle: "Test score" }, passage: "The box plots summarize test scores for Class A and Class B. Which statement about the interquartile ranges is true?" },
  { name: "확률 2×2 표", spec: { type: "data", kind: "table", columns: ["", "Passed", "Failed", "Total"], rows: [["Studied", 36, 4, 40], ["Did not study", 14, 16, 30], ["Total", 50, 20, 70]] }, passage: "The table shows study habits and results for 70 students. If a student who passed is chosen at random, what is the probability that the student studied?" },
  // 2026-09-14 보완(SAT Test 6~11 대조): 점도표·양방향 표·문장형 자료
  { name: "점도표", spec: { type: "data", kind: "dot_plot", dots: [{ value: 1, count: 2 }, { value: 2, count: 4 }, { value: 3, count: 5 }, { value: 4, count: 3 }, { value: 5, count: 1 }], xTitle: "Number of pets" }, passage: "The dot plot shows the number of pets for 15 households. What is the median number of pets?" },
  { name: "양방향 표(합계 자동)", spec: { type: "data", kind: "two_way", rowHeader: "Grade", rowLabels: ["9th", "10th"], colLabels: ["Bus", "Walk", "Car"], cells: [[42, 18, 30], [36, 24, 40]] }, passage: "The two-way table shows how students in 9th and 10th grade travel to school. 10th grade students who take the bus number 36. If a 9th grade student is selected at random, what is the probability the student walks?" },
  { name: "문장형 자료(표본·오차범위)", spec: { type: "data", kind: "statement", title: "Survey summary", facts: [{ label: "Sample size", value: 400 }, { label: "Estimated proportion", value: 0.62 }, { label: "Margin of error", value: 4, unit: "percentage points" }], note: "The sample was selected at random from all adults in the city." }, passage: "A random sample of 400 adults in a city found an estimated proportion of 0.62 who support the plan, with a margin of error of 4 percentage points. Which is the most appropriate conclusion?" },
  // 매트릭스 '부분' 해소 — 통계적 주장 판단(관찰 연구·실험)
  { name: "통계적 주장 판단(연구 설계)", spec: { type: "data", kind: "statement", title: "Study design", facts: [{ label: "Participants", value: 200 }, { label: "Assignment", value: "random, to two groups" }, { label: "Group A treatment", value: "new fertilizer" }, { label: "Group B treatment", value: "standard fertilizer" }], note: "Plants were selected at random from one greenhouse." }, passage: "A researcher randomly assigned 200 plants from one greenhouse to two groups: Group A received a new fertilizer and Group B received the standard fertilizer. Group A grew taller on average. Which conclusion is best supported?" },
];

describe("템플릿 4 — 대표 문제 10개는 검증을 통과한다", () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const r = renderData(s.spec);
      expect(r.issues).toEqual([]);
      expect(r.markup.startsWith("<svg") || r.markup.startsWith("<div")).toBe(true);
      expect(lintDataAgainstText(s.spec, s.passage)).toEqual([]);
      expect(checkFigure(s.spec, s.passage).ok).toBe(true);
    });
  }
  it("표본 페이지를 남긴다(스크린샷용)", () => {
    if (!process.env.T4_SAMPLES_OUT) return;
    const cards = SAMPLES.map((s) => { const r = renderData(s.spec); return `<div class="card"><h3>${s.name}</h3>${r.markup}<p class="alt">${r.alt}</p><p class="iss">${r.issues.length ? r.issues.map((x) => x.message).join("<br>") : "검증 통과"}</p></div>`; });
    writeFileSync(process.env.T4_SAMPLES_OUT, `<!doctype html><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;margin:0;padding:16px;background:#fff;color:#111}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px}.card{border:1.5px solid #ddd;border-radius:12px;padding:12px}.card h3{font-size:13px;margin:0 0 6px}.card svg{max-width:100%;height:auto;display:block}.alt{font-size:11px;color:#666;margin:6px 0 0}.iss{font-size:11px;color:#0a7;margin:4px 0 0}</style><h2 style="font-size:15px;margin:0 0 10px">템플릿 4 표준 렌더러 — 대표 10문항 (std-1)</h2><div class="grid">${cards.join("")}</div>`);
  });
});

describe("템플릿 4 — 거부", () => {
  it("지문의 값이 표·그래프와 다르면 값 불일치, 없는 항목·단위 누락은 참조 불일치", () => {
    const table = SAMPLES[0].spec;
    const i1 = lintDataAgainstText(table, "Shift 4 had 12 defective bottles.");
    expect(i1.some((i) => i.code === "ref_mismatch" && i.message.includes("14"))).toBe(true);
    const i2 = lintDataAgainstText(table, 'The "Rejected Bottles" column shows the count for the Night shift row.');
    expect(i2.filter((i) => i.code === "ref_missing").length).toBeGreaterThanOrEqual(1);
    const bar = SAMPLES[4].spec;
    expect(lintDataAgainstText(bar, "In March, Store B had sales of 1,500.").some((i) => i.code === "ref_mismatch")).toBe(true);
    const noUnit: DataSpec = { ...bar, yTitle: "Sales" };
    expect(lintDataAgainstText(noUnit, "Monthly sales, in dollars, are shown.").some((i) => i.code === "unit_missing")).toBe(true);
  });
  it("종류 이름 아래에 필드를 넣은 모양({kind:'table', table:{…}})도 같은 뜻으로 받는다(AI 실례)", () => {
    const v = validateData({ type: "data", kind: "table", title: "t", table: { columns: ["Shift", "Defective"], rows: [["1", 6]] } });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.columns).toEqual(["Shift", "Defective"]);
  });
  it("지원하지 않는 자료 유형·행 길이 불일치·범례 없는 다중 계열·끊어진 히스토그램·상자 순서 오류는 스키마에서 거부", () => {
    expect(validateData({ type: "data", kind: "pie", values: [1, 2] }).ok).toBe(false);
    expect(validateData({ type: "data", kind: "table", columns: ["a", "b"], rows: [[1]] }).ok).toBe(false);
    expect(validateData({ type: "data", kind: "bar", categories: ["a", "b"], series: [{ values: [1, 2] }, { values: [3, 4] }] }).ok).toBe(false);
    expect(validateData({ type: "data", kind: "histogram", bins: [{ from: 0, to: 10, count: 1 }, { from: 20, to: 30, count: 2 }] }).ok).toBe(false);
    expect(validateData({ type: "data", kind: "boxplot", boxes: [{ name: "A", min: 5, q1: 3, median: 4, q3: 6, max: 9 }] }).ok).toBe(false);
  });
  it("양방향 표·문장형 자료의 값이 지문과 다르면 값 불일치, 합계 행을 직접 넣으면 거부", () => {
    const tw = SAMPLES.find((x) => x.name.startsWith("양방향"))!.spec;
    expect(lintDataAgainstText(tw, "10th grade students who take the bus number 40.").some((i) => i.code === "ref_mismatch")).toBe(true);
    expect(validateData({ ...tw, rowLabels: ["9th", "Total"] }).ok).toBe(false);
    const st = SAMPLES.find((x) => x.name.startsWith("문장형"))!.spec;
    expect(lintDataAgainstText(st, "The margin of error was 6 percentage points.").some((i) => i.code === "ref_mismatch")).toBe(true);
    expect(validateData({ type: "data", kind: "dot_plot", dots: [{ value: 1, count: 2 }, { value: 1, count: 3 }] }).ok).toBe(false);
  });
  it("세로축 범위를 좁게 정하면 값이 범위 밖으로 잡히고, 긴 범주 이름은 라벨 문제로 잡힌다", () => {
    const r = renderData({ type: "data", kind: "bar", categories: ["A", "B"], series: [{ values: [10, 50] }], yMin: 0, yMax: 20 });
    expect(r.issues.some((i) => i.code === "out_of_range")).toBe(true);
    const r2 = renderData({ type: "data", kind: "bar", categories: ["An extremely long category name that cannot fit", "B", "C", "D", "E", "F", "G", "H"], series: [{ values: [1, 2, 3, 4, 5, 6, 7, 8] }] });
    expect(r2.issues.some((i) => i.code === "label_collision")).toBe(true);
  });
});
