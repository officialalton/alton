// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import katex from "katex";
import { scanRawMath } from "./raw-math-scan";

const scan = (html: string, allow?: string[]) => { const d = document.createElement("div"); d.innerHTML = html; document.body.appendChild(d); const r = scanRawMath(d, allow); d.remove(); return r.map((h) => h.kind); };

describe("scanRawMath — 양성(진짜 원문 수식)", () => {
  it.each([
    ["산문 속 TeX 지수", "<p>C(t) = 2.4 + 0.9 t e^{-0.25 t}, in million cells</p>", "tex-script"],
    ["산문 속 \\frac", "<p>The correct answer is \\frac{5}{7}.</p>", "tex-command"],
    ["산문 속 \\pi", "<p>The volume is 100 \\pi cubic units.</p>", "tex-command"],
    ["산문 부등호 <=", "<p>for 0 <= t <= 12 hours</p>", "ascii-inequality"],
    ["산문 부등호 >=", "<p>with t>=0</p>", "ascii-inequality"],
    ["평문 거듭제곱", "<p>the area is x^2 square units</p>", "plain-exponent"],
    ["렌더 안 된 $...$", "<p>Let $f$ be defined by $f(x)=x$</p>", "unrendered-dollar-math"],
    ["유니코드 이스케이프 문자열", "<p>Rewrite 3/\\u221ax</p>", "unicode-escape"],
    ["표 칸의 평문 지수", "<table><tr><td>area (m^2)</td></tr></table>", "plain-exponent"],
  ])("%s", (_n, html, kind) => { expect(scan(html)).toContain(kind); });
});

describe("scanRawMath — 음성(정당한 글자·코드·렌더된 수식)", () => {
  it("KaTeX 로 렌더된 수식은 통과(숨은 MathML·annotation 안의 TeX 포함)", () => {
    const html = katex.renderToString("C(t)=2.4+0.9te^{-0.25t}\\le \\frac{5}{7}", { throwOnError: false });
    expect(scan(`<p>The model is ${html} for $t$ in hours</p>`.replace("for $t$", "for t"))).toEqual([]);
  });
  it("코드 블록·인라인 코드의 x^2 와 <= 는 정당", () => {
    expect(scan("<pre><code>if (x <= y) { z = x^2; }</code></pre><p>Use <code>a^b</code> and <kbd>^C</kbd>.</p>")).toEqual([]);
  });
  it("이스케이프된 달러·통화 표기는 수식이 아니다", () => {
    expect(scan("<p>The ticket costs \\$5 and the parking costs \\$10.</p>")).toEqual([]);
    expect(scan("<p>It costs $45 for a site visit.</p>")).toEqual([]);
  });
  it("일반 문장·단순 부등호 기호·화살표", () => {
    expect(scan("<p>Which statement is true? If x < 3 then y > 2. Items A -> B and 5 > 3.</p>")).toEqual([]);
    expect(scan("<p>The pH is 7.4; temperature 37\u00b0C; rate \u2264 5 and \u2265 2.</p>")).toEqual([]);
  });
  it("허용 목록(allow)에 든 토큰은 무시", () => {
    expect(scan("<p>Syntax: a^b is XOR in some languages.</p>", ["a^b"])).toEqual([]);
  });
  it("[data-raw-math-ok] 영역은 제외", () => {
    expect(scan('<p>Intro</p><div data-raw-math-ok><p>x^2 <= 3</p></div>')).toEqual([]);
  });
});
