// US3 실제 출처 전환(2026-10-21) 단위 테스트: 레지스트리·SAQ/DBQ/LEQ 레코드 게이트, 자료 훼손 탐지, 정책(합성 자료에 실제 표지 금지 · 실제 자료에 ALTON 작성 표지 금지).
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { realSaqViolations } from "../../lib/ap-generation/ush-real-saq";
import { frqViolations, type UshFrqPayload } from "../../lib/ap-generation/ushistory-frq";
import { SAQS_F, COLD_WAR } from "./ush-real-f-content";
import { draft, gates, reg, registry, saqRecord } from "./ush-real-f-build";

describe("US3 real-source FRQ (Stage F)", () => {
  it("registry (including the new sources) has no violations", () => { expect(registryViolations(registry as RegistrySource[])).toEqual([]); });
  it("every new source carries a rights basis and an allowed repository", () => {
    for (const id of ["txt-penn-privileges-1701", "txt-dunning-1907", "txt-dubois-1910", "txt-eo9835-1947", "txt-smith-1950", "txt-survival-1950", "txt-ndea-1958", "txt-eisenhower-1961", "stat-defense-outlays-1946-1962", "img-mrbm-san-cristobal-1962"]) {
      const s = reg.get(id)!; expect(s, id).toBeTruthy(); expect(s.rights_statement.length).toBeGreaterThan(30); expect(s.reuse_basis).toMatch(/public domain/); expect(s.origin).toBe("real_historical_source");
    }
  });
  it("draft records pass every gate with zero violations", () => { for (const r of draft()) expect(gates(r), r.cellId).toEqual([]); });
  it("the SAQ1/SAQ2/SAQ3/DBQ records are real-source records, the LEQ is prompt-only", () => {
    for (const r of draft()) {
      if (r.cellId.endsWith("leq")) { expect(r.sourceRegistryIds).toEqual([]); expect(r.payload.ush_frq.provenance.note).not.toMatch(/fictional/i); expect(r.payload.ush_frq.provenance.note).toMatch(/prompt only/i); continue; }
      expect(r.stimulusOrigin).toBe("real_historical_source"); expect(r.payload.set_intro).toMatch(/^Historical source \(real document\)\n/); expect(r.payload.set_intro).not.toMatch(/ALTON-composed/); expect(r.sourceRegistryIds.length).toBeGreaterThan(0);
    }
  });
  it("US1/US2 real sources are not reused by US3 FRQ", () => {
    const used = new Set(draft().flatMap((r) => r.sourceRegistryIds as string[]));
    for (const banned of ["txt-jackson-veto-1832", "txt-robinson-1898", "txt-tocqueville-1840", "img-lowell-1840", "txt-thoreau-1854", "stat-region-pop-1800-1860", "map-slave-pop-1861", "txt-sumner-1883", "txt-ica-1887", "img-bosses-senate-1889", "txt-sherman-1890", "txt-tarbell-1904", "img-next-1904", "txt-jungle-1906", "stat-homeownership-1900-1980", "stat-plains-state-pop-1870-1900"]) expect(used.has(banned), banned).toBe(false);
  });
  it("detects a tampered excerpt, a swapped source order and an ALTON-composed mark", () => {
    const q = SAQS_F[0]; const rec = saqRecord(q); const order = q.order;
    expect(realSaqViolations(rec.payload, reg, order)).toEqual([]);
    const bad = JSON.parse(JSON.stringify(rec.payload)); bad.set_intro = bad.set_intro.replace("a general guardianship", "a limited guardianship");
    expect(realSaqViolations(bad, reg, order).join()).toMatch(/set_intro_differs_from_generated_passage|excerpt_not_verbatim/);
    const swapped = JSON.parse(JSON.stringify(rec.payload)); swapped.ush_frq.sources.reverse();
    expect(realSaqViolations(swapped, reg, order).join()).toMatch(/order_differs/);
    const marked = JSON.parse(JSON.stringify(rec.payload)); marked.set_intro += "\nALTON-composed stimulus";
    expect(realSaqViolations(marked, reg, order).join()).toMatch(/real_set_marked_alton_composed/);
  });
  it("the DBQ keeps seven distinct documents, one image, one table, and every document supports a line of reasoning", () => {
    const d = draft().find((r) => r.cellId.includes("dbq"))!; const u = d.payload.ush_frq as UshFrqPayload;
    expect(u.sources.length).toBe(7); expect(new Set(u.sources.map((s) => s.source_registry_id)).size).toBe(7);
    expect(u.sources.filter((s) => s.kind === "image").length).toBe(1); expect(u.sources.filter((s) => s.kind === "table").length).toBe(1);
    expect(new Set(COLD_WAR.evidence_map.flatMap((l) => l.supports)).size).toBe(7);
  });
  it("SAQ3 accepts a photograph as its non-text source (gate widened) but still rejects a text source", () => {
    const rec = saqRecord(SAQS_F[2]); const u = rec.payload.ush_frq as UshFrqPayload;
    expect(frqViolations(u).filter((v) => /saq3_needs/.test(v))).toEqual([]);
    const textual = { ...u, sources: [{ ...u.sources[0], kind: "primary_text" as const }] } as UshFrqPayload;
    expect(frqViolations(textual).join()).toMatch(/saq3_needs_non_text_source/);
  });
  it("stock file exists once the final stage has run", () => { expect(existsSync("data/ap/stock/ush-real-f-items.json")).toBe(true); });
});
