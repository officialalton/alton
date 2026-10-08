import { describe, expect, it } from "vitest";
import { planApSet, type AssembleCandidate } from "./assemble";

const c = (n: number, over: Partial<AssembleCandidate> = {}): AssembleCandidate => ({
  candidateKey: `k${String(n).padStart(3, "0")}`, problemId: `p${n}`, versionId: `v${n}`, kind: "mc", purpose: "mock_exam", releaseTier: "review_env",
  calculator: "na", keywordCode: `${1 + (n % 4)}.1`, itemFamilyId: `f${n}`, difficulty: "medium", itemIndex: 0, ...over,
});

describe("planApSet", () => {
  it("모의고사 용도·검수 환경 이상 문항만 쓰고 수업용·후보 단계는 버린다", () => {
    const pool = [...Array.from({ length: 6 }, (_, i) => c(i)), c(100, { purpose: "lesson" }), c(101, { releaseTier: "candidate" }), c(102, { purpose: null })];
    const plan = planApSet("ap_microeconomics", "mc_practice", pool);
    expect(plan.items.map((i) => i.c.problemId)).not.toContain("p100");
    expect(plan.items.map((i) => i.c.problemId)).not.toContain("p101");
    expect(plan.items.map((i) => i.c.problemId)).not.toContain("p102");
    expect(plan.ok).toBe(false); // 60문항이 필요 — 부족분을 보고한다
    expect(plan.shortfall[0]).toEqual({ sectionKey: "ap_mc", need: 60, have: 6 });
  });
  it("같은 문항군은 세트당 최대 2개, 단원을 돌아가며 뽑는다", () => {
    const pool = Array.from({ length: 70 }, (_, i) => c(i, { itemFamilyId: i < 5 ? "same" : `f${i}`, keywordCode: `${1 + (i % 6)}.2` }));
    const plan = planApSet("ap_microeconomics", "mc_practice", pool);
    expect(plan.ok).toBe(true);
    expect(plan.items.filter((i) => i.c.itemFamilyId === "same").length).toBeLessThanOrEqual(2);
    expect(plan.items).toHaveLength(60);
  });
  it("이미 다른 세트에 쓴 문항은 다시 쓰지 않는다", () => {
    const pool = Array.from({ length: 6 }, (_, i) => c(i));
    const plan = planApSet("ap_microeconomics", "mc_practice", pool, new Set(["p0", "p1"]));
    expect(plan.items.map((i) => i.c.problemId)).not.toContain("p0");
  });
  it("Calc Full: 계산기 구간(no calculator / graphing required)에 맞는 문항만 해당 섹션에 간다", () => {
    const pool = [...Array.from({ length: 29 }, (_, i) => c(i, { calculator: "not_allowed" })), ...Array.from({ length: 13 }, (_, i) => c(50 + i, { calculator: "required" }))];
    const plan = planApSet("ap_calculus_ab", "mc_practice", pool);
    expect(plan.ok).toBe(true);
    expect(plan.items.filter((i) => i.sectionKey === "ap_mc_a").every((i) => i.c.calculator === "not_allowed")).toBe(true);
    expect(plan.items.filter((i) => i.sectionKey === "ap_mc_b").every((i) => i.c.calculator === "required")).toBe(true);
  });
});
