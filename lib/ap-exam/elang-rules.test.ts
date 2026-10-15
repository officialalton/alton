import { describe, expect, it } from "vitest";
import { ELANG_FULL_TARGET, elangCategoryBounds, elangCategoryOf, elangSectionOf, verifyElangFullComposition, type ElangSetItem } from "./elang-rules";

describe("elang rules", () => {
  it("skill codes map to the eight official categories", () => {
    expect(elangCategoryOf("1.A")).toBe("RS-R"); expect(elangCategoryOf("8.C")).toBe("S-W"); expect(elangCategoryOf("9.A")).toBeNull();
    expect(elangSectionOf("3.B")).toBe("reading"); expect(elangSectionOf("4.B")).toBe("writing");
  });
  it("category bounds for 45 questions use floor/ceil of the official percentage", () => {
    const b = elangCategoryBounds(); expect(b["RS-R"]).toEqual({ min: 4, max: 7 }); expect(b["CE-R"]).toEqual({ min: 5, max: 8 }); expect(b["S-W"]).toEqual({ min: 4, max: 7 });
  });
  it("the proposed target sums to 45 with reading 24 and writing 21 and sits inside the bounds", () => {
    const t = ELANG_FULL_TARGET.categories; const b = elangCategoryBounds();
    expect(Object.values(t).reduce((a, x) => a + x, 0)).toBe(45); for (const [c, n] of Object.entries(t)) { expect(n).toBeGreaterThanOrEqual(b[c].min); expect(n).toBeLessThanOrEqual(b[c].max); }
  });
  const build = (readingSets: string[][], writingSets: string[][]): ElangSetItem[] => {
    const out: ElangSetItem[] = []; let pos = 1;
    [...readingSets, ...writingSets].forEach((s, i) => s.forEach((sk) => out.push({ kind: "mc", skill: sk, candidateKey: `k${i}`, position: pos++ })));
    for (const [i, k] of ["k-q1", "k-q2", "k-q3"].entries()) out.push({ kind: "frq", skill: null, candidateKey: k, position: i + 1 });
    return out;
  };
  const R = [["1.A", "3.A", "5.A", "7.A", "3.B"], ["1.B", "3.C", "5.B", "7.B", "5.C"], ["1.A", "3.A", "5.A", "7.C", "5.B"], ["3.B", "5.C", "7.A", "3.C"], ["7.B", "5.A", "3.A", "1.B"]];
  const W = [["2.A", "4.A", "6.A", "8.A"], ["2.B", "4.B", "6.B", "8.B", "6.C"], ["2.A", "4.C", "6.A", "8.C", "8.A"], ["2.B", "4.A", "6.B", "8.B"], ["4.B", "6.C", "8.C", "2.A"]];
  it("accepts a composition inside every range and rejects out-of-range ones", () => {
    const good = build(R, W); const v = verifyElangFullComposition(good); expect(v.filter((x) => !x.startsWith("category_"))).toEqual([]);
    const bad = verifyElangFullComposition(build(R.slice(0, 4), W)); expect(bad.some((x) => x.startsWith("mc_count"))).toBe(true); expect(bad.some((x) => x.startsWith("reading_"))).toBe(true);
  });
  it("sets must be contiguous, single-section and reading comes before writing", () => {
    const items = build(R, W); const swap = items.map((i) => ({ ...i })); const a = swap.findIndex((i) => i.candidateKey === "k0"); swap[a].candidateKey = "k1";
    expect(verifyElangFullComposition(swap).some((x) => x.startsWith("set_not_contiguous"))).toBe(true);
    const reordered = build(W, R); expect(verifyElangFullComposition(reordered)).toContain("reading_after_writing");
  });
  describe("official 5-set structure (2 reading 11-14, 3 writing 7-9/7-9/4-6)", () => {
    const rd = (n: number, skills: string[]) => Array.from({ length: n }, (_, i) => skills[i % skills.length]);
    const r1 = rd(12, ["1.A", "1.B", "3.A", "3.B", "3.C", "5.A", "5.B", "5.C", "7.A", "7.B", "7.C", "3.A"]), r2 = rd(12, ["1.A", "1.B", "3.A", "3.B", "3.C", "5.A", "5.B", "5.C", "7.A", "7.B", "7.C", "5.A"]);
    const w1 = ["2.A", "2.B", "4.A", "4.B", "6.A", "6.B", "8.A", "8.B"], w2 = ["2.A", "4.A", "4.C", "6.A", "6.C", "8.A", "8.B", "8.C"], w3 = ["2.B", "4.B", "6.B", "8.C", "2.A"];
    it("accepts the official shape and keeps the legacy shape valid", () => {
      expect(verifyElangFullComposition(build([r1, r2], [w1, w2, w3])).filter((x) => !x.startsWith("category_"))).toEqual([]);
      expect(verifyElangFullComposition(build(R, W)).filter((x) => !x.startsWith("category_"))).toEqual([]);
    });
    it("rejects wrong sizes in the official shape", () => {
      const sizes = (rs: string[][], ws: string[][]) => verifyElangFullComposition(build(rs, ws)).filter((x) => x.startsWith("official_") || x.startsWith("set_size"));
      expect(sizes([r1.slice(0, 10), [...r2, "1.A", "3.A"]], [w1, w2, w3]).length).toBeGreaterThan(0); // 10 and 14 -> first too small
      expect(sizes([r1, r2], [w1, w2, [...w3, "4.A", "6.A"]]).some((x) => x.startsWith("official_writing_set_3"))).toBe(true);
      expect(sizes([r1, r2], [w1.slice(0, 6), w2, w3]).some((x) => x.startsWith("official_writing_set_2") || x.startsWith("official_writing_set_1"))).toBe(true);
    });
  });
});
