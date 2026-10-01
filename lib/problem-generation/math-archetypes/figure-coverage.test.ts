// 자료 원형 커버리지 게이트 G1~G10 — 이번에는 파일럿 skill(two_variable_data 15항목)만 통과 상태이고 나머지 288항목은 '미구현'으로 목록에 남는다.
// 전체 스윕(시드 N)은 느리므로 기본은 스모크(시드 40)이고, 보고서 생성은 `WRITE_GATE_REPORT=1 GATE_SEEDS=5000 npx vitest run lib/problem-generation/math-archetypes/figure-coverage.test.ts`.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { FIGURE_ITEMS, NO_FIGURE } from "./figure-coverage-manifest";
import { GATE_REPORT_PATH, assertCoverageGate, CoverageGateError, type GateReport } from "./figure-coverage";
import { evaluateCoverageGate, figureArchetypes, SPR_REQUIRED_GROUPS, sprInventory } from "./figure-coverage-gate";
import { FTVD_HARD } from "./skills/two-variable-data-figure";
import { ARCHETYPES } from "./registry";
import { sprCapability } from "./spr-capability";

const SEEDS = Number(process.env.GATE_SEEDS ?? 40);
const PILOT = FIGURE_ITEMS.filter((r) => figureArchetypes().some((a) => a.figureItem === r.id));

describe("manifest — 모든 조합의 단일 목록", () => {
  it("항목 수가 조사 문서와 같다(303 = 207 + 96, 위치 P 241 / C 55 / B 7), id 는 유일하다", () => {
    expect(FIGURE_ITEMS).toHaveLength(303);
    expect(FIGURE_ITEMS.filter((r) => r.source === "A")).toHaveLength(207);
    expect(FIGURE_ITEMS.filter((r) => r.source === "B")).toHaveLength(96);
    expect(["P", "C", "B"].map((l) => FIGURE_ITEMS.filter((r) => r.loc === l).length)).toEqual([241, 55, 7]);
    expect(new Set(FIGURE_ITEMS.map((r) => r.id)).size).toBe(303);
    expect(NO_FIGURE.length).toBeGreaterThan(0); for (const n of NO_FIGURE) expect(n.reason.length).toBeGreaterThan(3);
  });
  it("낮은 빈도 항목도 빠지지 않았다(제외가 아니라 순서)", () => { expect(FIGURE_ITEMS.filter((r) => r.freq === "하").length).toBeGreaterThan(80); expect(FIGURE_ITEMS.filter((r) => r.basis === "E3").length).toBeGreaterThan(80); });
  it("파일럿 15항목이 manifest 에 있다", () => {
    const want = ["cell.TW.P", "row_total.TW.P", "conditional_share.TW.P", "conditional_share.TW.C", "scatter_equation.SC.P", "scatter_equation.LG.P", "scatter_equation.SC.C", "scatter_predict.SC.P", "scatter_predict.LG.P", "scatter_slope_context.SC.P", "scatter_slope_context.LG.P", "scatter_count_above.SC.P", "scatter_count_above.SC.C", "association_direction_strength.SC.P", "association_direction_strength.SC.C"];
    const ids = new Set(FIGURE_ITEMS.map((r) => r.id)); for (const w of want) expect(ids.has(`two_variable_data.${w}`), w).toBe(true);
    expect(figureArchetypes().map((a) => a.figureItem).filter((x, i, l) => l.indexOf(x) === i)).toHaveLength(15);
  });
});

describe("원형 선언 — 모든 자료 원형이 manifest 항목·SPR 선언을 가진다", () => {
  it("figureItem 은 manifest 에 있고 hard 4(서로 다른 연산자)·easy 1+·medium 1+", () => {
    const ids = new Set(FIGURE_ITEMS.map((r) => r.id)); const by = new Map<string, ReturnType<typeof figureArchetypes>>();
    for (const a of figureArchetypes()) { expect(ids.has(a.figureItem!), a.id).toBe(true); expect(a.spr, a.id).toBeTruthy(); by.set(a.figureItem!, [...(by.get(a.figureItem!) ?? []), a]); }
    for (const [id, l] of by) { const h = l.filter((a) => a.level === "hard"); expect(h.length, id).toBe(4); expect(new Set(h.map((a) => a.operator)).size, id).toBe(4); expect(l.filter((a) => a.level === "easy").length, id).toBeGreaterThanOrEqual(1); expect(l.filter((a) => a.level === "medium").length, id).toBeGreaterThanOrEqual(1); }
  });
  it("전체 원형 중 SPR 가능 비율·불가 목록(옛 원형은 프로브 판정)이 집계된다", { timeout: 300_000 }, () => {
    const all = [...ARCHETYPES]; let cap = 0; const no: string[] = []; let declared = 0;
    for (const a of all) { const c = sprCapability(a); if (c.declared) declared++; if (c.capable) cap++; else no.push(`${a.id}: ${c.reason}`); }
    expect(cap + no.length).toBe(all.length); expect(declared).toBe(FTVD_HARD.length);
    // 보고용 — 불가 목록은 전부 사유가 있다
    for (const n of no) expect(n.split(": ")[1].length).toBeGreaterThan(5);
    expect(cap / all.length).toBeGreaterThan(0.3);
  });
});

