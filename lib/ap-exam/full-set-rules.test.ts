import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkNewVersionComposition, type NewVersionContext, type SlotItem } from "../mock-exam/new-version";
import { subjectOfSetId, subjectOfSetIdOrNull, defaultDraftName, planDraftSet } from "../ap-admin/assemble-draft";
import { fullPracticeUnitBounds, STATS_FULL_TARGET, statsSkillBounds, statsUnitBounds, verifyStatsFullComposition, type StatsSetItem } from "./full-set-rules";

describe("통계 풀 세트 구성 규칙(공식 비중 → 42문항 정수 범위)", () => {
  it("공식 단원·스킬 비중이 data/ap/curriculum-2027/ap_statistics.json 의 weights 와 일치하고 42문항 범위로 환산된다", () => {
    const j = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_statistics.json"), "utf-8")) as { weights: { axis: string; code: string; section: string; min: number; max: number }[] };
    const unit = Object.fromEntries(j.weights.filter((w) => w.axis === "unit" && w.section === "mc").map((w) => [w.code, [w.min, w.max]]));
    expect(unit).toEqual({ "1": [20, 30], "2": [15, 25], "3": [15, 25], "4": [10, 20], "5": [10, 20] });
    expect(statsUnitBounds()).toEqual({ "1": { min: 9, max: 12 }, "2": { min: 7, max: 10 }, "3": { min: 7, max: 10 }, "4": { min: 5, max: 8 }, "5": { min: 5, max: 8 } });
    expect(statsSkillBounds()).toEqual({ "1": { min: 3, max: 4 }, "2": { min: 9, max: 12 }, "3": { min: 11, max: 14 }, "4": { min: 11, max: 14 } });
    for (const [u, n] of Object.entries(STATS_FULL_TARGET.units)) expect(n).toBeGreaterThanOrEqual(statsUnitBounds()[u].min), expect(n).toBeLessThanOrEqual(statsUnitBounds()[u].max);
    expect(Object.values(STATS_FULL_TARGET.units).reduce((a, b) => a + b, 0)).toBe(42);
    expect(Object.values(STATS_FULL_TARGET.skills).reduce((a, b) => a + b, 0)).toBe(42);
  });
  it("풀 세트 단원 범위는 과목별이다: AB 는 기존 값, 통계는 통계 값, 다른 과목·부분 세트는 점검 없음", () => {
    expect(fullPracticeUnitBounds("ap_calculus_ab", "full_practice")?.["1"]).toEqual({ min: 5, max: 6 });
    expect(fullPracticeUnitBounds("ap_statistics", "full_practice")?.["5"]).toEqual({ min: 5, max: 8 });
    expect(fullPracticeUnitBounds("ap_statistics", "mc_practice")).toBeUndefined();
    expect(fullPracticeUnitBounds("ap_biology", "full_practice")).toBeUndefined();
    expect(fullPracticeUnitBounds("ap_calculus_bc", "full_practice")).toBeUndefined();
  });

  const unitSeq = (u: string, n: number) => Array.from({ length: n }, () => u);
  const build = (): StatsSetItem[] => {
    const units = [...unitSeq("1", 10), ...unitSeq("2", 6), ...unitSeq("3", 9), ...unitSeq("4", 7), ...unitSeq("5", 4)]; // 단독 36 + 세트(단원 2) 3 + 세트(단원 5) 3 = 42
    const skills = [...unitSeq("1", 4), ...unitSeq("2", 10), ...unitSeq("3", 8), ...unitSeq("4", 14)]; // 36 단독(+ 세트 6문항이 스킬 3)
    const out: StatsSetItem[] = []; let pos = 0;
    units.forEach((u, i) => out.push({ kind: "mc", unit: u, skillCat: skills[i], candidateKey: `c${i}`, position: ++pos }));
    for (const [u, key] of [["2", "setA"], ["5", "setB"]] as const) for (let k = 0; k < 3; k++) out.push({ kind: "mc", unit: u, skillCat: "3", candidateKey: key, position: ++pos });
    for (let i = 0; i < 4; i++) out.push({ kind: "frq", unit: "1", skillCat: null, candidateKey: `f${i}`, position: i + 1 });
    return out;
  };
  it("규칙을 만족하는 구성은 위반 0", () => expect(verifyStatsFullComposition(build())).toEqual([]));
  it("단원 범위·세트 크기·세트 연속성·세트 수 위반을 잡는다", () => {
    const base = build();
    expect(verifyStatsFullComposition(base.filter((i) => !(i.kind === "frq" && i.candidateKey === "f0"))).join()).toMatch(/frq_count_3/);
    const heavy = base.map((i) => (i.kind === "mc" && ["c0", "c1", "c2"].includes(i.candidateKey ?? "") ? { ...i, unit: "4" } : i));
    expect(verifyStatsFullComposition(heavy).join()).toMatch(/unit_1_7_not_in_9-12/);
    const split = base.map((i) => (i.candidateKey === "setA" && i.position === 39 ? { ...i, position: 5 } : i));
    expect(verifyStatsFullComposition(split).join()).toMatch(/set_not_contiguous_setA/);
    const noSet = base.map((i) => (i.candidateKey === "setB" ? { ...i, candidateKey: `x${i.position}` } : i));
    expect(verifyStatsFullComposition(noSet).join()).toMatch(/shared_sets_1\/2/);
  });
});

