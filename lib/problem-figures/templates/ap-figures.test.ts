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