describe(`게이트 G1~G10 (시드 ${SEEDS})`, () => {
  const run = () => evaluateCoverageGate({ seeds: SEEDS, mutationSeeds: 12 });
  it("파일럿 15항목은 전부 pass, 나머지 288항목은 미구현으로 남아 전체 게이트는 닫혀 있다", () => {
    const { report, arch } = run();
    const fails = Object.entries(report.items).filter(([, r]) => r.status === "fail").map(([id, r]) => `${id}: ${r.failures.join(" ; ")}`);
    expect(fails, fails.join("\n")).toEqual([]);
    expect(report.summary.pass).toBe(15); expect(report.summary.unimplemented + report.summary.blockedRenderer).toBe(288); expect(report.ok).toBe(false);
    expect(report.gates.G1.ok, report.gates.G1.note).toBe(true); expect(report.gates.G8.ok, report.gates.G8.note).toBe(true); expect(report.gates.G10.ok, report.gates.G10.note).toBe(true); expect(report.gates.G9.ok).toBe(false); // 288개 미구현 조합은 시각 검수 상태가 unimplemented
    for (const r of PILOT) expect(report.qaByItem[r.id].state, r.id).toBe("pass");
    for (const r of PILOT) { expect(report.items[r.id].status, r.id).toBe("pass"); expect(report.items[r.id].hard, r.id).toBe(4); }
    expect(report.spr.supplyImplemented).toBeGreaterThanOrEqual(SPR_REQUIRED_GROUPS);
    if (process.env.WRITE_GATE_REPORT) {
      writeFileSync(path.join(process.cwd(), GATE_REPORT_PATH), JSON.stringify({ ...report, sprInventory: sprInventory(), archetypeSweeps: arch.map((r) => ({ id: r.id, fmt: r.fmt, seeds: r.seeds, produced: r.produced, genFail: r.genFail, thrown: r.thrown, verifyFail: r.verifyFail, independent: r.independent, dup200: r.dup200, dupAll: `${r.dupAll}/${r.produced}`, mutants: `${r.mutantsCaught}/${r.mutants}`, keySwap: `${r.keyCaught}/${r.keyTotal}`, slots: r.slots })) }, null, 1));
    }
  }, 3_600_000);
});

describe("대량 생성 가드 — 게이트 미통과면 시작하지 않는다", () => {
  const fake = (ok: boolean, pass: string[]): GateReport => ({ version: 1, generatedAt: "t", seedsPerArchetype: 1, ok, summary: { items: 303, pass: pass.length, fail: 0, unimplemented: 303 - pass.length, blockedRenderer: 0, waived: 0 }, gates: {}, items: Object.fromEntries(pass.map((id) => [id, { status: "pass" as const, hard: 4, em: 2, operators: [], sprHard: 0, failures: [] }])), qaByItem: {}, spr: { requiredHardSprFor30Sets: 60, supplyImplemented: 0, sprCapableItems: 0, sprIncapableItems: 0, byItem: {} } });
  const arch = figureArchetypes() as unknown as Parameters<typeof assertCoverageGate>[0];
  it("전체 ok=false 이면 거부(보고서가 없어도 거부)", () => {
    expect(() => assertCoverageGate(arch, { report: fake(false, []) })).toThrow(CoverageGateError);
    expect(() => assertCoverageGate(arch, { report: null })).toThrow(CoverageGateError);
  });
  it("오너 승인 부분집합(allowItems)이 보고서에서 pass 인 항목만 열린다", () => {
    const one = arch.filter((a) => a.figureItem === "two_variable_data.cell.TW.P");
    expect(() => assertCoverageGate(one, { report: fake(false, ["two_variable_data.cell.TW.P"]), allowItems: ["two_variable_data.cell.TW.P"] })).not.toThrow();
    expect(() => assertCoverageGate(one, { report: fake(false, []), allowItems: ["two_variable_data.cell.TW.P"] })).toThrow(CoverageGateError);
    expect(() => assertCoverageGate(one, { report: fake(false, ["two_variable_data.cell.TW.P"]) })).toThrow(CoverageGateError);
  });
  it("전체 ok=true 이거나 자료 원형이 없으면 통과", () => {
    expect(() => assertCoverageGate(arch, { report: fake(true, []) })).not.toThrow();
    expect(() => assertCoverageGate(ARCHETYPES.filter((a) => !a.figureItem).slice(0, 5), { report: null })).not.toThrow();
  });
});
