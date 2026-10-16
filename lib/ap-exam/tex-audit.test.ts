// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import katex from "katex";
import { autoMathExplanation } from "./explanation-math";
import { findUnwrappedAfterDisplay, findUnwrappedMath, auditPayload } from "./tex-audit";
import { scanRawMath } from "./raw-math-scan";
import { answerTextForExplanation, gateMathWrapping } from "../ap-generation/math-wrapping";
import { buildAuditReport } from "./tex-audit-report";

const EXPL_BAD = "The correct answer is \\frac{1}{10}. Limit read from the values the function approaches (rationalizing gives 1/(2c)).";
const FRQ_BAD = "V = \\pi\\int_0^2.746\\left[(\\sin x+2.5+2)^2-(x^2/4+1+2)^2\\right]dx (≈ 117.632)";
const FRQ_BAD2 = "Area = ∫₀^2.746 (f(x) − g(x)) dx = 4.316";

describe("원문 수식 점검 — 코디네이터 보고 두 사례", () => {
  it("저장 원문 단계에서 잡힌다", () => {
    expect(findUnwrappedMath(EXPL_BAD).map((h) => h.kind)).toContain("tex-command");
    expect(findUnwrappedMath(FRQ_BAD).map((h) => h.kind)).toContain("tex-command");
    expect(findUnwrappedMath(FRQ_BAD2).map((h) => h.kind)).toContain("unicode-script-caret");
  });
  it("수식 구분자 안의 TeX 는 통과(`$..$`, `$$..$$`, `\\(..\\)`)", () => {
    expect(findUnwrappedMath("The correct answer is $\\frac{1}{10}$.")).toEqual([]);
    expect(findUnwrappedMath("V = $\\pi\\int_0^{2.746}\\left[x\\right]dx$ (≈ 117.632)")).toEqual([]);
    expect(findUnwrappedMath("so \\(\\frac{1}{2}\\) and $$\\sqrt{3}$$")).toEqual([]);
    expect(findUnwrappedMath("It costs \\$5 and \\$10.")).toEqual([]);
  });
  it("화면 변환(autoMath) 뒤에는 세 사례 모두 구분자 안으로 들어간다", () => {
    for (const t of [EXPL_BAD, FRQ_BAD, FRQ_BAD2]) expect(findUnwrappedAfterDisplay(t)).toEqual([]);
    expect(autoMathExplanation(FRQ_BAD2)).toContain("$\\int_{0}^{2.746}$");
  });
  it("화면 DOM 점검(scanRawMath)도 같은 사례를 잡는다(변환 전 텍스트 기준)", () => {
    for (const t of [EXPL_BAD, FRQ_BAD, FRQ_BAD2]) {
      const d = document.createElement("div"); d.textContent = t; document.body.appendChild(d);
      expect(scanRawMath(d).length).toBeGreaterThan(0); d.remove();
    }
  });
  it("lim_{x->inf} 도 구분자 안으로, KaTeX 로 파싱된다", () => {
    const out = autoMathExplanation("lim_{x->-inf} g(x)=-1");
    expect(out).toContain("$\\lim_{x\\to -\\infty}$");
    expect(() => katex.renderToString("\\lim_{x\\to -\\infty}", { throwOnError: true })).not.toThrow();
  });
});

describe("생성 게이트 gateMathWrapping", () => {
  it("해설·모범 답안의 구분자 밖 TeX 를 거부한다", () => {
    expect(gateMathWrapping({ explanation_en: EXPL_BAD })).toContain("unwrapped_math:explanation:tex-command");
    expect(gateMathWrapping({ parts: [{ label: "c", model_answer: FRQ_BAD }] })).toContain("unwrapped_math:part_c_answer:tex-command");
    expect(gateMathWrapping({ parts: [{ label: "a", model_answer: FRQ_BAD2 }] })).toContain("unwrapped_math:part_a_answer:unicode-script-caret");
  });
  it("정상 항목은 통과", () => {
    expect(gateMathWrapping({ stem: "Find $\\lim_{x\\to 5} f(x)$.", options: [{ text: "$\\frac{1}{10}$" }], explanation_en: "The correct answer is $\\frac{1}{10}$. rationalizing gives 1/(2c).", parts: [{ label: "c", prompt: "Write $V$.", model_answer: "V = $\\pi\\int_0^{2.746}x\\,dx$ (≈ 117.632)" }] })).toEqual([]);
  });
  it("해설 조립: TeX 선택지는 $ 유지, 단순 숫자는 기존처럼 $ 제거", () => {
    expect(answerTextForExplanation("$\\frac{1}{10}$")).toBe("$\\frac{1}{10}$");
    expect(answerTextForExplanation("$e^{2}$")).toBe("$e^{2}$");
    expect(answerTextForExplanation("$5$")).toBe("5");
    expect(`The correct answer is ${answerTextForExplanation("$\\frac{1}{10}$")}.`).toBe("The correct answer is $\\frac{1}{10}$.");
  });
});

describe("재고 전수 — 학생·관리자가 읽는 필드는 화면 변환 뒤 원문 수식이 없다", () => {
  it("auto_passed 전 문항(모든 *-items.json)", () => {
    const rep = buildAuditReport();
    expect(rep.scannedItems).toBeGreaterThan(400);
    const bad = rep.rows.flatMap((r) => r.fields.filter((f) => f.display.length).map((f) => `${r.stockKey} ${f.path}: ${f.display[0].kind} "${f.display[0].token}"`));
    expect(bad).toEqual([]);
  });
  it("auditPayload: 저장 단계 흔적은 필드 경로와 함께 나온다", () => {
    const rows = auditPayload({ explanation_en: EXPL_BAD, stem: "ok $x$" });
    expect(rows.map((r) => r.path)).toEqual(["explanation_en"]);
  });
  it("두 보고 사례가 실제 재고에 존재한다(회귀 기준)", () => {
    const it0 = (JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as { stockKey: string; payload: { explanation_en?: string } }[]).find((x) => x.payload.explanation_en?.startsWith("The correct answer is \\frac{1}{10}."));
    expect(it0).toBeTruthy();
  });
});
