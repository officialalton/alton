import { describe, expect, it } from "vitest";
import { apPassageForDisplay, passageDuplicatesStem } from "./stimulus-display";

const STEM = "A bacterial culture's concentration is modeled by $C(t) = 2.4 + 0.9 t e^{-0.25 t}$, in million cells per mL, where $t$ is in hours and $0 \\le t \\le 12$. At what time is the concentration greatest?";
describe("자료 텍스트가 본문과 겹치면 숨긴다", () => {
  it("리뷰 환경에서 발견된 원문 TeX 중복 문장", () => {
    const passage = "A bacterial culture concentration model C(t) = 2.4 + 0.9 t e^{-0.25 t}, in million cells per mL, with t in hours, 0 <= t <= 12.";
    expect(passageDuplicatesStem(passage, STEM)).toBe(true);
    expect(apPassageForDisplay(passage, STEM)).toBeNull();
  });
  it("짧은 설명 문장(본문이 이미 말함)도 숨긴다", () => {
    expect(apPassageForDisplay("A household's monthly electricity cost model.", "A household's monthly electricity cost, in dollars, for using $x$ kWh is modeled by $C(x)=20$. Which...")).toBeNull();
  });
  it("본문에 없는 정보는 남기고 수식을 입힌다", () => {
    const out = apPassageForDisplay("Experimental data show the decay constant is e^{-0.25 t} per hour under baseline conditions.", "Which choice is correct?");
    expect(out).toContain("$e^{-0.25 t}$");
  });
  it("자료가 없으면 null", () => { expect(apPassageForDisplay(null, "x")).toBeNull(); expect(apPassageForDisplay("  ", "x")).toBeNull(); });
});
