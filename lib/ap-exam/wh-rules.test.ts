import { describe, expect, it } from "vitest";
import { WH_FULL_TARGET, whEra, whUnitBounds, verifyWhFullComposition, type WhSetItem } from "./wh-rules";
import { fullPracticeUnitBounds } from "./full-set-rules";
import { WH_SETS } from "../ap-generation/wh-plan";

describe("AP World History: Modern composition rules", () => {
  it("unit bounds follow the CED weighting floor/ceil", () => { expect(whUnitBounds()).toMatchObject({ "1": { min: 4, max: 6 }, "3": { min: 6, max: 9 }, "6": { min: 6, max: 9 }, "9": { min: 4, max: 6 } }); expect(fullPracticeUnitBounds("ap_world_history", "full_practice")).toEqual(whUnitBounds()); });
  it("target sums to 55 and lies in bounds", () => { const t = WH_FULL_TARGET.units; expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(55); for (const [u, b] of Object.entries(whUnitBounds())) { expect(t[u]).toBeGreaterThanOrEqual(b.min); expect(t[u]).toBeLessThanOrEqual(b.max); } });
  it("era mapping follows the four CED chronological periods", () => { expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(whEra)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4]); });
  const build = (): WhSetItem[] => {
    const out: WhSetItem[] = []; let pos = 1;
    WH_SETS.filter((x) => x.exam === "WH1").forEach((spec, si) => { for (const sk of spec.skills) out.push({ kind: "mc", unit: String(spec.unit), skill: sk, candidateKey: `s${si}`, position: pos++, stim: spec.stim }); });
    for (const [i, t] of ["saq1", "saq2", "saq3", "dbq", "leq"].entries()) out.push({ kind: "frq", unit: null, skill: null, candidateKey: `f${i}`, position: i + 1, template: t, era: [4, 1, 2][i] });
    return out;
  };
  it("accepts a valid composition and rejects broken ones", () => {
    const base = build();
    expect(verifyWhFullComposition(base)).toEqual([]);
    const items = build(); items.pop(); expect(verifyWhFullComposition(items)).toContain("frq_count_4/5");
    const dup = build().map((i) => (i.template === "saq2" ? { ...i, era: 4 } : i)); expect(verifyWhFullComposition(dup)).toContain("saq_eras_not_distinct");
    const six = build().map((i) => (i.kind === "mc" && i.skill === "5.B" ? { ...i, skill: "6.A" } : i)); expect(verifyWhFullComposition(six).join()).toMatch(/not_assessed/);
    const noImg = build().map((i) => (i.stim === "image" ? { ...i, stim: "primary_text" } : i)); expect(verifyWhFullComposition(noImg).join()).toMatch(/stim_image_0_lt_2/);
  });
});
