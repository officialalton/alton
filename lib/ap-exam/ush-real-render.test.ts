import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { planConversion } from "./convert";
import { apPassageForDisplay } from "./stimulus-display";
const mc = JSON.parse(readFileSync("data/ap/ush-sources/sample-mc.json", "utf-8")) as { candidateKey: string; apSubjectCode: string; kind: string; payload: Record<string, unknown> }[];
const frq = JSON.parse(readFileSync("data/ap/ush-sources/sample-frq.json", "utf-8")) as typeof mc;
describe("real-source sample items convert and render", () => {
  for (const c of [...mc, ...frq]) it(`gate + conversion: ${c.candidateKey}`, () => {
    const g = gateCandidate(c as never); expect(g.issues.filter((i) => i.level === "error")).toEqual([]);
    const plan = planConversion(c as never); expect(plan.ok).toBe(true);
    if (plan.ok) { expect(plan.items.length).toBeGreaterThan(0); expect(plan.items[0].passage).toMatch(/^Historical source \(real document\)/); expect(apPassageForDisplay(plan.items[0].passage, plan.items[0].question)).toBe(plan.items[0].passage); }
  });
  it("image sets carry a static image figure with a visible credit", () => {
    const g = gateCandidate(mc[2] as never); expect(g.spec).toMatchObject({ type: "image", bucket: "static", path: "ap-sources/map-reynolds-1856/image.jpg" }); expect((g.spec as unknown as { credit: string }).credit).toMatch(/Library of Congress/);
    const f = gateCandidate(frq[0] as never); expect(f.spec).toMatchObject({ type: "image", bucket: "static" });
  });
});
