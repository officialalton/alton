import { describe, expect, it } from "vitest";
import { checkTrim, isDeletionOnly, quotedSpansLost, structureKept, wordCount } from "./trim-check";

const old = "Text 1\nThe river rose slowly. Engineers feared the dam would fail, so they opened the gates. Farmers downstream lost nothing.\n\nText 2\nA flood is rarely a surprise; ______ records show repeated warnings over decades of rainfall.";
describe("trim-check", () => {
  it("counts words by whitespace", () => { expect(wordCount(" a  b\nc ")).toBe(3); expect(wordCount(null)).toBe(0); });
  it("accepts pure deletions, rejects additions and reordering", () => {
    expect(isDeletionOnly(old, old.replace(" Engineers feared the dam would fail, so they opened the gates.", ""))).toBe(true);
    expect(isDeletionOnly("a b c", "a x c")).toBe(false);
    expect(isDeletionOnly("a b c", "c a")).toBe(false);
    expect(isDeletionOnly("The dam, however, held.", "The dam held.")).toBe(true);
  });
  it("keeps blanks and Text labels", () => {
    expect(structureKept(old, old.replace("______ ", ""))).toContain("빈칸 개수가 바뀜");
    expect(structureKept(old, old.replace("Text 2\n", ""))).toContain("Text 2 표지가 사라짐/생김");
    expect(structureKept(old, old)).toEqual([]);
  });
  it("flags deleted quoted evidence", () => {
    const next = old.replace(" Engineers feared the dam would fail, so they opened the gates.", "");
    expect(quotedSpansLost(old, next, 'The text says "Engineers feared the dam would fail, so they opened the gates."')).toHaveLength(1);
    expect(quotedSpansLost(old, next, 'The text says "Farmers downstream lost nothing."')).toHaveLength(0);
  });
  it("checkTrim combines the rules", () => {
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ") + ".";
    const short = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ") + ".";
    expect(checkTrim(long, { decision: "trim", new_passage: short, reason: "x" }, { target: 50, refs: [] }).ok).toBe(true);
    expect(checkTrim(long, { decision: "trim", new_passage: short + " extra", reason: "x" }, { target: 50, refs: [] }).ok).toBe(false);
    expect(checkTrim(long, { decision: "keep", reason: "x" }, { target: 50, refs: [] }).ok).toBe(false);
    expect(checkTrim(long, { decision: "trim", new_passage: long, reason: "x" }, { target: 50, refs: [] }).issues).toContain("줄어들지 않음");
  });
});
