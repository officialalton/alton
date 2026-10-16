import { describe, it, expect } from "vitest";
import { candidatesFromText, isSelfContained, paragraphs, sentences } from "./excerpt";

// 테스트용 가짜 글(실제 작품 아님).
const S = (n: number) => `The keeper of the lighthouse studied the changing color of the water every morning, number ${n}, and wrote what he saw in a small notebook kept beside the lamp.`;
const PARA = [S(1), S(2), S(3)].join(" ");
describe("발췌 후보 추출", () => {
  it("문단·문장 경계로 자른다", () => {
    const ps = paragraphs(`${PARA}\n\n${PARA}`);
    expect(ps).toHaveLength(2);
    expect(sentences(ps[0])).toHaveLength(3);
  });
  it("자족성 규칙: 대명사 시작·따옴표 불균형·각주·고어 제외", () => {
    expect(isSelfContained("He walked slowly along the quay. The air was cold and clear and the sea was still.")).toBe(false);
    expect(isSelfContained('The captain said "we sail at dawn. The crew nodded and the ropes were checked.')).toBe(false);
    expect(isSelfContained("The report was short.[1] It listed three causes and one remedy in plain language.")).toBe(false);
    expect(isSelfContained("Thou hast seen the harbor. The tide comes in at noon and leaves by night.")).toBe(false);
    expect(isSelfContained("The keeper studied the water. The notebook grew heavy with entries about color and light.")).toBe(true);
  });
  it("길이 조건을 만족하는 발췌만 만들고 전부 원문과 글자 일치", () => {
    const src = `${PARA}\n\n${PARA}`;
    const c = candidatesFromText(src, "test:1", { minWords: 40, maxWords: 150, minSentences: 2, maxSentences: 8 });
    expect(c.length).toBeGreaterThan(0);
    for (const e of c) { expect(e.wordCount).toBeGreaterThanOrEqual(40); expect(e.verifiedBy).toBe("code:quote-match-v1"); expect(src.slice(e.startChar, e.endChar).length).toBeGreaterThan(0); }
  });
});
