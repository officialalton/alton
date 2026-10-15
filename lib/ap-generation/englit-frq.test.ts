import { describe, expect, it } from "vitest";
import { LT_SCHEMA_CHECK, frqPassageDisplay, frqReferenceText, frqTaskText, frqViolations, normalizeFrqPayload, sampleQuoteViolations, type LtFrqPayload, type LtSample } from "./englit-frq";
import { LT_WORKS_LIST } from "./subjects/englit";

const STANZAS = [
  ["The ferry leaves before the light is sure of itself,", "its engine clearing a throat in the harbor fog,", "and I, who have carried other people's trunks", "for thirty winters, count the rope coils twice,", "as if the number might change its mind."],
  ["Nobody tells the deckhand where the crossing ends.", "The passengers lean on the rail like tired commas,", "pausing a sentence that has no verb,", "and the water, patient as a cashier,", "takes each coin of daylight and says nothing."],
  ["Once a girl asked me whether the far shore was real.", "I said the far shore is whatever the rope holds.", "She laughed, and her laugh got into the engine,", "and for a mile the whole boat ran on it,", "bright and borrowed, like a small unpaid debt."],
  ["Now the bridge is done. Its cables hum above us", "and the ferry, slow and stubborn, gets its last", "good morning from the gulls. I coil the rope.", "I coil the rope. I coil the rope", "and, being no longer needed, am carefully useful."],
];
const essay = (n: number, extra = "") => `${Array.from({ length: n }, (_, i) => `word${i % 9}`).join(" ")} ${extra}`.trim();
const sample = (tier: LtSample["tier"], total: number, words: number, extra = ""): LtSample => { const e = essay(words, extra); return { tier, target_total: total, essay: e, word_count: e.split(/\s+/).length, rubric_scores: { A: 1, B: total - 1, C: 0, total }, annotations: [{ quote: "word1 word2", comment: "c", row_id: "A" }] }; };
const q1 = (): LtFrqPayload => normalizeFrqPayload({ schema_version: "lit-frq-1", task_type: "poetry_analysis", template: "q1", title: "Last Crossing",
  prompt: { lead: 'In the poem "Last Crossing" (an original poem by Ines Calder), the speaker reflects on work that is ending.', task: "Read the poem closely. Then write an essay in which you analyze how Calder uses poetic elements and techniques to portray a divided attitude.", requirements: ["Make a defensible claim.", "Use specific evidence."] },
  passage: { form: "poem", title: "Last Crossing", attribution: "by Ines Calder", stanzas: STANZAS, line_count: 20, provenance: { kind: "original", author_alias: "Ines Calder", year_alias: 1994 } },
  rubric: { total_points: 6, rows: [{ row_id: "A", name: "", max: 0, descriptors: {}, task_specific: "A defensible thesis names the speaker's divided attitude toward being needed and cites the ending as the source of the tension, not merely the bridge." }, { row_id: "B", name: "", max: 0, descriptors: {}, task_specific: "Strong evidence draws on the similes, the repeated rope image and the final line, and explains how each builds the speaker's pride and grief together." }, { row_id: "C", name: "", max: 0, descriptors: {}, task_specific: "Sophistication appears when the essay sustains the tension between usefulness and obsolescence and considers a reading of the last line as irony." }], scoring_notes: [] },
  expected_features: {}, samples: [sample("high", 6, 450), sample("mid", 4, 320), sample("low", 2, 180)], blueprint: {}, provenance: { kind: "original", note: "n" } });

describe("englit frq", () => {
  it("normalizes the rubric rows from the shared descriptors and keeps task-specific text", () => {
    const p = q1(); expect(p.rubric.rows.map((r) => [r.row_id, r.max])).toEqual([["A", 1], ["B", 4], ["C", 1]]); expect(p.rubric.rows[1].descriptors["4"]).toMatch(/multiple literary elements/); expect(p.rubric.rows[0].task_specific).toMatch(/divided attitude/);
  });
  it("accepts a well-formed poetry prompt (word counts per tier, order, quotes)", () => {
    const p = { ...q1(), passage: { ...q1().passage!, line_count: 20 } }; expect(LT_SCHEMA_CHECK).toBe(true); expect(frqViolations(p)).toEqual([]);
    expect(frqPassageDisplay(p)).toContain("```passage"); expect(frqTaskText(p)).toContain("Your essay should:"); expect(frqReferenceText(p)).toContain("Sample essay (high; scored 6/6");
  });
  it("flags real names, short samples, wrong order and invented quotations in samples", () => {
    const p = q1(); expect(frqViolations({ ...p, samples: [sample("high", 4, 450), sample("mid", 4, 320), sample("low", 2, 180)] }).join()).toMatch(/samples_score_order_violated/);
    expect(frqViolations({ ...p, samples: [sample("high", 6, 120), sample("mid", 4, 320), sample("low", 2, 180)] }).join()).toMatch(/sample_high_words_/);
    expect(frqViolations({ ...p, samples: [sample("high", 6, 450, 'The speaker says "the harbor sings its own lullaby" often.'), sample("mid", 4, 320), sample("low", 2, 180)] }).join()).toMatch(/sample_high_sample_quote_not_in_passage/);
    expect(sampleQuoteViolations('He writes "like tired commas" and "the far shore is whatever the rope holds".', STANZAS.flat().join(" "))).toEqual([]);
    expect(frqViolations({ ...p, passage: { ...p.passage!, provenance: { kind: "original", author_alias: "Emily Dickinson", year_alias: 1990 } } }).join()).toMatch(/passage_real_name/);
  });
  it("validates the literary argument prompt: lead, listed works only, no passage, no-plot-summary line", () => {
    const works = LT_WORKS_LIST.map((w) => ({ title: w[0], author: w[1] }));
    const q3 = normalizeFrqPayload({ ...q1(), task_type: "literary_argument", template: "q3", passage: undefined, works_list: works,
      prompt: { lead: Array.from({ length: 60 }, () => "gift").join(" "), task: "Either from your own reading or from the list below, choose a work of fiction in which a gift is a burden. Then analyze how it contributes to an interpretation of the work as a whole. Do not merely summarize the plot.", requirements: ["a", "b"] },
      samples: [sample("high", 6, 450, "Things Fall Apart"), sample("mid", 4, 320, "Things Fall Apart"), sample("low", 2, 180, "Things Fall Apart")] });
    expect(frqViolations(q3)).toEqual([]); expect(frqTaskText(q3)).toContain("- Things Fall Apart, Chinua Achebe");
    expect(frqViolations({ ...q3, works_list: [...works.slice(1), { title: "Invented Book", author: "A. Writer" }] }).join()).toMatch(/works_list_entry_not_in_verified_list/);
    expect(frqViolations({ ...q3, passage: q1().passage }).join()).toMatch(/q3_has_passage/);
  });
});
