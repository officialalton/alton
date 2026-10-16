import { describe, expect, it } from "vitest";
import { checkNewVersionComposition, updatedVersionAnsweredText, type NewVersionContext, type SlotItem } from "./new-version";

const mc = (n: number, o: Partial<SlotItem> = {}): SlotItem => ({ section: "ap_mc_a", position: n, problemId: `p${n}`, candidateKey: `c${n}`, kind: "mc", unit: String(((n - 1) % 2) + 1), family: `f${n}`, calculator: "not_allowed", ...o });
const frq = (n: number): SlotItem => ({ section: "ap_frq", position: n, problemId: `q${n}`, candidateKey: `k${n}`, kind: "frq", unit: "1", family: `ff${n}`, calculator: "required" });
const rep = (id: string, o: Partial<SlotItem> = {}) => [id, { problemId: id, candidateKey: `ck-${id}`, kind: "mc" as const, unit: "1", family: `rf-${id}`, calculator: "not_allowed", ...o }] as const;
const ctx = (o: Partial<NewVersionContext> = {}): NewVersionContext => ({
  apLabel: "full_practice", sectionCalculator: { ap_mc_a: "not_allowed", ap_frq: "required" }, usedByOtherExams: new Set(), replacements: new Map([rep("r1"), rep("r2")]), ...o,
});
const source = [mc(1), mc(2), mc(3), mc(4), frq(1)];

describe("checkNewVersionComposition", () => {
  it("유효한 교체는 이슈 없이 최종 목록을 돌려준다(슬롯 위치 유지)", () => {
    const r = checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 2, problemId: "r1" }], ctx());
    expect(r.issues).toEqual([]);
    expect(r.items.find((i) => i.position === 2 && i.section === "ap_mc_a")?.problemId).toBe("r1");
    expect(r.items).toHaveLength(5);
  });
  it("없는 슬롯·알 수 없는 문항·같은 슬롯 두 번 교체를 거절한다", () => {
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 9, problemId: "r1" }], ctx()).issues).toContain("slot_missing_ap_mc_a:9");
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "zz" }], ctx()).issues).toContain("replacement_unknown_zz");
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "r1" }, { section: "ap_mc_a", position: 1, problemId: "r2" }], ctx()).issues).toContain("slot_swapped_twice_ap_mc_a:1");
  });
  it("슬롯 유형(mc↔frq)과 계산기 규칙 위반", () => {
    const c = ctx({ replacements: new Map([rep("rf", { kind: "frq" }), rep("rc", { calculator: "required" })]) });
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "rf" }], c).issues.join()).toMatch(/slot_type_ap_mc_a:1_mc_vs_frq/);
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "rc" }], c).issues.join()).toMatch(/calculator_ap_mc_a:1_not_allowed_vs_required/);
  });
  it("풀 모의고사: 같은 문항군 1개 초과·다른 시험과 겹침 거절, 부분 연습은 MC 문항군당 2까지", () => {
    const dupFam = ctx({ replacements: new Map([rep("r1", { family: "f3" })]) }); // f3 는 position 3 이 이미 사용
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "r1" }], dupFam).issues.join()).toMatch(/family_cap_mc_f3_2\/1/);
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "r1" }], { ...dupFam, apLabel: "mc_practice" }).issues).toEqual([]);
    expect(checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 1, problemId: "r1" }], ctx({ usedByOtherExams: new Set(["r1"]) })).issues).toContain("overlap_r1");
  });
  it("단원 비중(MC): 교체 뒤 단원 수가 범위를 벗어나면 이슈", () => {
    // 원본 단원 분포: 1→2개(p1,p3), 2→2개(p2,p4). r1(단원 1)로 p2 를 바꾸면 단원 1=3, 2=1.
    const bounds = { "1": { min: 1, max: 2 }, "2": { min: 2, max: 2 } };
    const r = checkNewVersionComposition(source, [{ section: "ap_mc_a", position: 2, problemId: "r1" }], ctx({ unitBounds: bounds }));
    expect(r.issues).toEqual(expect.arrayContaining(["unit_1_above_max_3/2", "unit_2_below_min_1/2"]));
  });
});

describe("updatedVersionAnsweredText", () => {
  it("N 이 있으면 'You already answered N of these questions.', 0 이면 비운다, 총수 초과는 총수로 자른다", () => {
    expect(updatedVersionAnsweredText({ itemTotal: 10, sharedAnswered: 6 })).toBe("You already answered 6 of these questions.");
    expect(updatedVersionAnsweredText({ itemTotal: 10, sharedAnswered: 0 })).toBe("");
    expect(updatedVersionAnsweredText({ itemTotal: 4, sharedAnswered: 9 })).toBe("You already answered 4 of these questions.");
  });
});
