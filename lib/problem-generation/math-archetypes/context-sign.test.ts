// 2026-10-13 외부 감사(S-M15/S-M16/S-M17) 회귀: 맥락과 기울기 부호는 독립이 아니다 — 촛불 높이·중고차 가치가 시간·나이와 함께 오르거나 매표 수입이 표가 팔릴수록 줄면 안 된다.
import { describe, expect, it } from "vitest";
import { makeRng } from "./rng";
import { makeLinTab, LIN_TOPICS } from "./skills/fig/table-kit";
import { topicSign } from "./figure-topics";
import { LMS } from "./kit-b";
import { generateTwoVarDataModel } from "../math-compilers/two-variable-data";

const byAxes = (xa: string, ya: string) => LIN_TOPICS.find((t) => t.xa === xa && t.ya === ya)!;

describe("table scenes take their slope sign from the scene", () => {
  it("candle height falls, car resale value falls, booth earnings rise (all other scenes keep their natural sign)", () => {
    expect(topicSign(byAxes("Days burning", "Candle height"))).toBe(-1);
    expect(topicSign(byAxes("Age", "Resale value"))).toBe(-1);
    expect(topicSign(byAxes("Tickets sold", "Earnings"))).toBe(1);
  });
  it("makeLinTab never produces a slope that contradicts the scene (4000 draws)", () => {
    for (let seed = 0; seed < 4000; seed++) {
      let tab;
      try { tab = makeLinTab(makeRng(seed)); } catch { continue; }
      expect(Math.sign(tab.m), `${tab.t.xa}|${tab.t.ya} seed ${seed}`).toBe(topicSign(tab.t));
    }
  });
  it("a caller-forced sign only draws scenes with that sign", () => {
    for (let seed = 0; seed < 300; seed++) {
      const neg = makeLinTab(makeRng(seed), { mSign: -1 });
      expect(neg.m).toBeLessThan(0); expect(topicSign(neg.t)).toBe(-1);
      const pos = makeLinTab(makeRng(seed), { mSign: 1 });
      expect(pos.m).toBeGreaterThan(0); expect(topicSign(pos.t)).toBe(1);
    }
  });
});

describe("verbal linear-model pool and scatter contexts", () => {
  it("a candle never grows", () => {
    const candle = LMS.find((c) => c.subj === "A candle")!;
    expect(candle.canDown).toBe(true); expect(candle.canUp).toBe(false);
  });
  it("scatter 'age of a car -> resale value' always has a negative slope", () => {
    let seen = 0;
    for (let i = 0; i < 600; i++) {
      const m = generateTwoVarDataModel({ difficulty: "medium", questionKind: "scatter_predict" }) as { xLabel?: string; slope?: number };
      if (m.xLabel?.startsWith("age of a car")) { seen++; expect(m.slope!).toBeLessThan(0); }
    }
    expect(seen).toBeGreaterThan(20);
  });
});
