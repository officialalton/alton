import { describe, expect, it } from "vitest";
import { distractorGate, longestCorrectShare, restatementGate } from "./distractor-gate";

const ok = ["She hides her disappointment behind polite questions", "She resents her brother for leaving the farm", "She worries that the harvest will not be enough", "She feels relieved that the visit is nearly over"];

describe("오답 품질 게이트", () => {
  it("균형 잡힌 선택지는 통과", () => expect(distractorGate({ options: ok, correct_letter: "B" }).ok).toBe(true));
  it("정답이 가장 긴 선택지면 탈락", () => {
    const o = ["Anna feels sad", "Anna feels glad", "Anna feels mad", "Anna feels quietly resentful about the decision she was never consulted on"];
    const r = distractorGate({ options: o, correct_letter: "D" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/가장 긴/);
  });
  it("정답이 최장이어도 차이가 1단어면 우연으로 통과", () => {
    const o = ["She feels calm about it", "She feels proud of them", "She feels tired of all this", "She feels deeply worried now"];
    expect(distractorGate({ options: o, correct_letter: "C" }).reasons.join(" ")).not.toMatch(/가장 긴/);
  });
  it("길이 불균형(최장/최단 > 1.8) 탈락", () => {
    const o = ["He is angry", "He is angry about the broken promise from last spring", "He is afraid", "He is amused"];
    expect(distractorGate({ options: o, correct_letter: "A" }).reasons.join(" ")).toMatch(/불균형/);
  });
  it("복수 정답 위험: 정답과 어휘가 거의 같은 오답", () => {
    const o = ["She is proud of her brother's courage", "She is proud of her brother's bravery", "She is ashamed of her brother", "She is afraid of her brother"];
    expect(distractorGate({ options: o, correct_letter: "A" }).reasons.join(" ")).toMatch(/복수 정답 위험/);
  });
  it("오답이 절대어로 쉽게 소거되는 패턴과 '모두/없음' 선택지는 탈락", () => {
    const abs = ["She mostly hides her worry", "She never cares about anyone", "She always blames the others", "She only wants to leave"];
    expect(distractorGate({ options: abs, correct_letter: "A" }).reasons.join(" ")).toMatch(/절대어/);
    expect(distractorGate({ options: [...ok.slice(0, 3), "All of the above statements"], correct_letter: "A" }).ok).toBe(false);
  });
  it("정답만 쉼표 구조가 있는 구체성 불균형", () => {
    const o = ["She hides the letter, keeps quiet, and leaves", "She is angry", "She is tired", "She is glad"];
    expect(distractorGate({ options: o, correct_letter: "A" }).reasons.join(" ")).toMatch(/구체적|불균형/);
  });
  it("형식 오류와 동일한 선택지", () => {
    expect(distractorGate({ options: ok.slice(0, 3), correct_letter: "A" }).ok).toBe(false);
    expect(distractorGate({ options: ["Same words here now", "same words here now", "Other words used here", "Another set of words"], correct_letter: "C" }).ok).toBe(false);
  });
  it("배치 단위 최장 정답 비율", () => {
    expect(longestCorrectShare([{ options: ["a b", "a b c d e", "a", "b"], correct_letter: "B" }, { options: ["a b c", "a b", "a", "b"], correct_letter: "B" }])).toBe(0.5);
  });
});

describe("마지막 문장 재진술 게이트", () => {
  const passage = "Mara folded the apron twice. She set the keys beside the register and did not look at Ines. Outside, the delivery truck idled. At last Mara whispered that she was leaving because nobody had ever asked her to stay.";
  it("정답이 마지막 문장을 거의 그대로 옮기면 탈락", () => {
    const r = restatementGate(passage, ["Mara is leaving because nobody had ever asked her to stay", "Mara wants a quieter job", "Ines has taken her shifts", "The truck driver insulted her"], "A");
    expect(r.ok).toBe(false);
  });
  it("정답이 지문 여러 곳에서 근거를 모아 추론하는 문장이면 통과", () => {
    const r = restatementGate(passage, ["Mara tests whether anyone will object to her departure", "Mara resents the delivery driver", "Mara plans to steal the keys", "Mara is bored with folding"], "A");
    expect(r.ok).toBe(true);
  });
  it("모든 선택지가 비슷하게 마지막 문장과 겹치면(정답만 두드러지지 않으면) 통과", () => {
    const r = restatementGate(passage, ["Mara is leaving since nobody asked her", "Mara is staying since nobody asked her", "Ines is leaving since nobody asked her", "Mara is arguing since nobody asked her"], "A");
    expect(r.ok).toBe(true);
  });
});
