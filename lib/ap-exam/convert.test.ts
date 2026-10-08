import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planConversion } from "./convert";
import { AP_LAYOUTS, sectionsForLabel, totalMinutes } from "./layouts";
import type { ApCandidateLike } from "../ap-figures/gate";

const items = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as (ApCandidateLike & { validation: string })[];

describe("planConversion on current stock", () => {
  it("every auto_passed candidate converts (gate passes, English explanation, valid key)", () => {
    const bad: string[] = [];
    for (const c of items.filter((i) => i.validation === "auto_passed")) {
      const p = planConversion(c);
      if (!p.ok) { bad.push(`${c.candidateKey}: ${p.reason}`); continue; }
      for (const it of p.items) {
        if (it.format === "mc" && (it.correctIndex === null || it.correctIndex >= (it.options?.length ?? 0))) bad.push(`${c.candidateKey}: bad key`);
        if (/[ㄱ-ㆎ가-힣]/.test([it.passage, it.question, ...(it.options ?? [])].join(" "))) bad.push(`${c.candidateKey}: hangul`);
        if (it.figure && !(it.renderCheck as { ok: boolean }).ok) bad.push(`${c.candidateKey}: render_check not ok`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("FRQ conversion keeps parts and labels the reference as unofficial", () => {
    const f = items.find((i) => i.kind === "frq_bundle" && i.validation === "auto_passed")!;
    const p = planConversion(f);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.items[0].format).toBe("essay");
      expect((p.items[0].statements as unknown[]).length).toBeGreaterThan(0);
      expect(p.items[0].explanationEn).toContain("not official");
    }
  });
});

describe("layouts", () => {
  it("official structure and label rules", () => {
    expect(AP_LAYOUTS.ap_calculus_ab.reduce((a, s) => a + (s.kind === "mc" ? s.count : 0), 0)).toBe(42);
    expect(sectionsForLabel("ap_calculus_ab", "mc_practice").map((s) => s.key)).toEqual(["ap_mc_a", "ap_mc_b"]);
    expect(totalMinutes("ap_calculus_ab", "mc_practice")).toBe(100);
    expect(AP_LAYOUTS.ap_microeconomics[0].options).toBe(5);
  });
});
