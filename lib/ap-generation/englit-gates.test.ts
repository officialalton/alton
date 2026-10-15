import { describe, expect, it } from "vitest";
import { deviceViolations, itemViolations, lengthCueRatio, passagePlain, proseStanzas, resolveItem, setItemSpread, setViolations, similarityViolations, type LtItemRaw, type LtSetRaw } from "./englit-gates";

const POEM: string[][] = [
  ["The ferry leaves before the light is sure of itself,", "its engine clearing a throat in the harbor fog,", "and I, who have carried other people's trunks", "for thirty winters, count the rope coils twice,", "as if the number might change its mind."],
  ["Nobody tells the deckhand where the crossing ends.", "The passengers lean on the rail like tired commas,", "pausing a sentence that has no verb,", "and the water, patient as a cashier,", "takes each coin of daylight and says nothing."],
  ["Once a girl asked me whether the far shore was real.", "I said the far shore is whatever the rope holds.", "She laughed, and her laugh got into the engine,", "and for a mile the whole boat ran on it,", "bright and borrowed, like a small unpaid debt."],
  ["Now the bridge is done. Its cables hum above us", "and the ferry, slow and stubborn, gets its last", "good morning from the gulls. I coil the rope.", "I coil the rope. I coil the rope", "and, being no longer needed, am carefully useful."],
];
const set = (over: Partial<LtSetRaw> = {}): LtSetRaw => ({
  group: "poetry", form: "poem", title: "Last Crossing", provenance: { kind: "original", author_alias: "Ines Calder", year_alias: 1994 },
  blueprint: { speaker: "an aging deckhand", situation: "the last season before a bridge replaces the ferry", central_idea: "usefulness outlasts need", complexity: "pride and grief together", devices: [
    { device: "simile", quote: "like tired commas", function: "passengers" }, { device: "simile", quote: "like a small unpaid debt", function: "laugh" }, { device: "personification", quote: "its engine clearing a throat", function: "engine" },
    { device: "anaphora", quote: "I coil the rope. I coil the rope", function: "repetition" }, { device: "metaphor", quote: "the far shore is whatever the rope holds", function: "answer" }, { device: "enjambment", quote: "I who have carried other people's trunks for thirty winters", function: "flow" }] },
  stanzas: POEM, items: [], ...over,
});
const key = (text: string, why = "It is supported by the quoted line and the whole stanza."): { text: string; is_key: boolean; label: string; why: string } => ({ text, is_key: true, label: "correct", why });
const bad = (text: string, label: string) => ({ text, is_key: false, label, why: "It misreads the line because the speaker never says this in the poem." });
const item = (over: Partial<LtItemRaw> = {}): LtItemRaw => ({ skill: "6.A", cognitive: "explain", stem: "The comparison in ([[r1]]) primarily serves to suggest that the passengers are", options: [key("weary and briefly stalled"), bad("angry and eager to land", "reversal"), bad("busy and quick to talk", "unsupported"), bad("grammatical experts at leisure", "lexical_trap")], refs: [{ id: "r1", quote: "like tired commas" }], evidence_quotes: ["lean on the rail like tired commas"], devices_used: ["simile"], ...over });

describe("englit gates", () => {
  it("accepts a well-formed poem set and resolves line numbers in code", () => {
    const s = set(); expect(setViolations({ ...s, items: Array(8).fill(item()) }).filter((v) => !/^items_/.test(v))).toEqual([]);
    const r = resolveItem(s, item()); expect(r.violations).toEqual([]); expect(r.stem).toContain("(line 7)");
  });
  it("flags hand-written line numbers, bad refs, quotes not in the passage and out-of-range stanzas", () => {
    const s = set();
    expect(itemViolations(s, item({ stem: "In line 7 the comparison primarily serves to suggest that the passengers are" }))).toContain("hand_written_line_number");
    expect(resolveItem(s, item({ refs: [{ id: "r1", quote: "like tired travelers" }] })).violations).toContain("ref_r1_not_found");
    expect(itemViolations(s, item({ stem: 'The phrase "like exhausted pigeons" ([[r1]]) suggests that the passengers are' }))).toContain("quote_not_in_passage_like_exhausted_pigeons");
    expect(itemViolations(s, item({ stem: "The fifth stanza ([[r1]]) mainly shows that the passengers are" }))).toContain("stem_fifth_stanza_out_of_range");
    expect(itemViolations(s, item({ stem: "The paragraph ([[r1]]) mainly shows that the passengers are" }))).toContain("poem_stem_says_paragraph");
    expect(resolveItem(s, item({ stem: "The comparison ([[r1]]) and ([[r2]]) shows" })).violations).toContain("token_r2_has_no_ref");
  });
  it("verifies the form of code-checkable devices", () => {
    const st = POEM;
    expect(deviceViolations({ device: "simile", quote: "like tired commas", function: "" }, st)).toEqual([]);
    expect(deviceViolations({ device: "simile", quote: "the water, patient as a cashier", function: "" }, st)).toEqual([]);
    expect(deviceViolations({ device: "simile", quote: "the far shore is whatever the rope holds", function: "" }, st)).toContain("simile_without_like_as_than");
    expect(deviceViolations({ device: "anaphora", quote: "Nobody tells the deckhand where the crossing ends", function: "" }, st)).toEqual(["anaphora_without_repeated_line_opening"]); // 한 줄만 인용하면 줄 머리 반복이 아님
    expect(deviceViolations({ device: "enjambment", quote: "carried other people's trunks", function: "" }, st)).toEqual([]);
    expect(deviceViolations({ device: "enjambment", quote: "takes each coin of daylight and says nothing.", function: "" }, st)).toContain("enjambment_line_end_is_stopped");
    expect(deviceViolations({ device: "metaphor", quote: "no such words anywhere", function: "" }, st)).toContain("device_quote_not_in_passage_metaphor");
  });
  it("detects the length cue and balances it at set level", () => {
    const long = item({ options: [key("weary and briefly stalled in a long wait at the rail"), bad("angry", "reversal"), bad("busy", "unsupported"), bad("quick", "lexical_trap")] });
    expect(lengthCueRatio(long)).toBeGreaterThan(2); expect(lengthCueRatio(item())).toBeLessThan(1.5);
    expect(setItemSpread(Array(8).fill(long)).join()).toContain("length_cue_in_8_of_8");
    const shortKey = item({ options: [key("weary"), bad("angry and eager to land", "reversal"), bad("busy and quick to talk", "unsupported"), bad("grammatical experts", "lexical_trap")] }); expect(lengthCueRatio(shortKey)).toBe(0);
  });
  it("rejects real authors, AI cliches and prose that is out of bounds; wraps prose into counted lines", () => {
    expect(setViolations(set({ title: "After Emily Dickinson" })).join()).toMatch(/real_author_or_title_emily dickinson/);
    expect(setViolations(set({ stanzas: [["too short"]] })).join()).toMatch(/passage_words_/);
    const para = "She counted the coins twice and then a third time, because the second count had disagreed with the first, and she did not trust either of them. ".repeat(4);
    const prose = proseStanzas([para, para, para, para, para]); expect(prose[0][0].startsWith("    ")).toBe(true);
    expect(passagePlain({ stanzas: prose }).split(/\s+/).length).toBeGreaterThan(300);
  });
  it("flags passages that copy an earlier passage", () => {
    const text = passagePlain({ stanzas: POEM }); expect(similarityViolations(text, [{ id: "a", text }]).length).toBeGreaterThan(0); expect(similarityViolations(text, [{ id: "b", text: "A wholly different text about market stalls and rain." }])).toEqual([]);
  });
});
