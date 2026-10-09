import { describe, it, expect } from "vitest";
import { loadSeeds, scheduleSeeds, targetLetterFor, enforceTarget, SimIndex, gate, minhash, jaccardEst } from "./diversity";

describe("diversity", () => {
  it("씨앗: 120개, 같은 skill 안 중복 없음, 전체 최대 2회", () => {
    const seeds = loadSeeds();
    expect(seeds.length).toBe(120);
    const cands = Array.from({ length: 200 }, (_, i) => ({ skill: `s${i % 5}` }));
    const out = scheduleSeeds(cands, seeds);
    const tot = new Map<string, number>();
    out.forEach((s) => tot.set(s.topic, (tot.get(s.topic) ?? 0) + 1));
    expect(Math.max(...tot.values())).toBeLessThanOrEqual(2);
    for (let k = 0; k < 5; k++) {
      const t = out.filter((_, i) => i % 5 === k).map((s) => s.topic);
      expect(new Set(t).size).toBe(t.length);
    }
  });
  it("목표 위치: 100개에서 A~D 각 25±10%", () => {
    const c = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
    for (let i = 0; i < 100; i++) c[targetLetterFor("words_in_context", i)]++;
    for (const v of Object.values(c)) expect(v).toBeGreaterThanOrEqual(15);
  });
  it("enforceTarget: 정답 이동과 해설 글자 치환", () => {
    const g = { options: ["alpha", "beta", "gamma", "delta"], correct_letter: "A", explanation: "Choice A is right; B is wrong." };
    const r = enforceTarget(g, "C");
    expect(r.changed).toBe(true);
    expect(r.g.options[2]).toBe("alpha");
    expect(r.g.correct_letter).toBe("C");
    expect(r.g.explanation).toContain("Choice C is right");
    expect(r.g.explanation).toContain("A is wrong");
  });
  it("enforceTarget: 숫자 선택지는 그대로", () => {
    const g = { options: ["1", "2", "3", "4"], correct_letter: "A", explanation: "x" };
    expect(enforceTarget(g, "C").changed).toBe(false);
  });
  it("유사도 게이트: 거의 같은 글 차단, 다른 글 통과, 문두 집중 차단", () => {
    const idx = new SimIndex();
    const base = "The marine biologist surveyed the reef each morning and recorded how the coral colonies changed over the long warm season of observation";
    idx.add("a", "s", base);
    expect(gate(idx, "s", base + " today")).toMatch(/유사도/);
    expect(gate(idx, "s", "Economists studying urban rents found that remote work shifted demand toward smaller cities during the period")).toBeNull();
    expect(gate(idx, "t", base)).toBeNull();
    const j = jaccardEst(minhash(base), minhash(base));
    expect(j).toBe(1);
    const i2 = new SimIndex();
    for (let k = 0; k < 3; k++) i2.add(`x${k}`, "s", `In recent years scholars ${k} ${"zebra yak xylophone walrus".repeat(k + 1)} wander apart entirely`);
    expect(gate(i2, "s", "In recent years a wholly different matter about glaciers and rivers unfolds across distant valleys")).toMatch(/문두/);
  });
});
