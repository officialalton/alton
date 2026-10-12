import { describe, expect, it } from "vitest";
import { verifyAssignment, type SetResult, type Spec } from "../../scripts/ap-generation/exact-assign";
import type { Item } from "../../scripts/ap-generation/assign-pool";

// AB·BC 공통 범위 규칙(마이그레이션 500 의 DB 가드와 같은 규칙)을 앱 검증기가 같은 이유로 거부하는지 확인한다.
const it0 = (key: string, o: Partial<Item>): Item => ({ key, kind: "mc", subj: "ab", unit: 1, skill: 1, calc: "not_allowed", fam: key, type: "1.1", graph: false, native: false, bcOnly: false, rep: "", archetype: "", screen: true, isNew: false, pending: "", batch: "", renderType: "", ...o });
const empty = (id: string): SetResult => ({ id, mcA: [], mcB: [], frqA: [], frqB: [], virtual: [], frqVirtual: [] });
const run = (subj: "ab" | "bc", item: Item) => {
  const spec: Spec = { id: subj === "bc" ? "BC9" : "AB9", subj, floor: 0 };
  return verifyAssignment([spec], [{ ...empty(spec.id), mcA: [item] }], new Set()).join("|");
};

describe("공통 범위 규칙(verifyAssignment)", () => {
  it("공통 범위 AB 문항은 BC 세트에서 공통 범위 위반이 아니다", () => {
    expect(run("bc", it0("a", { subj: "ab", bcOnly: false }))).not.toMatch(/공통 범위가 아닌|AB 세트에 BC/);
  });
  it("BC 전용 주제 문항은 AB 과목 문항이어도 BC 세트에 넣지 못한다", () => {
    expect(run("bc", it0("b", { subj: "ab", bcOnly: true }))).toMatch(/BC 세트에 공통 범위가 아닌 AB 문항/);
  });
  it("BC 문항은 AB 세트에 넣지 못한다(BC 전용 주제 포함)", () => {
    expect(run("ab", it0("c", { subj: "bc", native: true }))).toMatch(/AB 세트에 BC 문항/);
    expect(run("ab", it0("d", { subj: "ab", bcOnly: true }))).toMatch(/AB 세트에 BC 전용 주제 문항/);
  });
});
