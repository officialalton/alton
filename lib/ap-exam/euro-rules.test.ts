import { describe, expect, it } from "vitest";
import { EURO_FRQ_TEMPLATES, EURO_MC_COUNT, euroEra, euroUnitBounds, verifyEuroFullComposition } from "./euro-rules";
import { apSectionLayout } from "./layouts";

describe("AP European History composition rules", () => {
  it("matches the official layout values (MC 55/55 min, SAQ 3/40 min, DBQ+LEQ 100 min)", () => {
    const l = apSectionLayout("ap_european_history");
    expect(l.map((s) => [s.key, s.minutes, s.count])).toEqual([["ap_mc", 55, 55], ["ap_saq", 40, 3], ["ap_frq", 100, 2]]);
    expect(EURO_MC_COUNT).toBe(55);
    expect(EURO_FRQ_TEMPLATES).toEqual(["saq1", "saq2", "saq3", "dbq", "leq"]);
  });
  it("every unit is weighted 10-15 percent of 55 questions (5 to 9) and units map to four periods", () => {
    for (const b of Object.values(euroUnitBounds())) expect(b).toEqual({ min: 5, max: 9 });
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(euroEra)).toEqual([1, 1, 2, 2, 2, 3, 3, 4, 4]);
  });
  it("rejects an empty composition with the expected violations", () => {
    const v = verifyEuroFullComposition([]);
    expect(v).toContain("mc_count_0/55");
    expect(v).toContain("frq_count_0/5");
  });
});
