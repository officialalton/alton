import { describe, expect, it } from "vitest";
import { escMath, renderApTable } from "./ap-figures";

describe("escMath(표 글자의 평문 수식)", () => {
  it("거듭제곱·부등호를 읽기 좋게, 나머지는 이스케이프", () => {
    expect(escMath("area (m^2)")).toBe("area (m<sup>2</sup>)");
    expect(escMath("SA:V (units^-1)")).toBe("SA:V (units<sup>-1</sup>)");
    expect(escMath("(t - 6) e^(-0.3 t)")).toContain("e<sup>-0.3 t</sup>");
    expect(escMath("10^-18 mol")).toBe("10<sup>-18</sup> mol");
    expect(escMath("t>=0 and t<=12")).toBe("t≥0 and t≤12");
    expect(escMath("<b>x</b> & y")).toBe("&lt;b&gt;x&lt;/b&gt; &amp; y");
  });
  it("표 렌더에 적용된다", () => {
    const r = renderApTable({ type: "ap_table", title: "Rate (mol/m^2)", columns: ["t", "f(t)"], rows: [["1", "e^(-0.3 t)"]] } as never);
    expect(r.markup).toContain("m<sup>2</sup>");
    expect(r.markup).not.toContain("^");
  });
});

describe("표 숫자 셀은 저장된 정밀도를 유지한다(감사 R6: 주기 0.442 가 0.44 로 보이던 문제)", () => {
  it("소수 3자리 값은 반올림 없이 보이고, 부동소수 잡음과 천 단위만 정리한다", () => {
    const r = renderApTable({ type: "ap_table", columns: ["m", "T"], rows: [[0.1, 0.442], [0.2, 0.30000000000000004], [1900000, 1234.5678]] } as never);
    expect(r.markup).toContain(">0.442<");
    expect(r.markup).toContain(">0.3<");
    expect(r.markup).toContain(">1,900,000<");
    expect(r.markup).toContain(">1,234.5678<");
    expect(r.markup).not.toContain(">0.44<");
  });
});

describe("ap_stat_chart: SVG 의 접근성 라벨은 영어이고 이상치를 포함한다(감사 R6, Statistics 1 MC35)", () => {
  it("상자그림 aria-label·<title> 에 이상치 79 가 있고 한글이 없다", async () => {
    const { renderApStatChart } = await import("./ap-stat-chart");
    const r = renderApStatChart({ type: "ap_stat_chart", chart: "boxplot", data: { boxes: [{ name: "Program A", min: 34, q1: 40, median: 46, q3: 50, max: 53, outliers: [] }, { name: "Program B", min: 49, q1: 54, median: 59, q3: 62, max: 66, outliers: [79] }], xTitle: "Time to run a mile (minutes)" } } as never);
    expect(r.svg).toContain('aria-label="Boxplot.');
    expect(r.svg).toContain("outliers at 79");
    expect(r.svg).not.toMatch(/[가-힣]/);
    expect(r.alt).toContain("outliers at 79");
  });
  it("수형도·히스토그램·산점도 라벨도 영어로 바뀐다", async () => {
    const { englishAltInMarkup } = await import("./ap-stat-chart");
    expect(englishAltInMarkup('<svg aria-label="산점도(점 3개)"><title>산점도(점 3개)</title></svg>', "Scatterplot of 3 points.")).toBe('<svg aria-label="Scatterplot of 3 points."><title>Scatterplot of 3 points.</title></svg>');
    expect(englishAltInMarkup('<svg aria-label="Already English"><title>Already English</title></svg>', "x")).toContain("Already English");
  });
});
