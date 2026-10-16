import { describe, expect, it } from "vitest";
import { validatePassages, type LiteraryPassage } from "./schema";

const text = (seed: string) => Array.from({ length: 90 }, (_, i) => `${seed}${i % 7 === 0 ? "ward" : ""}w${i}`).join(" ");
const good = (n: number): LiteraryPassage => ({
  id: `lit-test-batch-${String(n).padStart(3, "0")}`, batchId: "lit-test-batch", origin: "original_ai",
  producer: { model: "gpt-test", date: "2026-10-01" }, genre: "short_story", styleEra: "contemporary", pov: "first",
  topicSeed: `harbor town sisters quarrel over inheritance number ${n}`, text: text(`alpha${n}x`),
  features: { tone: ["wistful"], devices: ["metaphor"], inferenceTargets: ["tone_or_mood"] }, intendedDifficulty: "hard",
  declaration: { original: true, noRealWorkQuoted: true, noCopyrightedSource: true },
});

describe("문학 지문 규격 검증", () => {
  it("올바른 지문은 통과한다", () => {
    expect(validatePassages([good(1), good(2)])).toMatchObject({ ok: 2, issues: [] });
  });
  it("origin·선언·길이·한글·마크업·유사 중복을 거절한다", () => {
    const a = { ...good(1), origin: "real_excerpt" } as unknown;
    const b = { ...good(2), declaration: { original: true, noRealWorkQuoted: false, noCopyrightedSource: true } } as unknown;
    const c = { ...good(3), text: "너무 짧은 한글" } as unknown;
    const d = { ...good(4), text: `${text("delta")} <parameter name="x">` } as unknown;
    const e1 = good(5);
    const e2 = { ...good(6), text: e1.text, topicSeed: "different seed about a lighthouse keeper and a stranger" };
    const r = validatePassages([a, b, c, d, e1, e2]);
    const fields = r.issues.map((x) => `${x.id}:${x.field}`);
    expect(fields).toEqual(expect.arrayContaining(["lit-test-batch-001:origin", "lit-test-batch-002:declaration", "lit-test-batch-003:text", "lit-test-batch-004:text", "lit-test-batch-006:text"]));
    expect(r.ok).toBe(1);
  });
  it("같은 id·같은 소재는 같은 배치에서 거절한다", () => {
    const r = validatePassages([good(1), { ...good(1), text: text("beta") }]);
    expect(r.issues.some((x) => x.field === "id")).toBe(true);
    const s = validatePassages([good(7), { ...good(8), topicSeed: good(7).topicSeed, text: text("gamma") }]);
    expect(s.issues.some((x) => x.field === "topicSeed")).toBe(true);
  });
});
