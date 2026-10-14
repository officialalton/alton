import { describe, expect, it } from "vitest";
import { balancedKeyPositions, itemViolations, keyConfidence, keyPositionViolations, passageDisplay, placeKey, quoteInPassage, setItemSpread, setViolations, similarityViolations, textHazards, type ElItemRaw, type ElSetRaw } from "./englang-gates";

const para = [
  ["The harbor library opened in 1931 with eleven hundred books and one stubborn stove.", "Mara Ellison, who ran it for forty years, believed a town reads best when it is warm.", "She was not sentimental about it."],
  ["By the time the stove failed, the shelves had doubled, and so had the complaints about the noise of children.", "Ellison answered every complaint the same way: with a chair.", "Sit, she told the grumblers, and listen to what you are afraid of losing."],
];
const mkOpt = (text: string, key: boolean, label: string, why: string) => ({ text, is_key: key, label, why });
const goodItem = (over: Partial<ElItemRaw> = {}): ElItemRaw => ({
  skill: "7.A", topic: "U5.4", cognitive: "explain", stem: 'In paragraph 2, the phrase "with a chair" primarily serves to',
  options: [mkOpt("show that Ellison met complaints with a quiet, practical gesture", true, "correct", "The sentence contrasts words with a physical invitation to sit."), mkOpt("suggest that Ellison ignored the complaints entirely", false, "reversal", "She answers each complaint, so she did not ignore them at all."), mkOpt("argue that libraries need more furniture", false, "unsupported", "The passage never discusses furniture budgets."), mkOpt("mock the grumblers for being afraid", false, "wrong_function", "The tone is invitational rather than mocking toward the grumblers.")],
  evidence_sentence_ids: [5], ...over,
});
const set: ElSetRaw = { kind: "reading", blueprint: { devices: [{ device: "irony", sentence_ids: [5], function: "contrast" }] }, provenance: { kind: "original", author_alias: "A. Test", year_alias: 1999 }, title: "The Warm Room", paragraphs: para, items: [goodItem()] };

describe("englang item gates", () => {
  it("a well formed reading item has no violations", () => { expect(itemViolations(set, goodItem())).toEqual([]); });
  it("quoted text must be verbatim in the passage", () => {
    expect(itemViolations(set, goodItem({ stem: 'In paragraph 2, the phrase "with a stool" primarily serves to' })).some((x) => x.startsWith("quote_not_in_passage"))).toBe(true);
    expect(quoteInPassage("answered every complaint ... with a chair", "Ellison answered every complaint the same way: with a chair.")).toBe(true);
  });
  it("paragraph numbers and sentence numbers are validated", () => {
    expect(itemViolations(set, goodItem({ stem: "In paragraph 9, the writer most likely wants to" }))).toContain("stem_paragraph_9_out_of_range");
    expect(itemViolations(set, goodItem({ stem: "In sentence 3, the writer most likely wants to" }))).toContain("reading_stem_numbers_sentences_or_lines");
    expect(itemViolations(set, goodItem({ evidence_sentence_ids: [99] }))).toContain("evidence_sentence_missing_or_out_of_range");
  });
  it("distractor taxonomy must be diverse, key not much longer, no letter references", () => {
    const o = goodItem().options.map((x) => ({ ...x }));
    expect(itemViolations(set, goodItem({ options: o.map((x) => (x.is_key ? x : { ...x, label: "reversal" })) }))).toContain("distractor_labels_not_diverse");
    expect(itemViolations(set, goodItem({ options: o.map((x) => (x.is_key ? { ...x, text: x.text + " and also to establish a long-running pattern of quiet generosity across the whole decade" } : x)) }))).toContain("key_much_longer_than_distractors");
    expect(itemViolations(set, goodItem({ options: o.map((x, i) => (i === 2 ? { ...x, text: "Both A and B" } : x)) }))).toContain("option_references_letters_or_all_none");
  });
  it("a figure reference is rejected; the dollar sign is rejected", () => {
    expect(itemViolations(set, goodItem({ stem: "As shown in the table, the writer wants to" }))).toContain("stem_refers_to_figure_that_does_not_exist");
    expect(textHazards("It cost $5 and $10.")).toContain("dollar_sign");
  });
  it("writing stems must carry an explicit goal and anchor", () => {
    const w: ElSetRaw = { ...set, kind: "writing" };
    expect(itemViolations(w, goodItem({ skill: "8.B", topic: "U7.4", stem: "Which choice is best for sentence 2?" }))).toContain("writing_stem_has_no_explicit_goal");
    expect(itemViolations(w, goodItem({ skill: "8.B", topic: "U7.4", stem: "The writer wants to combine sentences 1 and 2 concisely. Which choice most effectively does so?" }))).toEqual([]);
  });
  it("skill must belong to the set section and topic to the skill", () => {
    expect(itemViolations(set, goodItem({ skill: "8.B", topic: "U7.4" }))).toContain("skill_8.B_not_reading");
    expect(itemViolations(set, goodItem({ topic: "U1.1" }))).toContain("topic_U1.1_not_for_skill_7.A");
  });
  it("device used by an item must be in the blueprint inventory", () => {
    expect(itemViolations(set, goodItem({ devices_used: ["metaphor"] }))).toContain("item_device_metaphor_not_in_blueprint_inventory");
  });
});

