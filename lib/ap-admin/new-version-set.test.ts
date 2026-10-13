import { describe, expect, it } from "vitest";
import { resolveSwaps } from "./new-version";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";

// 통계 풀 세트의 새 버전: 3문항 공유 자료 세트는 세트 단위로만 교체된다(후보 키가 같은 슬롯 3개).
const slots = [
  ...Array.from({ length: 4 }, (_, i) => ({ section: "ap_mc", position: i + 1, candidateKey: `single${i + 1}` })),
  ...[5, 6, 7].map((p) => ({ section: "ap_mc", position: p, candidateKey: "setA" })),
  { section: "ap_mc", position: 8, candidateKey: "single8" },
  { section: "ap_frq", position: 1, candidateKey: "frq1" },
];

describe("resolveSwaps with shared sets", () => {
  it("a swap naming one member (or the set key) expands to all three slots in order with addIndex 0..2", () => {
    for (const input of [{ section: "ap_mc", removeKey: "setA", addKey: "setB" }, { section: "ap_mc", position: 6, removeKey: "setA", addKey: "setB" }, { section: "ap_mc", position: 7, addKey: "setB" }]) {
      const r = resolveSwaps([input], slots);
      expect(r.problems).toEqual([]);
      expect(r.swaps.map((s) => [s.position, s.addKey, s.addIndex, s.removeKey])).toEqual([[5, "setB", 0, "setA"], [6, "setB", 1, "setA"], [7, "setB", 2, "setA"]]);
    }
  });
  it("listing every member with the same replacement is the same single set swap (no double counting)", () => {
    const r = resolveSwaps([5, 6, 7].map((position) => ({ section: "ap_mc", position, addKey: "setB" })), slots);
    expect(r.problems).toEqual([]); expect(r.swaps).toHaveLength(3);
  });
  it("splitting one set across two different replacement candidates is rejected", () => {
    const r = resolveSwaps([{ section: "ap_mc", position: 5, addKey: "setB" }, { section: "ap_mc", position: 6, addKey: "setC" }], slots);
    expect(r.problems.join()).toMatch(/나눠 교체할 수 없습니다/);
  });
  it("single swaps keep working and carry no addIndex", () => {
    const r = resolveSwaps([{ section: "ap_mc", removeKey: "single2", addKey: "n1" }], slots);
    expect(r.swaps).toEqual([{ section: "ap_mc", position: 2, addKey: "n1", removeKey: "single2" }]);
  });
});

describe("composition check keeps shared sets together", () => {
  const source: SlotItem[] = slots.map((s, i) => ({ ...s, problemId: `p${i}`, kind: s.section === "ap_mc" ? "mc" : "frq", unit: s.candidateKey === "setA" ? "2" : "1", family: s.candidateKey, calculator: "allowed" }));
  const rep = (key: string, id: string, unit = "2") => [id, { problemId: id, candidateKey: key, kind: "mc" as const, unit, family: key, calculator: "allowed" }] as const;
  const ctx = (reps: (readonly [string, SlotItem extends never ? never : Omit<SlotItem, "section" | "position">])[], extra: object = {}) => ({ apLabel: "full_practice" as const, sectionCalculator: { ap_mc: "allowed", ap_frq: "allowed" }, usedByOtherExams: new Set<string>(), replacements: new Map(reps as never), ...extra });
  it("replacing the whole set with another 3-problem set passes", () => {
    const swaps = [5, 6, 7].map((position, j) => ({ section: "ap_mc", position, problemId: `n${j}` }));
    const c = ctx([rep("setB", "n0"), rep("setB", "n1"), rep("setB", "n2")], { setSizes: new Map([["setB", 3]]) });
    expect(checkNewVersionComposition(source, swaps, c as never).issues).toEqual([]);
  });
  it("replacing only two members of a set, or putting a 3-problem set in a single slot, is rejected", () => {
    const two = [5, 6].map((position, j) => ({ section: "ap_mc", position, problemId: `n${j}` }));
    const r = checkNewVersionComposition(source, two, ctx([rep("setB", "n0"), rep("setB", "n1")], { setSizes: new Map([["setB", 3]]) }) as never);
    expect(r.issues.join()).toMatch(/set_partial_swap_setA_2\/3/); expect(r.issues.join()).toMatch(/set_replacement_incomplete_setB_2\/3/);
    const one = checkNewVersionComposition(source, [{ section: "ap_mc", position: 1, problemId: "n0" }], ctx([rep("setB", "n0", "1")], { setSizes: new Map([["setB", 3]]) }) as never);
    expect(one.issues.join()).toMatch(/set_replacement_incomplete_setB_1\/3/);
  });
});
