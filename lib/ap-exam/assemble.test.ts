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

describe("planApSet 겹침·다양성·구성 옵션", () => {
  it("전체 길이 세트는 기본 겹침 0, 겹침 상한을 주면 그만큼만 재사용한다", () => {
    const pool = Array.from({ length: 62 }, (_, i) => c(i));
    const used = new Set(Array.from({ length: 5 }, (_, i) => `p${i}`));
    expect(planApSet("ap_microeconomics", "mc_practice", pool, used).reused).toBe(0);
    const p2 = planApSet("ap_microeconomics", "mc_practice", pool.slice(0, 62), used, { maxOverlap: 2 });
    expect(p2.reused).toBeLessThanOrEqual(2);
  });
  it("FRQ 는 문항군당 1개: 소수 원형의 수치 변형으로 6개를 채우지 못한다", () => {
    const frq = Array.from({ length: 12 }, (_, i) => c(i, { kind: "frq_bundle", calculator: i % 2 ? "required" : "not_allowed", itemFamilyId: `fam${i % 4}` }));
    const plan = planApSet("ap_calculus_ab", "frq_practice", frq);
    expect(plan.ok).toBe(false);
    expect(plan.shortfall.length).toBeGreaterThan(0); // 문항군 4개뿐이라 6개를 서로 다른 문항군으로 못 채움
  });
  it("공식 단원 비중 구성이 만족돼야 ok", () => {
    const pool = Array.from({ length: 20 }, (_, i) => c(i, { keywordCode: "1.1" }));
    const plan = planApSet("ap_microeconomics", "mc_practice", pool, new Set(), { unitBounds: { "1": { min: 1, max: 100 }, "2": { min: 5, max: 20 } }, minDistinctFamilies: { mc: 1 } });
    expect(plan.compositionIssues.some((x) => x.startsWith("unit_2_below_min"))).toBe(true);
    expect(plan.ok).toBe(false);
  });
});

import { planPartialSet } from "./assemble";
import { AP_PARTIALS, partialLabelAllowed, partialSetName, sectionsForPartial } from "./layouts";