describe("englang set gates", () => {
  it("short passages, missing blueprint and real people are flagged", () => {
    const v = setViolations({ ...set, paragraphs: [["Abraham Lincoln said so."]], blueprint: {} });
    expect(v.some((x) => x.startsWith("passage_words"))).toBe(true); expect(v.some((x) => x.startsWith("real_person"))).toBe(true); expect(v).toContain("blueprint_missing_speaker");
  });
  it("display numbers paragraphs for reading and sentences for writing", () => {
    expect(passageDisplay(set)).toContain("¶2 By the time"); expect(passageDisplay({ ...set, kind: "writing" })).toContain("[4] By the time");
    expect(passageDisplay(set).startsWith("ALTON original passage\nThe Warm Room")).toBe(true);
  });
  it("key longest bias across a set is detected", () => {
    const longKey = (n: number): ElItemRaw => goodItem({ stem: `Question number ${n} asks what the writer wants here`, options: [mkOpt("a very long keyed option with many many words in it indeed", true, "correct", "x"), mkOpt("short one", false, "reversal", "x"), mkOpt("short two", false, "unsupported", "x"), mkOpt("short three", false, "too_narrow", "x")] });
    expect(setItemSpread([longKey(1), longKey(2), longKey(3), longKey(4)]).some((x) => x.startsWith("key_is_longest"))).toBe(true);
  });
});

describe("similarity and key balance", () => {
  const base = "the harbor library opened in 1931 with eleven hundred books and one stubborn stove and nobody complained about the cold for a very long time";
  it("flags shared 12 word runs and high 5-gram share", () => {
    expect(similarityViolations("A fresh sentence. " + base + " then something else entirely different follows here.", [{ id: "old", text: base }]).length).toBeGreaterThan(0);
    expect(similarityViolations("Completely unrelated prose about tidal pools and the patience of anemones in cold weather.", [{ id: "old", text: base }])).toEqual([]);
  });
  it("balanced key positions use each position evenly with no run of three", () => {
    const k = balancedKeyPositions(24, 5); const c = [0, 1, 2, 3].map((x) => k.filter((y) => y === x).length);
    expect(c).toEqual([6, 6, 6, 6]); expect(k.some((x, i) => i >= 2 && x === k[i - 1] && x === k[i - 2])).toBe(false);
    expect(keyPositionViolations(Array(10).fill(0))).not.toEqual([]); expect(keyPositionViolations(k)).toEqual([]);
  });
  it("placeKey puts the key at the requested position", () => { const o = goodItem().options; for (let p = 0; p < 4; p++) { const r = placeKey(o.map((x) => ({ ...x })), p, 3); expect(r.options[p].is_key).toBe(true); expect(r.key_index).toBe(p); expect(r.options.length).toBe(4); } });
});

describe("key confidence", () => {
  const v = (c: number, conf = "certain"): { choice: number; confidence: string } => ({ choice: c, confidence: conf });
  it("passes only with 3/3 agreement, weak-or-none adversary and a clear judge", () => {
    const ok = keyConfidence({ keyIndex: 2, votes: [v(2), v(2), v(2)], adversary: { defensibility: "none" }, judge: { verdict: "key_clearly_better" }, detViolations: [] });
    expect(ok.pass).toBe(true); expect(ok.band).toBe("high"); expect(ok.score).toBeGreaterThanOrEqual(0.95);
    expect(keyConfidence({ keyIndex: 2, votes: [v(2), v(1), v(2)], adversary: { defensibility: "none" }, judge: { verdict: "key_clearly_better" }, detViolations: [] }).pass).toBe(false);
    expect(keyConfidence({ keyIndex: 2, votes: [v(2), v(2), v(2)], adversary: { defensibility: "strong" }, judge: { verdict: "key_clearly_better" }, detViolations: [] }).pass).toBe(false);
    expect(keyConfidence({ keyIndex: 2, votes: [v(2), v(2), v(2)], adversary: { defensibility: "weak" }, judge: { verdict: "alt_equally_defensible" }, detViolations: [] }).pass).toBe(false);
    expect(keyConfidence({ keyIndex: 2, votes: [v(2), v(2), v(2)], adversary: null, judge: null, detViolations: [] }).pass).toBe(false);
    expect(keyConfidence({ keyIndex: 2, votes: [v(2), v(2), v(2, "unsure")], adversary: { defensibility: "weak" }, judge: { verdict: "key_clearly_better" }, detViolations: [] }).band).not.toBe("high");
  });
  it("a solver that reports a second defensible option blocks the pass", () => {
    expect(keyConfidence({ keyIndex: 1, votes: [v(1), { choice: 1, confidence: "certain", also_defensible: 3 }, v(1)], adversary: { defensibility: "none" }, judge: { verdict: "key_clearly_better" }, detViolations: [] }).pass).toBe(false);
  });
});
