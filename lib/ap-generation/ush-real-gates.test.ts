import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { realSetViolations, registryViolations, sha256, type RegistrySource } from "./ush-real-gates";
const reg = JSON.parse(readFileSync("data/ap/ush-sources/registry.json", "utf-8")).sources as RegistrySource[];
const map = new Map(reg.map((s) => [s.id, s]));
const mc = JSON.parse(readFileSync("data/ap/ush-sources/sample-mc.json", "utf-8")) as { payload: Record<string, unknown> }[];
describe("ush real-source registry", () => {
  it("has the required sample coverage and no violations", () => {
    expect(registryViolations(reg)).toEqual([]);
    const n = (t: string) => reg.filter((s) => s.type === t).length;
    expect(n("primary_text")).toBeGreaterThanOrEqual(4); expect(n("statistic_table")).toBeGreaterThanOrEqual(2); expect(n("map")).toBeGreaterThanOrEqual(2); expect(n("political_cartoon") + n("photograph")).toBeGreaterThanOrEqual(2);
  });
  it("detects a tampered excerpt", () => {
    const bad = reg.map((s) => (s.id === "txt-truman-1947" ? { ...s, excerpt_segments: ["changed"] } : s));
    expect(registryViolations(bad)).toContain("txt-truman-1947:excerpt_hash_mismatch");
    expect(sha256("a")).toHaveLength(64);
  });
});
describe("ush real-source sample sets", () => {
  for (const c of mc) it(`passes the real-source gates: ${String(c.payload.archetype)}`, () => { expect(realSetViolations(c.payload, map)).toEqual([]); });
  it("rejects a set that alters the table or is marked ALTON-composed", () => {
    const p = JSON.parse(JSON.stringify(mc[1].payload)); p.stimulus.data.rows[0][2] = "1"; p.set_intro = "ALTON-composed stimulus\n" + p.set_intro;
    const v = realSetViolations(p, map); expect(v).toContain("stat-foreign-born-region-1900-1990:table_differs_from_registry"); expect(v).toContain("real_set_marked_alton_composed");
  });
});
