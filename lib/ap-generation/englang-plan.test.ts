import { describe, expect, it } from "vitest";
import { apportion, planSets } from "./englang-plan";
import { elangCategoryOf } from "../ap-exam/elang-rules";

describe("englang planner", () => {
  it("apportions slots by weight with no loss", () => { const a = apportion({ x: 5, y: 7, z: 7, w: 5 }, 24); expect(Object.values(a).reduce((p, q) => p + q, 0)).toBe(24); expect(a).toEqual({ x: 5, y: 7, z: 7, w: 5 }); });
  it("reading sets use reading skills only and category counts follow the target", () => {
    const s = planSets({ kind: "reading", sets: 4, seed: 11 }); const all = s.flatMap((x) => x.skills);
    expect(all.length).toBe(24); expect(all.every((k) => elangCategoryOf(k)!.endsWith("-R"))).toBe(true);
    const c: Record<string, number> = {}; for (const k of all) c[elangCategoryOf(k)!] = (c[elangCategoryOf(k)!] ?? 0) + 1; expect(c).toEqual({ "RS-R": 5, "CE-R": 7, "RO-R": 7, "S-R": 5 });
    expect(new Set(s.map((x) => x.theme)).size).toBe(4); expect(s.every((x) => new Set(x.skills.map((k) => k.split(".")[0])).size >= 3)).toBe(true);
  });
  it("writing sets are deterministic for a seed and use writing skills only", () => {
    const a = planSets({ kind: "writing", sets: 3, seed: 5 }), b = planSets({ kind: "writing", sets: 3, seed: 5 });
    expect(a).toEqual(b); expect(a.flatMap((x) => x.skills).every((k) => elangCategoryOf(k)!.endsWith("-W"))).toBe(true); expect(a[0].id).toBe("w01");
  });
  it("used themes are not reused", () => { const first = planSets({ kind: "reading", sets: 2, seed: 3 }); const next = planSets({ kind: "reading", sets: 2, seed: 4, usedThemes: new Set(first.map((x) => x.theme)) }); expect(next.every((x) => !first.some((f) => f.theme === x.theme))).toBe(true); });
});
