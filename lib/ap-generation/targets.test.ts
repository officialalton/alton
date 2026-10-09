import { describe, expect, it } from "vitest";
import { buildAbTargets, calculatorUseOf, cellStatus, representationOf, type ItemAttrs } from "./targets";
const units = [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ code: String(n), min: [10, 10, 5, 10, 15, 15, 5, 10][i], max: [15, 15, 10, 15, 20, 20, 10, 15][i] }));
const mk = (o: Partial<ItemAttrs> & { fam?: string }): ItemAttrs => ({ kind: "mc", keywordCode: "1.4", skillPrimary: "1.E", calculator: "not_allowed", payload: {}, itemFamilyId: o.fam ?? "f1", candidateKey: "k" + Math.random(), ...o });
describe("재고 목표(칸 단위)", () => {
  const t = buildAbTargets(units);
  it("MC 100 + FRQ 12, 계산기 불가 87 + 필수 13, FRQ 6유형×2", () => {
    const cells = t.filter((x) => x.dimension === "cell"); expect(cells.filter((x) => x.calculator_use === "not_allowed").reduce((a, x) => a + x.target, 0)).toBe(87); expect(cells.filter((x) => x.calculator_use === "required").reduce((a, x) => a + x.target, 0)).toBe(13);
    expect(t.filter((x) => x.dimension === "frq_type").reduce((a, x) => a + x.target, 0)).toBe(12); expect(t.filter((x) => x.dimension === "frq_type" && x.calculator_use === "not_allowed")).toHaveLength(4);
  });
  it("합계가 목표를 넘어도 칸(구조)에서 모자랄 수 있다", () => {
    const cell = t.find((x) => x.dimension === "cell" && x.unit_code === "1" && x.calculator_use === "required")!;
    const items = Array.from({ length: 200 }, (_, i) => mk({ keywordCode: "5.1", calculator: "required", fam: "f" + i })); // 단원 5 계산기 필수만 200개
    expect(cellStatus(cell, items).shortfall).toBe(cell.target);
  });
  it("문항군당 유효 2개 상한, family_floor 는 서로 다른 문항군 수", () => {
    const cell = t.find((x) => x.dimension === "cell" && x.unit_code === "1" && x.calculator_use === "not_allowed")!;
    const items = Array.from({ length: 10 }, () => mk({ fam: "same" })); expect(cellStatus(cell, items).effective).toBe(2);
    const floor = t.find((x) => x.dimension === "family_floor")!; expect(cellStatus(floor, [...items, mk({ fam: "g" })]).achieved).toBe(2);
  });
  it("계산기: required / not_allowed / allowed(na) 구분, 표현 분류", () => { expect(calculatorUseOf("na")).toBe("allowed"); expect(calculatorUseOf("required")).toBe("required"); expect(representationOf({ stimulus: { kind: "payoff_matrix" } })).toBe("table"); expect(representationOf({ stimulus: "text" })).toBe("text"); expect(representationOf({})).toBe("none"); });
});
