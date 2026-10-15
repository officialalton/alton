import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isEnglishPassage, REAL_TEXT_MARKER } from "../ap-exam/stimulus-display";
import { passageRequiresFigure } from "../problem-figures/check";
import { locate, realAttribution, realDisplay, realHeadnote, realItemViolations, realSet, resolveEvidence, unitOfLine, type RealItemRaw } from "./englit-real";
import type { Registry } from "./englit-sources";

const SRC = path.resolve("data/ap/englit-sources");
const reg = JSON.parse(readFileSync(path.join(SRC, "registry.json"), "utf-8")) as Registry;
const entry = (id: string) => reg.entries.find((e) => e.id === id)!;
const text = (id: string) => readFileSync(path.join(SRC, entry(id).text_file), "utf-8");
const chariot = () => realSet(entry("dickinson-chariot"), text("dickinson-chariot"));
const item = (over: Partial<RealItemRaw> = {}): RealItemRaw => ({
  skill: "4.B", cognitive: "explain", stem: "The speaker's description of Death in the first stanza ([[r1]]) primarily characterizes him as", refs: [{ id: "r1", quote: "He kindly stopped for me" }],
  options: [
    { text: "a courteous escort who treats the journey as a social visit", is_key: true, label: "correct", why: "Death is called kind and shown to know no haste, so he behaves like a polite companion on an outing.", evidence_quote: "He kindly stopped for me", evidence_kind: "text" },
    { text: "a hurried messenger who resents the delay he has met", is_key: false, label: "reversal", why: "The speaker says he knew no haste, the opposite of hurry.", evidence_quote: "he knew no haste", evidence_kind: "text" },
    { text: "a stern judge who has come to hear a confession", is_key: false, label: "wrong_tone", why: "Nothing in the stanza shows judgment; the tone is gracious and calm throughout.", evidence_quote: "For his civility", evidence_kind: "text" },
    { text: "a stranger whom the speaker fears and tries to escape", is_key: false, label: "misread_speaker", why: "The speaker puts away her labor willingly, not as an escape from fear.", evidence_quote: "I had put away", evidence_kind: "text" },
  ], evidence_quotes: ["He kindly stopped for me"], devices_used: ["personification"], est_seconds: 60, ...over });

describe("real-text set building", () => {
  it("keeps the original poem structure: stanzas and one counted line per original line", () => {
    const s = chariot(); expect(s.stanzas.length).toBe(5); expect(s.stanzas.flat().length).toBe(20); expect(s.provenance.kind).toBe("public_domain"); expect(s.group).toBe("poetry");
  });
  it("display carries the public-domain marker (not the ALTON-original one) and the credit", () => {
    const e = entry("dickinson-chariot"); const d = realDisplay(chariot() as never, e);
    expect(d.startsWith(`${REAL_TEXT_MARKER} — Emily Dickinson, The Chariot`)).toBe(true); expect(d.split("\n")[0]).toBe(realAttribution(e)); expect(d.split("\n")[0]).toContain("Poems by Emily Dickinson, ed. Mabel Loomis Todd and T. W. Higginson (Series One, 1890)"); expect(d.split("\n")[0]).not.toContain("Gutenberg"); expect(d).toContain("by Emily Dickinson"); expect(d).toContain("```passage"); expect(d).not.toContain("ALTON original");
    expect(isEnglishPassage(d)).toBe(true); expect(passageRequiresFigure(d)).toBe(false);
  });
  it("headnote states author, year and excerpt status", () => {
    expect(realHeadnote(entry("dickinson-chariot"))).toContain("(1890)"); expect(realHeadnote(entry("chekhov-lady-dog"))).toContain("translated by Constance Garnett"); expect(realHeadnote(entry("chopin-silk-stockings"))).toContain("excerpt");
  });
  it("prose is wrapped by the shared 56-char rule and paragraphs stay paragraphs", () => {
    const s = realSet(entry("chopin-silk-stockings"), text("chopin-silk-stockings")); expect(s.stanzas.length).toBe(7); expect(s.stanzas.flat().every((l) => l.length <= 56)).toBe(true);
  });
});
describe("evidence resolution by code", () => {
  const s = chariot();
  it("maps a quote to original line and stanza", () => { expect(locate(s, "The cornice but a mound")).toMatchObject({ from: 16, to: 16, unit: "stanza 4" }); expect(unitOfLine(s.stanzas, 1)).toBe(1); expect(unitOfLine(s.stanzas, 20)).toBe(5); });
  it("flags a repeated phrase as ambiguous and a missing one as not_found", () => { expect(locate(s, "We passed")).toEqual({ error: "ambiguous" }); expect(locate(s, "totally absent words")).toEqual({ error: "not_found" }); });
  it("accepts a well-formed item and resolves key and distractor evidence", () => {
    expect(realItemViolations(s, item())).toEqual([]); const ev = resolveEvidence(s, item()); expect(ev.key?.ref).toBe("line 2"); expect(ev.distractors.every((d) => d.located)).toBe(true);
  });
  it("rejects a key with no or an invented evidence quote", () => {
    const bad = item(); bad.options[0] = { ...bad.options[0], evidence_quote: "a courteous escort entirely invented" };
    expect(resolveEvidence(s, bad).violations).toContain("key_evidence_not_found"); const none = item(); none.options[0] = { ...none.options[0], evidence_quote: "" }; expect(resolveEvidence(s, none).violations).toContain("key_evidence_missing");
  });
  it("requires at least two distractors with text evidence; absence must carry no quote", () => {
    const a = item(); a.options[1] = { ...a.options[1], evidence_kind: "absence", evidence_quote: "" }; a.options[2] = { ...a.options[2], evidence_kind: "absence", evidence_quote: "" };
    expect(resolveEvidence(s, a).violations).toContain("fewer_than_2_distractors_with_text_evidence");
    const b = item(); b.options[1] = { ...b.options[1], evidence_kind: "absence" }; expect(resolveEvidence(s, b).violations).toContain("distractor_1_absence_with_quote");
  });
  it("still applies the shared item gates (hand-written line numbers, quote not in passage)", () => {
    expect(realItemViolations(s, item({ stem: "In line 3 the speaker primarily characterizes Death as" }))).toContain("hand_written_line_number");
    expect(realItemViolations(s, item({ stem: 'The phrase "swift and angry horseman" primarily characterizes Death as' }))).toEqual(expect.arrayContaining([expect.stringMatching(/^quote_not_in_passage/)]));
  });
});
