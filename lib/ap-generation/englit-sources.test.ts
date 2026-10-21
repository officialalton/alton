import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractDrama, extractParagraphs, extractPoem, parseStoredText, sha256, stripUnderscoreItalics, validateEntry, type Registry } from "./englit-sources";

const SRC = path.resolve("data/ap/englit-sources");
const reg = JSON.parse(readFileSync(path.join(SRC, "registry.json"), "utf-8")) as Registry;

describe("englit source registry", () => {
  it("has >= 4 poems and >= 3 prose/drama excerpts, every entry valid (sha256, count, PD basis, authorized repository)", () => {
    expect(reg.entries.filter((e) => e.form === "poem").length).toBeGreaterThanOrEqual(4);
    expect(reg.entries.filter((e) => e.form !== "poem").length).toBeGreaterThanOrEqual(3);
    for (const e of reg.entries) expect(validateEntry(e, readFileSync(path.join(SRC, e.text_file), "utf-8")), e.id).toEqual([]);
  });
  it("detects a tampered text", () => {
    const e = reg.entries[0]; const t = readFileSync(path.join(SRC, e.text_file), "utf-8");
    expect(validateEntry(e, t.replace("Death", "Dearth"))).toContain("text_sha256_mismatch");
  });
  it("rejects works published after 1928 and unauthorized repositories", () => {
    const e = reg.entries[0]; const t = readFileSync(path.join(SRC, e.text_file), "utf-8");
    expect(validateEntry({ ...e, year_first_published: 1934 }, t)).toContain("published_after_1928_needs_explicit_pd_statement");
    expect(validateEntry({ ...e, url: "https://example.com/x" }, t)).toContain("url_not_authorized_repository");
  });
  it("records every modification and a raw-file hash", () => { for (const e of reg.entries) { expect(e.raw_sha256).toMatch(/^[0-9a-f]{64}$/); expect(e.modifications.length).toBeGreaterThan(0); expect(["2026-10-15", "2026-10-19"]).toContain(e.retrieved); } });
});

describe("extractors", () => {
  const raw = ["", "  A long line that the", "      repository wrapped here,", "  next line,", "", "  second stanza", "      indented refrain", ""];
  it("rejoins run-over lines and keeps stanza breaks", () => {
    const { stanzas, merged } = extractPoem(raw, 2, 7, [3]);
    expect(stanzas).toEqual([["A long line that the repository wrapped here,", "next line,"], ["second stanza", "indented refrain"]]); expect(merged).toBe(1);
  });
  it("keeps relative indentation when asked", () => { expect(extractPoem(raw, 5, 7, [], true).stanzas).toEqual([["second stanza", "    indented refrain"]]); });
  it("rejects a run-over with no previous line", () => { expect(() => extractPoem(raw, 3, 3, [3])).toThrow(); });
  it("joins hard-wrapped prose and drama speeches", () => {
    expect(extractParagraphs(["a b", "c d", "", "e f"], 1, 4)).toEqual(["a b c d", "e f"]);
    expect(extractDrama(["NORA.", "_[aside]_. Hello", "there.", "", "HELMER.", "What?"], 1, 6).map(stripUnderscoreItalics)).toEqual(["NORA. [aside]. Hello there.", "HELMER. What?"]);
  });
  it("round-trips stored text", () => { expect(parseStoredText("a\nb\n\nc\n", "poem")).toEqual([["a", "b"], ["c"]]); expect(parseStoredText("a b\n\nc d\n", "prose")).toEqual([["a b"], ["c d"]]); expect(sha256("x")).toHaveLength(64); });
});
