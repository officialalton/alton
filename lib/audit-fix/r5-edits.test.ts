// 라운드 5 패치 테스트(순수, 저장된 읽기 스냅샷 data/audit/2026-10-14-r5-readout.json 사용).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planPatch, type Overrides, type Patch, type ProblemReadout } from "./plan";
import { buildPatch } from "./r2-edits";
import { EDITS5 } from "./r5-edits";
import { isDeletionOnly, wordCount } from "./trim-check";

const ro = JSON.parse(readFileSync("data/audit/2026-10-14-r5-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const patches = (JSON.parse(readFileSync("data/audit/2026-10-14-r5-patches.json", "utf-8")) as { patches: Patch[] }).patches;
const overrides = JSON.parse(readFileSync("data/audit/2026-10-14-r5-overrides.json", "utf-8")) as Overrides;
const byId = new Map(ro.problems.map((p) => [p.problem_id, p]));
const trims = patches.filter((p) => p.id.startsWith("R5-TRIM-"));

describe("round 5 patch list", () => {
  it("has unique ids and the edit patches equal what the edit functions produce now", () => {
    expect(new Set(patches.map((p) => p.id)).size).toBe(patches.length);
    for (const def of EDITS5) {
      const pr = byId.get(def.problemId!)!;
      expect(buildPatch(def, pr.pub!, pr.pub!.id).patch.changes, def.id).toEqual(patches.find((p) => p.id === def.id)!.changes);
    }
  });
  it("every patch plans as 'apply' against the stored current published versions", () => {
    for (const p of patches) {
      const plan = planPatch(p, byId.get(p.problemId!)!, { overrides, now: "2026-10-14T00:00:00.000Z" });
      expect(plan.status, `${p.id}: ${plan.reasons.join(" | ")}`).toBe("apply");
      const o = plan.args!.options;
      if (o) expect(new Set(o.map((x) => x.trim().toLowerCase())).size, p.id).toBe(o.length);
    }
  });
  it("grammar edits keep the key text and leave exactly the intended option changed", () => {
    for (const def of EDITS5.filter((d) => d.id.startsWith("R5-G-"))) {
      const pr = byId.get(def.problemId!)!; const cur = pr.pub!; const out = def.edit({ passage: cur.passage, question: cur.question, options: cur.options, correct_index: cur.correct_index, explanation: cur.explanation, explanation_en: cur.explanation_en, figure: cur.figure });
      const after = out.options ?? cur.options!;
      expect(after[cur.correct_index!], def.id).toBe(cur.options![cur.correct_index!]);
      const L = "ABCD"[cur.correct_index!];
      expect(out.explanation_en, def.id).toContain(`the answer is ${L}`);
      expect(out.explanation, def.id).toContain(`정답은 ${L}이다`);
    }
  });
  it("trim patches are deletion-only, shorter, and at most 150 words", () => {
    expect(trims.length).toBeGreaterThan(0);
    for (const p of trims) {
      const c = p.changes[0];
      expect(c.field).toBe("passage");
      expect(isDeletionOnly(String(c.old), String(c.new)), p.id).toBe(true);
      expect(wordCount(String(c.new)), p.id).toBeLessThanOrEqual(150);
      expect(wordCount(String(c.new)), p.id).toBeLessThan(wordCount(String(c.old)));
    }
  });
  it("the three figure-text edits do not touch the key or options", () => {
    for (const id of ["R5-F-S06", "R5-F-S07", "R5-F-M17"]) {
      const p = patches.find((x) => x.id === id)!;
      expect(p.changes.some((c) => c.field === "options" || c.field === "correct_index"), id).toBe(false);
    }
  });
});
