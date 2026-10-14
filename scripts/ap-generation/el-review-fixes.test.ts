import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSwapPlan } from "../../lib/ap-admin/new-version";
import { frqViolations, type ElFrqPayload } from "../../lib/ap-generation/englang-frq";
import { itemViolations, setViolations, type ElSetRaw } from "../../lib/ap-generation/englang-gates";

// EL 검수 수정본(2026-10-14) 불변식: 키 위치·키 정답 유지, 결정적 게이트 통과, 교체 계획 형식, 읽기 해설에 숨은 문장 번호 없음, 샘플 점수 합계.
const rd = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const stock: Record<string, any> = {};
for (const f of readdirSync("data/ap/stock").filter((x) => /^el-.*-items\.json$/.test(x))) for (const it of rd<any[]>(path.join("data/ap/stock", f))) stock[it.stockKey] = it;
const fixed = rd<any[]>("data/audit/el-review-fix-items.json");
const toRaw = (p: any, items: any[]): ElSetRaw => ({ kind: p.el_passage.kind, blueprint: p.blueprint, provenance: p.provenance, title: p.el_passage.title, paragraphs: p.el_passage.paragraphs, items: items.map((it) => ({ skill: it.skill, topic: it.topic, cognitive: it.cognitive, stem: it.stem, options: it.options.map((o: any, j: number) => ({ text: o.text, is_key: j === it.key_index, label: o.label, why: o.why })), evidence_sentence_ids: it.evidence_sentence_ids, devices_used: it.devices_used })) } as ElSetRaw);

describe("EL review fixes", () => {
  const mc = fixed.filter((c) => c.kind === "mc"), frq = fixed.filter((c) => c.kind === "frq_bundle");
  it("has 22 MC sets and 6 FRQ bundles with el-review-fix keys", () => { expect(mc.length).toBe(22); expect(frq.length).toBe(6); for (const c of fixed) expect(c.stockKey).toBe(`el-review-fix:${c.candidateKey}`); });
  it("keeps key position and passes item gates (no new violations)", () => {
    for (const c of mc) {
      const o = Object.values(stock).find((x: any) => x.candidateKey === c.candidateKey && x.kind === "mc")!;
      expect(o, c.stockKey).toBeTruthy();
      c.payload.items.forEach((it: any, i: number) => {
        const oi = o.payload.items[i]; expect(it.key_index, `${c.stockKey} q${i + 1}`).toBe(oi.key_index);
        const before = itemViolations(toRaw(o.payload, o.payload.items), toRaw(o.payload, [oi]).items[0]);
        const after = itemViolations(toRaw(c.payload, c.payload.items), toRaw(c.payload, [it]).items[0]);
        expect(after.filter((v) => !before.includes(v)), `${c.stockKey} q${i + 1}`).toEqual([]);
      });
      expect(setViolations(toRaw(c.payload, c.payload.items)).filter((v) => !/items_fewer_than_4/.test(v)), c.stockKey).toEqual([]);
    }
  });
  it("reading explanations do not cite hidden sentence numbers", () => {
    for (const c of mc.filter((x) => x.payload.el_passage.kind === "reading")) for (const it of c.payload.items) expect(it.explanation_en, c.stockKey).not.toMatch(/\bsentences?\s+\d|\(\d+(?:\s*[-–]\s*\d+)?\)/i);
  });
  it("option length cue is gone: key is the longest option in at most 40% of items", () => {
    let n = 0, longest = 0;
    for (const c of mc) for (const it of c.payload.items) { n++; const ls = it.options.map((o: any) => o.text.length); if (ls[it.key_index] === Math.max(...ls)) longest++; }
    expect(longest / n).toBeLessThan(0.4);
  });
  it("FRQ fixes pass frq gates, keep derived fields in sync, and sample totals add up", () => {
    for (const c of frq) {
      const e: ElFrqPayload = c.payload.el_frq; expect(frqViolations(e), c.stockKey).toEqual([]);
      expect(c.payload.parts[0].model_answer).toBe(e.samples.find((s) => s.tier === "high")!.essay);
      for (const s of e.samples) expect(s.rubric_scores.A + s.rubric_scores.B + s.rubric_scores.C).toBe(s.rubric_scores.total);
      expect(JSON.stringify(c.payload)).not.toMatch(/\d[.,]\s+dollars/);
    }
    for (const c of frq.filter((x) => /fb2|fa2/.test(x.candidateKey))) expect(c.payload.parts[0].prompt).not.toMatch(/Purpose:/);
  });
  it("swap plans parse, reference assigned removeKeys and existing fixed addKeys", () => {
    const fixedKeys = new Set(fixed.map((c) => c.stockKey));
    for (const id of ["el1", "el2"]) {
      const plan = parseSwapPlan(rd(`data/audit/el-review-${id}-v2-swap-plan.json`)); expect(plan.swaps.length).toBeGreaterThan(0);
      const assign = rd<{ sets: { id: string; mcA: string[]; frqA: string[] }[] }>("data/ap/stock/exact-assign-el-el1-el2.json").sets.find((s) => s.id === id.toUpperCase())!;
      for (const sw of plan.swaps) { expect(sw.section === "ap_mc" ? assign.mcA : assign.frqA).toContain(sw.removeKey); expect(fixedKeys.has(sw.addKey)).toBe(true); }
    }
  });
});
