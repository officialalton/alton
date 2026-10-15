import { describe, expect, it } from "vitest";
import { USH_FULL_TARGET, ushUnitBounds, verifyUshFullComposition, type UshSetItem } from "./ush-rules";
import { fullPracticeUnitBounds } from "./full-set-rules";

describe("AP U.S. History composition rules", () => {
  it("unit bounds follow the CED weighting floor/ceil", () => { expect(ushUnitBounds()).toMatchObject({ "1": { min: 2, max: 4 }, "2": { min: 3, max: 5 }, "3": { min: 5, max: 10 }, "9": { min: 2, max: 4 } }); expect(fullPracticeUnitBounds("ap_us_history", "full_practice")).toEqual(ushUnitBounds()); });
  it("target sums to 55 and lies in bounds", () => { const t = USH_FULL_TARGET.units; expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(55); for (const [u, b] of Object.entries(ushUnitBounds())) { expect(t[u]).toBeGreaterThanOrEqual(b.min); expect(t[u]).toBeLessThanOrEqual(b.max); } });
  const build = (): UshSetItem[] => {
    const out: UshSetItem[] = []; let pos = 1; const plan: [string, number, string][] = [["1", 3, "primary_text"], ["2", 4, "primary_text"], ["3", 4, "primary_text"], ["3", 4, "primary_text"], ["4", 4, "primary_text"], ["4", 3, "secondary_text"], ["5", 4, "secondary_text"], ["5", 4, "paired_text"], ["6", 4, "quantitative"], ["6", 3, "primary_text"], ["7", 4, "primary_text"], ["7", 4, "primary_text"], ["8", 4, "primary_text"], ["8", 3, "primary_text"], ["9", 3, "primary_text"]];
    plan.forEach(([u, n, stim], si) => { for (let i = 0; i < n; i++) out.push({ kind: "mc", unit: u, skill: ["1.A", "2.B", "3.A", "4.A", "5.B"][(si + i) % 5], candidateKey: `s${si}`, position: pos++, stim }); });
    for (const [i, t] of ["saq1", "saq2", "saq3", "dbq", "leq"].entries()) out.push({ kind: "frq", unit: null, skill: null, candidateKey: `f${i}`, position: i + 1, template: t, period: [6, 4, 8][i] });
    return out;
  };
  it("accepts a valid composition and rejects broken ones", () => {
    expect(verifyUshFullComposition(build())).toEqual([]);
    const items = build(); items.pop(); expect(verifyUshFullComposition(items)).toContain("frq_count_4/5");
    const dup = build().map((i) => (i.template === "saq2" ? { ...i, period: 6 } : i)); expect(verifyUshFullComposition(dup)).toContain("saq_periods_not_distinct");
    const six = build().map((i) => (i.kind === "mc" && i.skill === "5.B" ? { ...i, skill: "6.A" } : i)); expect(verifyUshFullComposition(six).join()).toMatch(/not_assessed/);
  });
});
