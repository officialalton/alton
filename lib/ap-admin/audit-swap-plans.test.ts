// 외부 감사(2026-10-08) 삼각검증으로 만든 AP 교체 계획 파일의 정합성(순수 파일 검사, DB 없음).
// 계획이 가리키는 제거 문항이 게시 구성(AB1 v2 = 게시본 + ab1-v2 교체, 나머지 5세트 = exact-assign-5sets-cons)의 그 칸에 실제로 있고,
// 추가 문항이 재고에 있으며 6세트 어디에도 이미 쓰이지 않는지, 같은 계획 안에서 중복되지 않는지 확인한다.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSwapPlan } from "./new-version";

type Keys = { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const SEC: Record<string, keyof Keys> = { ap_mc_a: "mcA", ap_mc_b: "mcB", ap_frq_a: "frqA", ap_frq_b: "frqB" };

const ab1 = rd<{ keys: Keys }>("data/ap/stock/ab-full-set-selection.json").keys;
const v2 = rd<{ swaps: { section: string; position: number; addKey: string }[] }>("data/ap/stock/ab1-v2-swap-plan.json");
const ab1v2: Keys = { mcA: [...ab1.mcA], mcB: [...ab1.mcB], frqA: [...ab1.frqA], frqB: [...ab1.frqB] };
for (const s of v2.swaps) ab1v2[SEC[s.section]][s.position - 1] = s.addKey;
const five = rd<{ sets: ({ id: string } & Keys)[] }>("data/ap/stock/exact-assign-5sets-cons.json").sets;
const comp: Record<string, Keys> = { AB1: ab1v2, ...Object.fromEntries(five.map((s) => [s.id, s])) };
const all = new Set(Object.values(comp).flatMap((k) => [...k.mcA, ...k.mcB, ...k.frqA, ...k.frqB]));

const stock = new Set<string>();
for (const f of readdirSync("data/ap/stock").filter((x) => /items\.json$/.test(x))) for (const r of rd<{ stockKey?: string }[]>(`data/ap/stock/${f}`)) if (r.stockKey) stock.add(r.stockKey);

const planFiles = readdirSync("data/ap/stock").filter((f) => /-audit-swap-plan\.json$/.test(f));

describe("외부 감사 교체 계획 파일", () => {
  it("5개 계획(AB1 v3, AB2, AB3, BC1, BC2)이 있다", () => { expect(planFiles.sort()).toEqual(["ab1-v3-audit-swap-plan.json", "ab2-v2-audit-swap-plan.json", "ab3-v2-audit-swap-plan.json", "bc1-v2-audit-swap-plan.json", "bc2-v2-audit-swap-plan.json"]); });
  for (const f of planFiles) {
    it(`${f}: 형식·제거 칸·추가 문항`, () => {
      const raw = rd<{ verifierViolations?: unknown[] }>(`data/ap/stock/${f}`);
      const plan = parseSwapPlan(raw);
      expect(raw.verifierViolations).toEqual([]);
      const ks = comp[plan.set]; expect(ks).toBeTruthy();
      const adds = new Set<string>();
      for (const s of plan.swaps) {
        expect(s.position).toBeGreaterThan(0);
        expect(ks[SEC[s.section]][s.position! - 1]).toBe(s.removeKey);
        expect(stock.has(s.addKey)).toBe(true);
        expect(all.has(s.addKey)).toBe(false); // 6세트 어디에도 이미 있는 문항을 넣지 않는다
        expect(adds.has(s.addKey)).toBe(false); adds.add(s.addKey);
      }
    });
  }
  it("계획끼리 같은 문항을 추가하지 않는다", () => {
    const adds = planFiles.flatMap((f) => parseSwapPlan(rd(`data/ap/stock/${f}`)).swaps.map((s) => s.addKey));
    expect(new Set(adds).size).toBe(adds.length);
  });
  it("MC 교체는 전제 모순 원형(fprime_graph_statements)을 제거하고 같은 원형을 넣지 않는다", () => {
    const items = new Map<string, { payload?: { archetype?: string } }>();
    for (const f of readdirSync("data/ap/stock").filter((x) => /items\.json$/.test(x))) for (const r of rd<{ stockKey?: string; payload?: { archetype?: string } }[]>(`data/ap/stock/${f}`)) if (r.stockKey && !items.has(r.stockKey)) items.set(r.stockKey, r);
    const mc = planFiles.flatMap((f) => parseSwapPlan(rd(`data/ap/stock/${f}`)).swaps).filter((s) => s.section.startsWith("ap_mc"));
    expect(mc.length).toBe(3);
    for (const s of mc) { expect(items.get(s.removeKey!)?.payload?.archetype).toBe("fprime_graph_statements"); expect(items.get(s.addKey)?.payload?.archetype).not.toBe("fprime_graph_statements"); }
  });
});
