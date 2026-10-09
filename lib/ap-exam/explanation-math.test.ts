import { describe, expect, it } from "vitest";
import { RAW_TEX_TOKENS, autoMathExplanation } from "./explanation-math";

describe("autoMathExplanation", () => {
  it("TeX 명령·거듭제곱·pi 에 $...$ 를 입힌다", () => {
    expect(autoMathExplanation("The correct answer is 100 \\pi.")).toBe("The correct answer is $100 \\pi$.");
    expect(autoMathExplanation("\\frac{500 \\pi}{3} is incorrect")).toBe("$\\frac{500 \\pi}{3}$ is incorrect");
    expect(autoMathExplanation("so C'(t)=3e^t and e^{-0.25t} decays")).toContain("$e^{-0.25t}$");
    expect(autoMathExplanation("only solution is 3pi/4")).toContain("$3\\pi$/4");
    expect(autoMathExplanation("(4/3) pi (5)^3")).toBe("(4/3) $\\pi$ $(5)^3$");
    expect(autoMathExplanation("cos pi=-1")).toBe("cos $\\pi$=-1");
    expect(autoMathExplanation("at e^pi")).toBe("at $e^\\pi$");
  });
  it("\\displaystyle 적분 덩어리를 한 수식으로", () => {
    const out = autoMathExplanation("\\displaystyle\\int_0^{3} x^2 \\, dx equals 9.");
    expect(out).toBe("$\\displaystyle\\int_0^{3} x^2 \\, dx$ equals 9.");
  });
  it("이미 $...$ 인 수식과 일반 문장은 그대로", () => {
    expect(autoMathExplanation("Since $x^2$ is positive, the pie chart is fine.")).toBe("Since $x^2$ is positive, the pie chart is fine.");
    expect(autoMathExplanation("Costs \\$5 each.")).toBe("Costs \\$5 each.");
    expect(autoMathExplanation("Plain words only.")).toBe("Plain words only.");
  });
  it("글자 그대로의 \\uXXXX 를 문자로 바꾼다", () => {
    expect(autoMathExplanation("Rewrite 3/\\u221ax as 3x")).toContain("3/√x");
  });
  it("변환 후 화면 텍스트에 원문 TeX 가 남지 않는 판정 정규식", () => {
    expect(RAW_TEX_TOKENS.test("The answer is \\frac{1}{2}")).toBe(true);
    expect(RAW_TEX_TOKENS.test("e^{-x}")).toBe(true);
    expect(RAW_TEX_TOKENS.test("The answer is 100π.")).toBe(false);
  });
  it("여러 줄 해설: 앞줄 숫자·마침표를 수식에 끌어들이지 않는다", () => {
    const src = "The correct answer is \\frac{5}{7}. Cancels.\n\\frac{5}{14} is incorrect: giving 5/14 instead of 10/14.\n\\frac{10}{9} is incorrect.";
    expect(autoMathExplanation(src)).toBe("The correct answer is $\\frac{5}{7}$. Cancels.\n$\\frac{5}{14}$ is incorrect: giving 5/14 instead of 10/14.\n$\\frac{10}{9}$ is incorrect.");
  });
  it("\\left/\\right·대괄호·소수·삼각함수가 섞인 식도 한 수식으로", () => {
    expect(autoMathExplanation("\\displaystyle\\int_0^{3}\\left(3x+x^2\\right)dx is incorrect: Adds.")).toBe("$\\displaystyle\\int_0^{3}\\left(3x+x^2\\right)dx$ is incorrect: Adds.");
    const m = autoMathExplanation("V = \\pi\\int_0^3.154\\left[(\\sin x+3.5+2)^2-(x^2/4+1+2)^2\\right]dx (≈ 223.064)");
    expect(m).toContain("$\\pi\\int_0^3.154\\left[(\\sin x+3.5+2)^2-(x^2/4+1+2)^2\\right]dx$");
  });
});

import { readFileSync } from "node:fs";
import katex from "katex";
describe("부등호·괄호 지수·대괄호 거듭제곱", () => {
  it("산문 부등호 사슬", () => {
    expect(autoMathExplanation("with t in minutes, 0 <= t <= 6.")).toBe("with t in minutes, $0 \\le t \\le 6$.");
    expect(autoMathExplanation("negative for x<=2 and")).toBe("negative for $x\\le 2$ and");
    expect(autoMathExplanation("when t >= 0, then")).toBe("when $t \\ge 0$, then");
    expect(autoMathExplanation("5 > 3 and a < b")).toBe("5 > 3 and a < b"); // <=·>= 가 없으면 그대로
  });
  it("괄호 지수는 중괄호로, 대괄호 밑도 처리", () => {
    expect(autoMathExplanation("H(t) = 20 + 50 e^(- 0.3t) for")).toContain("$e^{- 0.3t}$");
    expect(autoMathExplanation("/[g(2)]^2 = 24/9")).toContain("$[g(2)]^2$");
  });
});

describe("재고 전수: 정규화 뒤 $...$ 밖에 원문 TeX 가 남지 않는다", () => {
  it("items.json·s1a-items.json 의 해설·모범 답안", () => {
    const items = [...JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")), ...JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8"))] as { stockKey: string; validation: string; payload: { explanation_en?: string; parts?: { model_answer?: string }[] } }[];
    const outside = (t: string) => t.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, " ");
    const bad: string[] = [];
    for (const i of items.filter((x) => x.validation === "auto_passed")) {
      const texts = [i.payload.explanation_en, ...(i.payload.parts ?? []).map((p) => p.model_answer)].filter((x): x is string => typeof x === "string");
      for (const t of texts) {
        const out = autoMathExplanation(t);
        const hit = RAW_TEX_TOKENS.exec(outside(out)); if (hit) bad.push(`${i.stockKey}: ${hit[0]}`);
        // 입힌 모든 $...$ 가 KaTeX 로 파싱돼야 한다(깨지면 화면에는 원문이 그대로 보인다).
        for (const m of out.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) { try { katex.renderToString(m[1] ?? m[2], { throwOnError: true }); } catch { bad.push(`${i.stockKey}: KaTeX 파싱 실패 ${(m[1] ?? m[2]).slice(0, 50)}`); } }
      }
    }
    expect(bad).toEqual([]);
  });
});
