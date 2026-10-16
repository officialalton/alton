import { describe, expect, it } from "vitest";
import { ENGLIT_FULL_TARGET, englitCategoryBounds, englitCategoryOf, englitGroupBounds, englitGroupOfTopic, verifyEnglitFullComposition, type EnglitGroup, type EnglitSetItem } from "./englit-rules";

function build(sets: { key: string; group: EnglitGroup; skills: string[] }[]): EnglitSetItem[] {
  const out: EnglitSetItem[] = []; let pos = 1;
  for (const s of sets) for (const k of s.skills) out.push({ kind: "mc", skill: k, group: s.group, candidateKey: s.key, position: pos++ });
  ["a", "b", "c"].forEach((k, i) => out.push({ kind: "frq", skill: null, group: null, candidateKey: `f${k}`, position: i + 1 }));
  return out;
}
const rep = (arr: string[], n: number) => Array.from({ length: n }, (_, i) => arr[i % arr.length]);
describe("englit-rules", () => {
  it("bounds follow floor/ceil of the official percentages over 55 questions", () => {
    expect(englitGroupBounds()).toEqual({ short: { min: 23, max: 27 }, poetry: { min: 19, max: 25 }, longer: { min: 8, max: 10 } });
    expect(englitCategoryBounds()["4"]).toEqual({ min: 11, max: 15 });
    expect(englitCategoryBounds()["2"]).toEqual({ min: 1, max: 4 });
    expect(Object.values(ENGLIT_FULL_TARGET.categories).reduce((a, b) => a + b, 0)).toBe(55);
  });
  it("maps skills and topics", () => { expect(englitCategoryOf("6.C")).toBe("6"); expect(englitCategoryOf("8.A")).toBeNull(); expect(englitGroupOfTopic("U5.2")).toBe("poetry"); expect(englitGroupOfTopic("U7.1")).toBe("short"); expect(englitGroupOfTopic("U9.3")).toBe("longer"); });
  const good = () => build([
    { key: "s1", group: "short", skills: ["1.A", "1.B", "1.D", "2.A", "3.A", "3.B", "4.A", "4.C", "5.B", "6.A", "7.B", "7.C"] },
    { key: "p1", group: "poetry", skills: ["1.A", "3.C", "3.D", "4.A", "4.C", "4.C", "5.B", "5.D", "6.B", "6.D", "7.B"] },
    { key: "l1", group: "longer", skills: ["1.E", "3.E", "3.F", "4.C", "4.D", "5.C", "7.C", "7.D", "3.B"] },
    { key: "p2", group: "poetry", skills: ["1.E", "2.A", "3.C", "3.D", "4.A", "4.C", "5.B", "5.D", "6.B", "6.C", "7.A"] },
    { key: "s2", group: "short", skills: ["1.B", "1.C", "1.D", "2.B", "3.A", "3.B", "4.B", "4.C", "4.D", "5.D", "6.C", "7.D"] },
  ]);
  it("accepts a valid 55-question layout", () => { const v = verifyEnglitFullComposition(good()); expect(v).toEqual([]); });
  it("rejects wrong set counts, sizes and genre mixes", () => {
    const g = good();
    expect(verifyEnglitFullComposition(g.filter((i) => i.candidateKey !== "l1")).join()).toContain("set_count_4");
    const mixed = g.map((i) => (i.candidateKey === "s1" && i.position === 1 ? { ...i, group: "poetry" as const } : i));
    expect(verifyEnglitFullComposition(mixed).join()).toContain("set_mixes_genres_s1");
    expect(verifyEnglitFullComposition(rep(["1.A"], 0).length ? g : g).length).toBe(0);
    const seven = g.map((i) => (i.skill === "7.E" ? i : i.position === 3 ? { ...i, skill: "7.E" } : i));
    expect(verifyEnglitFullComposition(seven).join()).toContain("mc_skill_7E_not_assessed_in_mc");
  });
});