describe("부분 연습 세트", () => {
  const mc = (n: number, o: Partial<AssembleCandidate> = {}) => c(n, { keywordCode: `${1 + (n % 8)}.1`, itemFamilyId: `f${Math.floor(n / 2)}`, ...o });
  it("이름·구성은 공식 파트를 따른다", () => {
    expect(partialSetName("ap_calculus_ab", "noncalc_mc")).toBe("AP Calculus AB — Non-Calculator Practice");
    expect(partialSetName("ap_calculus_ab", "calc_mc")).toBe("AP Calculus AB — Calculator Practice");
    expect(partialSetName("ap_calculus_ab", "frq", 2)).toBe("AP Calculus AB — Free-Response Practice 2");
    expect(sectionsForPartial("ap_calculus_ab", "noncalc_mc").map((s) => [s.key, s.count, s.minutes])).toEqual([["ap_mc_a", 29, 62]]);
    expect(sectionsForPartial("ap_calculus_ab", "calc_mc").map((s) => [s.key, s.count, s.minutes])).toEqual([["ap_mc_b", 13, 38]]);
    expect(sectionsForPartial("ap_calculus_ab", "frq").map((s) => [s.key, s.count, s.minutes])).toEqual([["ap_frq_a", 2, 30], ["ap_frq_b", 4, 60]]);
    expect(AP_PARTIALS.frq.label).toBe("frq_practice");
    expect(() => sectionsForPartial("ap_biology", "frq")).toThrow();
    expect(partialLabelAllowed("ap_calculus_ab", "noncalc_mc", { ap_mc_a: 28 })).toBe(false);
    expect(partialLabelAllowed("ap_calculus_ab", "noncalc_mc", { ap_mc_a: 29 })).toBe(true);
  });
  it("채울 수 있으면 공식 문항 수만큼, 한 세트 안 중복 없음, 계산기 구분 준수", () => {
    const pool = Array.from({ length: 60 }, (_, i) => mc(i, { calculator: "not_allowed" }));
    const plan = planPartialSet("ap_calculus_ab", "noncalc_mc", pool);
    expect(plan.ok).toBe(true); expect(plan.labelAllowed).toBe(true);
    expect(plan.items).toHaveLength(29);
    expect(new Set(plan.items.map((i) => i.c.problemId)).size).toBe(29);
    expect(planPartialSet("ap_calculus_ab", "calc_mc", pool).items).toHaveLength(0); // 계산기 필수 문항이 없다
  });
  it("모자라면 패딩 없이 부족을 보고하고 라벨을 허용하지 않는다", () => {
    const pool = Array.from({ length: 20 }, (_, i) => mc(i, { calculator: "not_allowed" }));
    const plan = planPartialSet("ap_calculus_ab", "noncalc_mc", pool);
    expect(plan.ok).toBe(false); expect(plan.labelAllowed).toBe(false);
    expect(plan.shortage[0]).toMatchObject({ sectionKey: "ap_mc_a", need: 29 });
    expect(plan.items.length).toBeLessThan(29);
  });
  it("수업용·후보 단계 문항은 쓰지 않는다", () => {
    const pool = Array.from({ length: 40 }, (_, i) => mc(i, { calculator: "not_allowed", purpose: i % 2 ? "lesson" : "mock_exam", releaseTier: i % 3 ? "review_env" : "candidate" }));
    expect(planPartialSet("ap_calculus_ab", "noncalc_mc", pool).items.every((i) => i.c.purpose === "mock_exam" && i.c.releaseTier !== "candidate")).toBe(true);
  });
  it("겹침: 기본 0이면 다른 세트 문항 제외, 한도를 주면 그만큼만 재사용", () => {
    const pool = Array.from({ length: 31 }, (_, i) => mc(i, { calculator: "not_allowed", itemFamilyId: `f${i}` }));
    const used = new Set(["p0", "p1", "p2", "p3", "p4"]);
    expect(planPartialSet("ap_calculus_ab", "noncalc_mc", pool, { used, overlapMax: 0 }).ok).toBe(false); // 새 문항 26개뿐
    expect(planPartialSet("ap_calculus_ab", "noncalc_mc", pool, { used, overlapMax: 2 }).ok).toBe(false); // 28개
    const three = planPartialSet("ap_calculus_ab", "noncalc_mc", pool, { used, overlapMax: 3 });
    expect(three.ok).toBe(true); expect(three.composition.ap_mc_a.overlapUsed).toBe(3);
    expect(new Set(three.items.map((i) => i.c.problemId)).size).toBe(29);
  });
  it("FRQ: 같은 문항군 6변형이면 다양성 하한 미달로 보고한다", () => {
    const f = (n: number, calc: string, fam: string, arch: string) => c(n, { kind: "frq_bundle", calculator: calc, itemFamilyId: fam, archetype: arch, keywordCode: "5.1" });
    const same = [...Array.from({ length: 3 }, (_, i) => f(i, "required", "famA", "area")), ...Array.from({ length: 5 }, (_, i) => f(10 + i, "not_allowed", "famA", "area"))];
    const bad = planPartialSet("ap_calculus_ab", "frq", same);
    expect(bad.ok).toBe(false); expect(bad.shortage.some((s) => s.reasons.some((r) => /문항 부족|다양성/.test(r)))).toBe(true);
    const good = [f(1, "required", "a", "x1"), f(2, "required", "b", "x2"), f(3, "not_allowed", "c", "x3"), f(4, "not_allowed", "d", "x4"), f(5, "not_allowed", "e", "x5"), f(6, "not_allowed", "g", "x6")];
    const ok = planPartialSet("ap_calculus_ab", "frq", good);
    expect(ok.ok).toBe(true); expect(ok.items).toHaveLength(6);
  });
});

import { AP_PARTIAL_CALCULATOR_NOTE, fullPracticeLabelAllowed, partialBadge, partialStartGuidance } from "./layouts";
describe("부분 세트 표시 정책", () => {
  it("제목·배지·시작 안내가 같은 의미(계산기 사용)를 전달하고 FRQ 도 계산기 표시", () => {
    expect(partialSetName("ap_calculus_ab", "noncalc_mc")).toBe("AP Calculus AB — Non-Calculator Practice"); expect(partialSetName("ap_calculus_ab", "calc_mc")).toBe("AP Calculus AB — Calculator Practice"); expect(partialSetName("ap_calculus_ab", "frq")).toBe("AP Calculus AB — Free-Response Practice");
    expect(partialBadge("noncalc_mc")).toMatch(/No calculator/); expect(partialBadge("calc_mc")).toMatch(/Graphing calculator required/); expect(AP_PARTIAL_CALCULATOR_NOTE.frq).toMatch(/Part A.*calculator.*Part B.*no calculator/);
    expect(partialStartGuidance("ap_calculus_ab", "frq")).toMatch(/not a full practice exam/); expect(partialStartGuidance("ap_calculus_ab", "noncalc_mc")).toMatch(/29 multiple-choice questions/);
  });
  it("Full Practice Exam 은 공식 구성 충족 전에는 불가", () => { expect(fullPracticeLabelAllowed(false)).toBe(false); expect(fullPracticeLabelAllowed(true)).toBe(true); });
});
