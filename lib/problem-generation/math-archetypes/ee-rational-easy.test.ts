import { describe, expect, it } from "vitest";
import { EE_EM_ARCHETYPES } from "./skills/ee-em";
import { generateOne } from "./sweep";
import { verifyInstance } from "./verify";

const EASY = EE_EM_ARCHETYPES.filter((a) => a.kind === "rational_equivalence" && a.difficulty === "easy");

describe("equivalent_expressions.rational_equivalence easy — 구조가 다른 변형", () => {
  it("서로 다른 변형이 3개 이상이다", () => {
    expect(new Set(EASY.map((a) => a.id)).size).toBeGreaterThanOrEqual(3);
  });
  for (const a of EASY) {
    it(`${a.id}: 독립 재계산 검증 통과·보기 4개 유일`, () => {
      let ok = 0;
      for (let seed = 0; seed < 40; seed++) {
        const g = generateOne(a, seed);
        if (!g.ok) continue;
        ok++;
        expect(verifyInstance(a, g.inst).ok).toBe(true);
        expect(new Set(g.inst.options).size).toBe(4);
        expect(g.inst.explanationEn ?? "").not.toMatch(/[가-힣]/);
      }
      expect(ok).toBeGreaterThanOrEqual(30);
    });
  }
});
