import { describe, expect, it } from "vitest";
import { planSets, planSummary, LT_SET_QUOTA } from "./englit-plan";

describe("englit-plan", () => {
  it("is deterministic and follows the category quotas", () => {
    const a = planSets({ group: "poetry", sets: 3, seed: 42 }); const b = planSets({ group: "poetry", sets: 3, seed: 42 });
    expect(a).toEqual(b);
    for (const s of a) { expect(s.skills).toHaveLength(Object.values(LT_SET_QUOTA.poetry).reduce((x, y) => x + y, 0)); expect(s.form).toBe("poem"); expect(s.skills.every((k) => /^[1-7]\.[A-F]$/.test(k))).toBe(true); }
    expect(new Set(a.map((s) => s.premise)).size).toBe(3);
  });
  it("makes the first longer-fiction set a drama and never schedules 7.E", () => {
    const l = planSets({ group: "longer", sets: 3, seed: 7, dramaSets: 1 });
    expect(l.map((s) => s.form)).toEqual(["drama", "prose", "prose"]);
    for (const s of [...l, ...planSets({ group: "short", sets: 4, seed: 3 })]) expect(s.skills.includes("7.E")).toBe(false);
    expect(planSummary(l).items).toBe(39);
  });
});
