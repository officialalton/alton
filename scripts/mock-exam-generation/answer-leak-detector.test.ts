import { describe, expect, it } from "vitest";
import { analyzeLeak, answerLeakGate, buildIdf, mirrorRun, subjectMatches, discriminatingOverlap, frameSim, policyFor } from "./answer-leak-detector";
import { coeQuantStyle } from "./answer-leak-audit";

const leaky = {
  skill: "command_of_evidence_quant",
  question: "Which choice most effectively uses data from the table to support the claim that Painter C has the fewest surviving attributed paintings among the four painters studied?",
  options: [
    "Painter A has 65 surviving attributed paintings, the most of the four painters studied",
    "Painter B has 48 surviving attributed paintings, more than both Painter D and Painter C",
    "Painter D has 34 surviving attributed paintings, fewer than both Painter A and Painter B",
    "Painter C has only 12 surviving attributed paintings, fewer than any of the other three painters",
  ],
  correctIndex: 3,
};
const parallel = {
  ...leaky,
  options: [
    "Painter A has 65 surviving attributed paintings, more than any of the other three painters",
    "Painter B has 48 surviving attributed paintings, fewer than Painter A but more than Painter D",
    "Painter D has 34 surviving attributed paintings, fewer than any of the other three painters",
    "Painter C has 12 surviving attributed paintings, fewer than any of the other three painters",
  ],
};
const idf = buildIdf([leaky.question, ...leaky.options]);

describe("answer-leak-detector", () => {
  it("질문이 지목한 대상을 주어로 삼은 선택지가 정답뿐이면 강한 신호", () => {
    const a = analyzeLeak(leaky, idf);
    expect(a.strong).toBe(true);
    expect(a.reasons.join(" ")).toContain("주어");
  });
  it("오답도 같은 틀로 쓰이고 질문 대상 주어가 여럿이면(정답이 아닌 선택지가 대상을 주어로 삼음) 신호가 약해진다", () => {
    const a = analyzeLeak({ ...parallel, options: [parallel.options[0], parallel.options[1], "Painter C has 12 surviving attributed paintings, which is the lowest of the four", parallel.options[3]], correctIndex: 3 }, idf);
    expect(a.strong).toBe(false);
  });
  it("서사 유형은 주체 일치 검사를 기본으로 끈다(질문 어휘 반복은 자연스럽다)", () => {
    expect(policyFor("central_ideas_details").entity).toBe(false);
    expect(policyFor("command_of_evidence_quant").entity).toBe(true);
  });
  it("어휘·구두점 유형은 어휘 검사를 하지 않는다", () => {
    const a = analyzeLeak({ skill: "words_in_context", question: "As used in the text, what does the word blight most nearly mean?", options: ["blight blight", "a", "b", "c"], correctIndex: 0 }, new Map());
    expect(a.flagged).toBe(false);
  });
  it("정답이 가장 긴 선택지면 길이 신호(약한 신호)", () => {
    const a = analyzeLeak({ skill: "inferences", question: "Which choice most logically completes the text?", correctIndex: 1, options: ["It shows a short idea.", "It shows a much longer idea that has many extra words attached to it today.", "It shows another idea here.", "It shows one more idea there."] }, new Map());
    expect(a.reasons.some((r) => r.includes("가장 긴"))).toBe(true);
    expect(a.strong).toBe(false);
  });
  it("mirrorRun: 질문 문구를 그대로 반복한 길이", () => {
    expect(mirrorRun("support the claim that export value grew the most between the 1850s and the 1860s", "Export value grew the most between the 1850s and the 1860s, by 23 million")).toBeGreaterThanOrEqual(5);
    expect(mirrorRun("which choice states the main idea", "Totally unrelated words appear here")).toBe(0);
  });
  it("subjectMatches / discriminatingOverlap 는 정답만 질문 대상을 반복하면 정답에서만 양수", () => {
    expect(subjectMatches(leaky.question, leaky.options)).toEqual([0, 0, 0, 1]);
    expect(discriminatingOverlap("Why does Stephen wait?", ["He waits for Stephen", "He is late", "She fears rain", "It is cold"])).toEqual([2, 0, 0, 0]);
  });
  it("frameSim: 같은 틀은 높고 다른 틀은 낮다", () => {
    expect(frameSim("Painter A has 65 paintings", "Painter B has 48 paintings")).toBeGreaterThan(frameSim("Painter A has 65 paintings", "Fewer than any other painter, 12")); 
  });
  it("answerLeakGate: 강한 신호만 탈락", () => {
    expect(answerLeakGate(leaky, idf).ok).toBe(false);
    expect(answerLeakGate({ ...leaky, options: leaky.options.slice(0, 3) }, idf).ok).toBe(true); // 형식 오류는 다른 게이트 몫
  });
  it("coeQuantStyle", () => {
    expect(coeQuantStyle(leaky.question)).toBe("claim-in-question");
    expect(coeQuantStyle('Which choice most effectively uses data from the table to complete the statement: "x"')).toBe("complete-the-text");
    expect(coeQuantStyle("Which choice most effectively uses data from the graph to support the student's claim?")).toBe("claim-in-passage");
  });
});
