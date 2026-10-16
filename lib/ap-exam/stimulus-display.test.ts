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

describe("AP English Language 지문(2026-10-14): stem 이 지문 문장을 인용해도 숨기지 않는다", () => {
  const short = "ALTON original passage\nThe Library Night\n\n[1] The library stayed open late on Fridays. [2] Nobody complained about the quiet evenings.";
  const quotingStem = "The Library Night: The library stayed open late on Fridays. Nobody complained about the quiet evenings. The writer wants to combine the sentences; which choice does so most effectively?";
  it("짧은 지문을 인용하는 stem 에서도 지문이 남는다(일반 자료였다면 중복으로 숨겨졌을 모양)", () => {
    expect(passageDuplicatesStem(short, quotingStem)).toBe(true); // 같은 모양의 일반 텍스트는 여전히 숨김
    expect(apPassageForDisplay(short, quotingStem)).toBe(short);
  });
  it("산문을 수식으로 바꾸지 않는다(지수·아래첨자 모양 글자가 있어도 그대로)", () => {
    const p = "ALTON original passage\nTitle\n\n¶1 The ratio 2^3 and x_1 are discussed, but only as words.";
    expect(apPassageForDisplay(p, "Which choice best describes paragraph 1?")).toBe(p);
  });
  it("표지가 없는 같은 글은 기존 규칙(중복 숨김)을 그대로 따른다", () => {
    expect(apPassageForDisplay("The Library Night\n\n[1] The library stayed open late on Fridays. [2] Nobody complained about the quiet evenings.", quotingStem)).toBeNull();
  });
});

import { REAL_TEXT_MARKER as REAL_MARKER_T, isEnglishPassage as isEnT } from "./stimulus-display";
describe("real public-domain text marker (2026-10-15)", () => {
  it("is treated as an English passage (shown verbatim, never math-converted)", () => { expect(isEnT(`${REAL_MARKER_T}\nTitle\n\n\`\`\`passage\nA line\n\`\`\``)).toBe(true); });
  it("is treated as an English passage with the attribution first line, shown verbatim", () => { const p = `${REAL_MARKER_T} — Emily Dickinson, The Chariot, Poems by Emily Dickinson (1890)\nThe Chariot\n\n\`\`\`passage\nBecause I could not stop for Death\n\`\`\``; expect(isEnT(p)).toBe(true); expect(apPassageForDisplay(p, "The speaker could not stop for Death")).toBe(p); expect(isEnT(`${REAL_MARKER_T}x\nTitle`)).toBe(false); });
});

import { apPassageForDisplay as _apd, US_REAL_SOURCE_MARKER as _usm } from "./stimulus-display";
describe("apPassageForDisplay: 자료 종류 내부 표기 줄", () => {
  it("'(table)' 줄만 학생 화면에서 뺀다", () => {
    const p = `${_usm}\n(table)\nForeign-born population, 1850-1940\nSource line.`;
    expect(_apd(p, "stem")).toBe(`${_usm}\nForeign-born population, 1850-1940\nSource line.`);
  });
  it("본문 중간의 괄호 단어는 건드리지 않는다", () => {
    const p = `${_usm}\nThe (table) shows data.`;
    expect(_apd(p, "stem")).toBe(p);
  });
});
