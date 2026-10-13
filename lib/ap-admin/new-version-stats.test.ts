// 통계(ST1) 새 버전: 교체 계획 생성(저장소 파일만, DB 없음)과 통계 구성 검증(슬롯 42 = 단독 36 + 3문항 세트 2, 단일 섹션 ap_mc).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { checkNewVersionComposition, type NewVersionContext, type SlotItem } from "../mock-exam/new-version";
import { loadStatsPool } from "../../scripts/ap-generation/stats-pool";
import { planStatsNewVersion, slotsOf, resultOf, type StatsReport } from "../../scripts/ap-generation/st1-new-version-plan";
import { listSwapPlans, parseSwapPlan, readSwapPlan, resolveSwaps } from "./new-version";

const rd = (f: string) => (JSON.parse(readFileSync(f, "utf-8")) as { sets: StatsReport[] }).sets[0];
const SRC = rd("data/ap/stock/assembled/stats-st1-s2b.json"); const TGT = rd("data/ap/stock/assembled/stats-st1-s3a-prefer-ep.json");

describe("ST1 v1 → v2 교체 계획(저장소 파일)", () => {
  const { pool } = loadStatsPool({}); const by = new Map(pool.map((c) => [c.key, c]));
  const plan = planStatsNewVersion(SRC, TGT, pool);
  it("차이 10건만 위치 교체하고 독립 검증기 위반 0, 교체 후 문항 집합 = 목표", () => {
    expect(plan.ok).toBe(true); expect(plan.verifierViolations).toEqual([]);
    expect(plan.swaps).toHaveLength(10);
    expect(new Set([...plan.v2.mcA, ...plan.v2.frqA])).toEqual(new Set([...TGT.mcA, ...TGT.frqA]));
    expect(plan.v2.frqA).toEqual(SRC.frqA);
  });
  it("단독 칸만 바꾸고 세트 칸(13–15, 31–33)은 건드리지 않으며, 교체 칸의 단원은 서로 같다", () => {
    for (const s of plan.swaps) { expect(s.section).toBe("ap_mc"); expect(s.position).toBeGreaterThanOrEqual(1); expect(s.position).toBeLessThanOrEqual(42); expect([13, 14, 15, 31, 32, 33]).not.toContain(s.position); expect(s.remove.unit).toBe(s.add.unit); }
    expect(new Set(plan.swaps.map((s) => s.position)).size).toBe(10);
  });
  it("교체 위치는 v1 의 위치 규칙(슬롯)과 일치하고 제거 키가 그 칸의 문항이다", () => {
    const slots = slotsOf(resultOf(SRC, by)); expect(slots.reduce((a, s) => a + s.size, 0)).toBe(42);
    for (const s of plan.swaps) expect(slots.find((x) => x.start === s.position)?.key).toBe(s.removeKey);
  });
  it("커밋된 계획 파일이 생성 결과와 같고 형식·목록 규칙을 통과한다", () => {
    const f = readSwapPlan("st1-v2-swap-plan.json"); expect(f.set).toBe("ST1"); expect(f.sourceSetName).toBe("AP Statistics — Practice Exam 1"); expect(f.sourceVersionNo).toBe(1);
    expect(f.swaps.map((s) => [s.section, s.position, s.removeKey, s.addKey])).toEqual(plan.swaps.map((s) => [s.section, s.position, s.removeKey, s.addKey]));
    expect(listSwapPlans().some((p) => p.file === "st1-v2-swap-plan.json" && p.swapCount === 10)).toBe(true);
    expect((JSON.parse(readFileSync("data/ap/stock/st1-v2-swap-plan.json", "utf-8")) as { verifierViolations: string[] }).verifierViolations).toEqual([]);
    expect(parseSwapPlan(f)).toBeTruthy();
  });
  it("목표가 v1 과 같으면 교체 0건", () => { expect(planStatsNewVersion(SRC, SRC, pool).swaps).toEqual([]); });
});

