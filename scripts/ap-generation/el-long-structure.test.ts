import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyElangFullComposition, ELANG_OFFICIAL_READING_SETS, ELANG_OFFICIAL_WRITING_SETS, type ElangSetItem } from "../../lib/ap-exam/elang-rules";
import { parseSwapPlan, resolveSwaps } from "../../lib/ap-admin/new-version";
import { STOCK_BATCHES } from "../../lib/ap-admin/batches";
import { buildPlan } from "./el-long-swap-plans";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rd = (f: string) => JSON.parse(readFileSync(f, "utf-8")) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const long: Json[] = rd("data/ap/stock/el-long-items.json"), rv: Json[] = rd("data/ap/stock/el-rv-items.json");
const by = new Map([...rv, ...long].map((r) => [r.stockKey as string, r]));
const assign = rd("data/ap/stock/exact-assign-el-long-el1-el2.json").sets as { id: string; mcA: string[]; frqA: string[]; virtual: unknown[] }[];
const items = (id: string): ElangSetItem[] => { const s = assign.find((x) => x.id === id)!; let pos = 1; const out: ElangSetItem[] = []; for (const k of s.mcA) for (const it of by.get(k)!.payload.items as Json[]) out.push({ kind: "mc", skill: it.skill, candidateKey: k, position: pos++ }); s.frqA.forEach((k, i) => out.push({ kind: "frq", skill: null, candidateKey: k, position: i + 1 })); return out; };

describe("EL long-passage restructure", () => {
  it("each exam has the official 5-set structure and passes the independent composition verifier", () => {
    for (const id of ["EL1", "EL2"]) {
      expect(verifyElangFullComposition(items(id))).toEqual([]);
      const s = assign.find((x) => x.id === id)!; expect(s.mcA).toHaveLength(5); expect(s.virtual).toHaveLength(0);
      const sizes = s.mcA.map((k) => (by.get(k)!.payload.items as unknown[]).length); const kinds = s.mcA.map((k) => by.get(k)!.payload.el_passage.kind);
      const reading = sizes.filter((_, i) => kinds[i] === "reading"), writing = sizes.filter((_, i) => kinds[i] === "writing").sort((a, b) => b - a);
      expect(reading).toHaveLength(ELANG_OFFICIAL_READING_SETS.count); reading.forEach((n) => { expect(n).toBeGreaterThanOrEqual(11); expect(n).toBeLessThanOrEqual(14); });
      expect(writing).toHaveLength(3); writing.forEach((n, i) => { expect(n).toBeGreaterThanOrEqual(ELANG_OFFICIAL_WRITING_SETS.sizes[i].min); expect(n).toBeLessThanOrEqual(ELANG_OFFICIAL_WRITING_SETS.sizes[i].max); });
    }
  });
  it("EL1 and EL2 share no MC set, FRQ, or passage", () => {
    const [a, b] = assign; const ka = [...a.mcA, ...a.frqA], kb = [...b.mcA, ...b.frqA]; expect(ka.filter((k) => kb.includes(k))).toEqual([]);
    const pass = (s: typeof a) => s.mcA.map((k) => JSON.stringify(by.get(k)!.payload.el_passage.paragraphs).slice(0, 200)); expect(pass(a).filter((p) => pass(b).includes(p))).toEqual([]);
  });
  it("the key is strictly the longest option in at most ~25% of the extended-set items (the 20% review rule, with slack for sampling)", () => {
    const all = long.flatMap((r) => r.payload.items as Json[]); const n = all.filter((it) => { const L = it.options.map((o: Json) => o.text.length), k = it.key_index; return L.every((x: number, i: number) => i === k || x < L[k]); }).length;
    expect(n / all.length).toBeLessThanOrEqual(0.25);
  });
  it("every extended item keeps four options with one key, key confidence, and no hidden sentence numbers in reading explanations", () => {
    for (const r of long) for (const it of r.payload.items as Json[]) {
      expect(it.options).toHaveLength(4); expect(it.key_index).toBeGreaterThanOrEqual(0); expect(it.key_confidence?.score).toBeGreaterThanOrEqual(0.8);
      if (r.payload.el_passage.kind === "reading") expect(it.options.some((o: Json) => /\b[Ss]entences?\s+\d|\(\d+(?:\s*[-–]\s*\d+)?\)/.test(o.why))).toBe(false);
    }
  });
  it("the batch is registered with its evidence file and pass keys match the items", () => {
    const b = STOCK_BATCHES.find((x) => x.id === "el-long")!; expect(b).toMatchObject({ itemsFile: "el-long-items.json", passKeysFile: "el-long-pass-keys.json", evidenceFile: "evidence-el-long.json", supplement: true });
    expect(rd("data/ap/stock/el-long-pass-keys.json").sort()).toEqual(long.map((c) => c.stockKey).sort());
  });
  it("the regroup swap plans resolve against the published v3 layout with no problems and keep the short writing set in place", () => {
    const cur = rd("data/ap/stock/exact-assign-el-el1-el2.json").sets as Json[];
    for (const id of ["EL1", "EL2"]) {
      const file = parseSwapPlan(rd(`data/ap/stock/${id.toLowerCase()}-long-v4-swap-plan.json`)); expect(file.swaps.length).toBeGreaterThan(30);
      let pos = 1; const slots: { section: string; position: number; candidateKey: string | null }[] = [];
      for (const k0 of cur.find((s) => s.id === id)!.mcA as string[]) { const k = `el-rv:${k0.split(":")[1]}`; for (let j = 0; j < (by.get(k)!.payload.items as unknown[]).length; j++) slots.push({ section: "ap_mc", position: pos++, candidateKey: k }); }
      const r = resolveSwaps(file.swaps, slots); expect(r.problems).toEqual([]);
      const short = assign.find((x) => x.id === id)!.mcA.find((k) => k.startsWith("el-rv:"))!; const sp = slots.filter((s) => s.candidateKey === short).map((s) => s.position); expect(r.swaps.some((s) => sp.includes(s.position))).toBe(false);
      expect(buildPlan(id).swaps).toEqual(file.swaps.map((s) => ({ section: s.section, position: s.position, removeKey: s.removeKey, addKey: s.addKey, addIndex: s.addIndex })));
    }
  });
});
