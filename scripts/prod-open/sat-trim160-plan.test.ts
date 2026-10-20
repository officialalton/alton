import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const plan = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/audit/sat-trim160-plan-20261019.json"), "utf8")) as { items: { gid: string; words_before: number; words_after: number; passage_old: string; passage_new: string; problems: string[] }[] };
const words = (s: string) => s.split(/\s+/).map((w) => w.replace(/[.,;:!?"()]+/g, "")).filter(Boolean);

describe("SAT lit25 160-word trim plan", () => {
  it("covers the 10 over-160 passages, deletion-only, every result <= 160 words with no open problems", () => {
    expect(plan.items).toHaveLength(10);
    for (const i of plan.items) {
      expect(i.problems).toEqual([]);
      expect(i.words_before).toBeGreaterThan(160);
      expect(i.words_after).toBeLessThanOrEqual(160);
      const a = words(i.passage_new), b = words(i.passage_old);
      let j = 0; for (const w of a) { while (j < b.length && b[j] !== w) j++; expect(j).toBeLessThan(b.length); j++; }
      expect(i.passage_new.split("\n\n").length).toBe(i.passage_old.split("\n\n").length);
    }
  });
});
