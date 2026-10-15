import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { frqViolations, type LtFrqPayload } from "./englit-frq";
import { locate, realSet } from "./englit-real";
import type { Registry } from "./englit-sources";

// 2026-10-15 source-first 샘플(DB 미적재) 일관성: 지문은 등록부 텍스트와 동일, 근거 위치는 코드 계산값과 일치, 검증 필드가 모든 문항에 있다.
const SRC = path.resolve("data/ap/englit-sources");
const reg = JSON.parse(readFileSync(path.join(SRC, "registry.json"), "utf-8")) as Registry;
const mc = JSON.parse(readFileSync(path.join(SRC, "sample/real-sample-items.json"), "utf-8")) as { cellId: string; reviewState: string; releaseTier: string; sourceKind: string; payload: any }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
const frq = JSON.parse(readFileSync(path.join(SRC, "sample/real-sample-frq.json"), "utf-8")) as { cellId: string; reviewState: string; releaseTier: string; payload: any }[]; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("real-text sample candidates (not loaded anywhere)", () => {
  it("is marked as an unloaded real-text sample, never as a stock release", () => {
    for (const c of [...mc, ...frq]) expect(c.releaseTier).toBe("sample_not_loaded");
    expect(mc.every((c) => c.sourceKind === "real_public_domain")).toBe(true);
  });
  it("shows the registry text verbatim and records provenance with the stored-text hash", () => {
    for (const c of mc.filter((x) => x.reviewState === "auto_passed")) {
      const e = reg.entries.find((x) => x.id === c.payload.provenance.registry_id)!; expect(e).toBeTruthy();
      const set = realSet(e, readFileSync(path.join(SRC, e.text_file), "utf-8")); expect(c.payload.lt_passage.stanzas).toEqual(set.stanzas); expect(c.payload.provenance.text_sha256).toBe(e.text_sha256);
      expect(c.payload.set_intro.startsWith("Public-domain source text\n")).toBe(true); expect(c.payload.provenance.kind).toBe("public_domain");
    }
  });
  it("every item carries code-resolved key evidence, distractor evidence and a verification record", () => {
    for (const c of mc.filter((x) => x.reviewState === "auto_passed")) {
      const e = reg.entries.find((x) => x.id === c.payload.provenance.registry_id)!; const set = realSet(e, readFileSync(path.join(SRC, e.text_file), "utf-8"));
      expect(c.payload.items.length).toBeGreaterThanOrEqual(8);
      for (const it of c.payload.items) {
        const rt = it.real_text; const re = locate(set, rt.key_evidence.quote); expect("error" in re).toBe(false); expect(re).toMatchObject({ from: rt.key_evidence.from, to: rt.key_evidence.to });
        expect(rt.distractor_evidence).toHaveLength(3); expect(rt.distractor_evidence.filter((d: { evidence_kind: string }) => d.evidence_kind === "text").length).toBeGreaterThanOrEqual(2);
        expect(rt.verification).toMatchObject({ verified: true, panel_agree: true }); expect(rt.verification.solver_votes).toEqual([it.key_index, it.key_index]);
        expect(it.stem).not.toMatch(/\[\[|\blines? \d+ ?\[\[/); expect(it.options).toHaveLength(4);
      }
    }
  });
  it("FRQ samples pass the shared gate in real-text mode, with three graded essays whose two graders agree within 2 points", () => {
    for (const c of frq) { expect(c.reviewState).toBe("auto_passed"); const p = c.payload.lit_frq as LtFrqPayload; expect(frqViolations(p, [], { realText: true })).toEqual([]); expect(p.samples.map((s) => s.tier)).toEqual(["high", "mid", "low"]);
      for (const a of c.payload.real_text.grader_audit) { const chosen = a.options.find((o: { k: number }) => o.k === a.chosen); expect(chosen.spread).toBeLessThanOrEqual(2); expect(chosen.graderTotals).toHaveLength(2); } }
  });
});