// 통계 슬롯 픽스처: 단원 10/9/9/7/7, 세트 2개(13–15 단원 2, 31–33 단원 5), 계산기 허용 섹션.
const mk = (n: number): SlotItem[] => {
  const unitOf = (p: number) => (p <= 10 ? "1" : p <= 19 ? "2" : p <= 28 ? "3" : p <= 38 ? "4" : "5"); // 세트 위치는 아래에서 덮어씀: 단원 1:10 2:9 3:9 4:7 5:7
  const out: SlotItem[] = [];
  for (let p = 1; p <= n; p++) {
    const set = p >= 13 && p <= 15 ? "SET2" : p >= 31 && p <= 33 ? "SET5" : null;
    const unit = set === "SET2" ? "2" : set === "SET5" ? "5" : unitOf(p);
    out.push({ section: "ap_mc", position: p, problemId: `p${p}`, candidateKey: set ?? `k${p}`, kind: "mc", unit, family: set ?? `f${p}`, calculator: "allowed" });
  }
  return out;
};
const rep = (id: string, unit: string, key = id, calculator: string | null = "allowed") => [id, { problemId: id, candidateKey: key, kind: "mc" as const, unit, family: `f-${id}`, calculator }] as const;
const ctx = (r: (readonly [string, Omit<SlotItem, "section" | "position">])[], setSizes?: Map<string, number>): NewVersionContext => ({
  apLabel: "full_practice", sectionCalculator: { ap_mc: "allowed" }, unitBounds: fullPracticeUnitBounds("ap_statistics", "full_practice"), usedByOtherExams: new Set(), replacements: new Map(r), setSizes,
});

describe("통계 새 버전 구성 검증(픽스처)", () => {
  const src = mk(42).map((s) => (s.position <= 10 ? { ...s, unit: "1" } : s));
  it("출발 구성의 단원 합이 공식 범위 안이다(픽스처 확인)", () => { expect(checkNewVersionComposition(src, [], ctx([])).issues).toEqual([]); });
  it("같은 단원 단독 교체는 통과(계산기 허용 섹션: allowed/null 모두 가능)", () => {
    expect(checkNewVersionComposition(src, [{ section: "ap_mc", position: 2, problemId: "n1" }, { section: "ap_mc", position: 20, problemId: "n2" }], ctx([rep("n1", "1"), rep("n2", "3", "n2", null)])).issues).toEqual([]);
  });
  it("단원이 바뀌어 공식 비중을 벗어나면 위반(단원 1 → 단원 4 로 5칸)", () => {
    const sw = [1, 2, 3, 4, 5].map((p) => ({ section: "ap_mc", position: p, problemId: `m${p}` }));
    const r = checkNewVersionComposition(src, sw, ctx(sw.map((s) => rep(s.problemId, "4"))));
    expect(r.issues.some((i) => i.startsWith("unit_1_below_min"))).toBe(true);
  });
  it("계산기 불가 문항은 계산기 허용 섹션에 넣을 수 없다", () => {
    expect(checkNewVersionComposition(src, [{ section: "ap_mc", position: 2, problemId: "n1" }], ctx([rep("n1", "1", "n1", "not_allowed")])).issues.some((i) => i.startsWith("calculator_"))).toBe(true);
  });
  it("3문항 세트는 통째로만 바뀐다: 한 칸만 바꾸면 거부, 3칸을 같은 새 세트로 바꾸면 통과", () => {
    const one = checkNewVersionComposition(src, [{ section: "ap_mc", position: 13, problemId: "s1" }], ctx([rep("s1", "2", "NEWSET")], new Map([["NEWSET", 3]])));
    expect(one.issues.some((i) => i.startsWith("set_partial_swap_SET2") || i.startsWith("set_replacement_incomplete_NEWSET"))).toBe(true);
    const all = checkNewVersionComposition(src, [13, 14, 15].map((p, j) => ({ section: "ap_mc", position: p, problemId: `s${j}` })), ctx([0, 1, 2].map((j) => rep(`s${j}`, "2", "NEWSET")), new Map([["NEWSET", 3]])));
    expect(all.issues).toEqual([]);
  });
  it("resolveSwaps: 세트의 한 칸만 가리켜도 3칸으로 펼치고(addIndex 0–2), 세트를 서로 다른 후보로 나누면 거부", () => {
    const slots = src.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey }));
    const ok = resolveSwaps([{ section: "ap_mc", position: 13, removeKey: "SET2", addKey: "NEW" }], slots);
    expect(ok.problems).toEqual([]); expect(ok.swaps.map((s) => [s.position, s.addIndex])).toEqual([[13, 0], [14, 1], [15, 2]]);
    const bad = resolveSwaps([{ section: "ap_mc", position: 13, removeKey: "SET2", addKey: "A" }, { section: "ap_mc", position: 14, removeKey: "SET2", addKey: "B" }], slots);
    expect(bad.problems.length).toBeGreaterThan(0);
    const wrong = resolveSwaps([{ section: "ap_mc", position: 2, removeKey: "k3", addKey: "A" }], slots);
    expect(wrong.problems.some((p) => p.includes("다릅니다"))).toBe(true);
  });
});
