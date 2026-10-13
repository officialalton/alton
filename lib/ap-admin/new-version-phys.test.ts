// 물리 Practice Exam 2(PH4) 새 버전: FRQ 4칸을 두 번째 시나리오로 바꾸는 계획(저장소 파일만, DB 없음)과 독립 검증기 결과.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadPhysPool } from "../../scripts/ap-generation/phys-pool";
import { verifyPhysAssignment } from "../../scripts/ap-generation/phys-assign";
import { NEW_SCENARIO_ARCHETYPES, planPh2NewVersion, resultOf, type PhysReport } from "../../scripts/ap-generation/ph2-new-version-plan";
import { listSwapPlans, parseSwapPlan, readSwapPlan } from "./new-version";

const rep = JSON.parse(readFileSync("data/ap/stock/exact-assign-phys-ph3-ph4.json", "utf-8")) as { sets: PhysReport[] };
const PH3 = rep.sets.find((s) => s.id === "PH3")!; const PH4 = rep.sets.find((s) => s.id === "PH4")!;

describe("PH4 v1 → v2 FRQ 교체 계획(저장소 파일)", () => {
  const { pool } = loadPhysPool(); const by = new Map(pool.map((c) => [c.key, c]));
  const plan = planPh2NewVersion(PH3, PH4, pool);
  it("FRQ 4칸 전부를 유형 그대로 새 시나리오로 교체하고 독립 검증기 위반 0", () => {
    expect(plan.ok).toBe(true); expect(plan.verifierViolations).toEqual([]);
    expect(plan.swaps.map((s) => [s.position, s.remove.type, s.add.type])).toEqual([[1, "mr", "mr"], [2, "tbr", "tbr"], [3, "lab", "lab"], [4, "qqt", "qqt"]]);
    for (const s of plan.swaps) { expect(NEW_SCENARIO_ARCHETYPES).toContain(s.add.archetype); expect(NEW_SCENARIO_ARCHETYPES).not.toContain(s.remove.archetype); }
  });
  it("교체 후 PH4 FRQ 는 PH3 의 FRQ·시나리오(원형)와 하나도 겹치지 않고 MC 는 그대로다", () => {
    const ph3 = resultOf(PH3, by); const v2frq = plan.v2Frq.map((k) => by.get(k)!);
    expect(v2frq.filter((c) => PH3.frqA.includes(c.key))).toEqual([]);
    expect(new Set(v2frq.map((c) => c.archetype)).size).toBe(4);
    expect(v2frq.filter((c) => ph3.frq.some((p) => p.archetype === c.archetype))).toEqual([]);
    expect(new Set(v2frq.map((c) => c.frqType)).size).toBe(4);
    const full = { ...resultOf(PH4, by), frq: v2frq };
    expect(verifyPhysAssignment([ph3, full])).toEqual([]);
  });
  it("교체 FRQ 는 전부 화면 증거를 가진 재고다", () => { for (const s of plan.swaps) expect(by.get(s.addKey)?.screen).toBe(true); });
  it("커밋된 계획 파일이 생성 결과와 같고 형식·목록 규칙을 통과한다", () => {
    const f = readSwapPlan("ph2-v2-frq-swap-plan.json"); expect(f.set).toBe("PH4"); expect(f.sourceSetName).toBe("AP Physics 1 — Practice Exam 2"); expect(f.sourceVersionNo).toBe(1);
    expect(f.swaps.map((s) => [s.section, s.position, s.removeKey, s.addKey])).toEqual(plan.swaps.map((s) => [s.section, s.position, s.removeKey, s.addKey]));
    expect(listSwapPlans().some((p) => p.file === "ph2-v2-frq-swap-plan.json" && p.swapCount === 4)).toBe(true);
    expect((JSON.parse(readFileSync("data/ap/stock/ph2-v2-frq-swap-plan.json", "utf-8")) as { verifierViolations: string[] }).verifierViolations).toEqual([]);
    expect(parseSwapPlan(f)).toBeTruthy();
  });
  it("재고에 새 시나리오가 있으면 같은 유형 안에서만 고르고, PH3 가 쓰는 FRQ 는 고르지 않는다", () => {
    const blocked = planPh2NewVersion(PH3, PH4, pool, () => true);
    expect(blocked.ok).toBe(true); expect(blocked.swaps.every((s) => s.remove.type === s.add.type)).toBe(true);
  });
});