describe("공유 자료 세트(3문항)는 새 버전에서 함께 움직인다", () => {
  const mk = (n: number, key: string, o: Partial<SlotItem> = {}): SlotItem => ({ section: "ap_mc", position: n, problemId: `p${n}`, candidateKey: key, kind: "mc", unit: "2", family: `fam-${key}`, calculator: "allowed", ...o });
  const source = [mk(1, "a"), mk(2, "set"), mk(3, "set"), mk(4, "set"), mk(5, "b")];
  const repl = (ids: string[], key: string) => ids.map((id) => [id, { problemId: id, candidateKey: key, kind: "mc" as const, unit: "2", family: `fam-${key}`, calculator: "allowed" }] as const);
  const ctx = (reps: (readonly [string, Omit<SlotItem, "section" | "position">])[], sizes: [string, number][] = [["newset", 3]]): NewVersionContext => ({ apLabel: "full_practice", sectionCalculator: { ap_mc: "allowed" }, usedByOtherExams: new Set(), replacements: new Map(reps), setSizes: new Map(sizes) });
  const swaps = (ids: string[], positions = [2, 3, 4]) => ids.map((id, i) => ({ section: "ap_mc", position: positions[i], problemId: id }));
  it("세트를 통째로 같은 교체 세트 하나로 바꾸면 통과", () => expect(checkNewVersionComposition(source, swaps(["n1", "n2", "n3"]), ctx(repl(["n1", "n2", "n3"], "newset"))).issues).toEqual([]));
  it("세트의 일부만 바꾸면 거절한다", () => expect(checkNewVersionComposition(source, swaps(["n1"], [2]), ctx(repl(["n1"], "newset"))).issues.join()).toMatch(/set_partial_swap_set_1\/3/));
  it("세트 슬롯을 서로 다른 후보로 채우면 거절한다", () => {
    const reps = [...repl(["n1", "n2"], "newset"), ...repl(["n3"], "other")];
    expect(checkNewVersionComposition(source, swaps(["n1", "n2", "n3"]), ctx(reps, [["newset", 3], ["other", 3]])).issues.join()).toMatch(/set_replacement_split_set/);
  });
  it("단독 문항 슬롯 하나에 3문항 세트의 문항 하나만 넣으면 세트가 깨지므로 거절한다", () => {
    expect(checkNewVersionComposition(source, swaps(["n1"], [1]), ctx(repl(["n1"], "newset"))).issues.join()).toMatch(/set_replacement_incomplete_newset_1\/3/);
  });
  it("문항군 상한은 세트를 한 묶음으로 센다(세트의 세 문항이 같은 문항군이어도 위반 아님)", () => {
    const fam = source.map((i) => (i.candidateKey === "set" ? { ...i, family: "shared-fam" } : i));
    expect(checkNewVersionComposition(fam, [], ctx([])).issues).toEqual([]);
  });
});

describe("세트 ID → 과목(AB 로 가정하지 않는다)", () => {
  it("AB·BC·ST 접두를 구분하고 모르는 접두는 거부한다", () => {
    expect(subjectOfSetId("AB2")).toBe("ap_calculus_ab"); expect(subjectOfSetId("BC3")).toBe("ap_calculus_bc"); expect(subjectOfSetId("ST1")).toBe("ap_statistics");
    expect(subjectOfSetIdOrNull("XX1")).toBeNull(); expect(() => subjectOfSetId("XX1")).toThrow();
    expect(defaultDraftName("ST1")).toBe("AP Statistics — Practice Exam 1");
  });
  it("통계 세트 초안 조립은 AB 로 오판하지 않고 통계 전용 계획기(공식 구조 검증)가 빈 구성을 거절한다", () => {
    const r = planDraftSet({ setId: "ST1", keys: { mcA: [], mcB: [], frqA: [], frqB: [] }, hasVirtual: false, pool: [], existingFullSets: [], publishedKeys: new Set(), stock: [] });
    expect(r.subject).toBe("ap_statistics"); expect(r.ok).toBe(false); expect(r.problems.join()).toMatch(/mc_count_0\/42/); expect(r.problems.join()).toMatch(/shared_sets_0\/2/);
    const x = planDraftSet({ setId: "ZZ9", keys: { mcA: [], mcB: [], frqA: [], frqB: [] }, hasVirtual: false, pool: [], existingFullSets: [], publishedKeys: new Set(), stock: [] });
    expect(x.subject).toBe("unknown"); expect(x.problems.join()).toMatch(/세트 이름 형식 오류/);
  });
});
