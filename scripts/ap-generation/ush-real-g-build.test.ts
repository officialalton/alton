// US3 MC 실제 출처 전환(2026-10-21) 단위 테스트: 14세트 구성(시대·스킬 범주·자료 유형), 레지스트리·게이트, 정책(실제 표지만 · 합성 표지 금지 · US1·US2 자료 재사용 금지).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { ushSkillCat, ushUnitOfTopic } from "../../lib/ap-exam/ush-rules";
import { MC_SETS_G } from "./ush-real-g-content";
import { buildDraft, gates, reg, registry } from "./ush-real-g-build";

const OLD: Record<string, { period: number; stim: string; units: string[]; cats: string[]; size: number }> = {
  u201: { period: 2, stim: "secondary_text", units: ["2", "2", "2"], cats: ["3", "4", "1"], size: 3 },
  u309: { period: 3, stim: "primary_text", units: ["3", "3", "3", "4"], cats: ["2", "3", "4", "5"], size: 4 },
  u310: { period: 3, stim: "secondary_text", units: ["3", "3", "3", "3"], cats: ["3", "3", "4", "5"], size: 4 },
  u420: { period: 4, stim: "primary_text", units: ["4", "4", "4", "4"], cats: ["2", "3", "4", "1"], size: 4 },
  u422: { period: 4, stim: "paired_text", units: ["4", "4", "4"], cats: ["3", "3", "4"], size: 3 },
  u529: { period: 5, stim: "secondary_text", units: ["5", "5", "5", "6"], cats: ["3", "3", "4", "5"], size: 4 },
  u509: { period: 5, stim: "secondary_text", units: ["5", "5", "6"], cats: ["3", "4", "5"], size: 3 },
  u634: { period: 6, stim: "primary_text", units: ["6", "6", "6"], cats: ["2", "3", "5"], size: 3 },
  u612: { period: 6, stim: "quantitative", units: ["6", "6", "6", "7"], cats: ["1", "3", "4", "5"], size: 4 },
  u742: { period: 7, stim: "primary_text", units: ["7", "7", "7", "7"], cats: ["2", "3", "4", "1"], size: 4 },
  u718: { period: 7, stim: "quantitative", units: ["7", "7", "8", "7"], cats: ["1", "3", "4", "5"], size: 4 },
  u849: { period: 8, stim: "secondary_text", units: ["8", "8", "8"], cats: ["3", "4", "5"], size: 3 },
  u851: { period: 8, stim: "secondary_text", units: ["8", "8", "8", "8"], cats: ["3", "3", "4", "1"], size: 4 },
  u960: { period: 9, stim: "primary_text", units: ["9", "9", "9", "9"], cats: ["2", "3", "4", "1"], size: 4 },
};

describe("US3 real-source MC (Stage G)", () => {
  it("registry (including the new sources) has no violations", () => { expect(registryViolations(registry as RegistrySource[])).toEqual([]); });
  it("14 sets replace the 14 ALTON-composed sets one for one: same period, item count, topic units and skill categories", () => {
    expect(MC_SETS_G.length).toBe(14);
    for (const m of MC_SETS_G) {
      const old = OLD[m.slot.replace("US3 ", "")]; expect(old, m.slot).toBeTruthy();
      expect(m.period, m.slot).toBe(old.period); expect(m.items.length, m.slot).toBe(old.size);
      expect(m.items.map((i) => ushUnitOfTopic(i.topic)), m.slot).toEqual(old.units); expect(m.items.map((i) => ushSkillCat(i.skill)), m.slot).toEqual(old.cats);
    }
  });
  it("source-type minimums still hold across the exam (with the one real set Harriot): primary >= 5, secondary >= 2, paired >= 1, quantitative >= 1", () => {
    const count = (t: string) => MC_SETS_G.filter((m) => m.stim === t).length + (t === "primary_text" ? 1 : 0);
    expect(count("primary_text")).toBeGreaterThanOrEqual(5); expect(count("secondary_text")).toBeGreaterThanOrEqual(2); expect(count("paired_text")).toBeGreaterThanOrEqual(1); expect(count("quantitative")).toBeGreaterThanOrEqual(1);
    expect(MC_SETS_G.reduce((a, m) => a + m.items.length, 0) + 4).toBe(55);
  });
  it("draft records pass every gate and are real-source records", () => {
    for (const r of buildDraft()) {
      expect(gates(r), r.cellId).toEqual([]); expect(r.stimulusOrigin).toBe("real_historical_source"); expect(r.payload.set_intro).toMatch(/^Historical source \(real document\)\n/); expect(r.payload.set_intro).not.toMatch(/ALTON-composed/);
      for (const id of r.sourceRegistryIds as string[]) { const s = reg.get(id)!; expect(s.reuse_basis, id).toMatch(/public domain/); expect(s.rights_statement.length, id).toBeGreaterThan(30); }
    }
  });
  it("US1/US2 real sources and the US3 FRQ sources are not reused by the US3 MC sets", () => {
    const used = new Set(buildDraft().flatMap((r) => r.sourceRegistryIds as string[]));
    const banned = ["txt-jackson-veto-1832", "txt-robinson-1898", "txt-tocqueville-1840", "img-lowell-1840", "txt-thoreau-1854", "stat-region-pop-1800-1860", "map-slave-pop-1861", "txt-sumner-1883", "txt-ica-1887", "img-bosses-senate-1889", "txt-sherman-1890", "txt-tarbell-1904", "img-next-1904", "txt-jungle-1906", "stat-homeownership-1900-1980", "stat-plains-state-pop-1870-1900", "stat-black-pop-region-1900-1940", "stat-foreign-born-1850-1940", "txt-emancipation-1863", "txt-monroe-1823", "txt-fugitive-slave-act-1850", "txt-jones-diary-1863", "map-reynolds-1856", "img-school-begins-1899", "map-indian-reservations-1892",
      "txt-penn-privileges-1701", "txt-dunning-1907", "txt-dubois-1910", "txt-eo9835-1947", "txt-smith-1950", "txt-survival-1950", "txt-ndea-1958", "txt-eisenhower-1961", "stat-defense-outlays-1946-1962", "img-mrbm-san-cristobal-1962", "img-migrant-mother-1936"];
    for (const b of banned) expect(used.has(b), b).toBe(false);
  });
  it("stock file exists once the final stage has run and holds all 14 sets", () => {
    expect(existsSync("data/ap/stock/ush-real-g-items.json")).toBe(true);
    expect((JSON.parse(readFileSync("data/ap/stock/ush-real-g-items.json", "utf-8")) as unknown[]).length).toBe(14);
  });
});
