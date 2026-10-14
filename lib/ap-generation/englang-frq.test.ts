import { describe, expect, it } from "vitest";
import { frqPassageDisplay, frqReferenceText, frqTaskText, frqViolations, sourceNumberConflicts, tableMarkdown, type ElFrqPayload, type ElFrqSource, type ElSample } from "./englang-frq";

const uid = (i: number) => String.fromCharCode(97 + Math.floor(i / 26) % 26) + String.fromCharCode(97 + (i % 26));
const words = (tag: string, n: number) => Array.from({ length: n }, (_, i) => `${tag.replace(/[^a-z]/gi, "")}${uid(i)}`).join(" ");
const textSource = (id: string, n = 200): ElFrqSource => ({ id, kind: "text", title: `Title ${id}`, attribution: `Fictional Writer ${id}, The Harbor Ledger, 2019`, body: words(`s${id}`, n) + ".", provenance: { kind: "original", author_alias: `Writer ${id}`, year_alias: 2019 }, stance: `stance-${id}` });
const synthesis = (): ElFrqPayload => ({
  schema_version: "el-frq-1", task_type: "synthesis", template: "q1", title: "Public libraries and funding",
  prompt: { scenario: "A fictional town debates its library budget.", task: "Write an essay that synthesizes material from at least three of the sources and develops your position on library funding.", requirements: ["Defend a position", "Cite sources as Source A and Source B", "Use at least three sources"] },
  sources: [textSource("A"), textSource("B"), textSource("C"), textSource("D"),
    { id: "E", kind: "quantitative", title: "Survey of residents", attribution: "Harbor Town Records Office, 2021", body: "Residents were asked how often they visit the library. " + words("e", 20) + ".", table: { columns: ["Group", "Visits per year"], rows: [["Under 18", 14], ["18 to 64", 6], ["65 and over", 9]] }, provenance: { kind: "original", author_alias: "Records Office", year_alias: 2021 }, stance: "stance-E" },
    { id: "F", kind: "visual", title: "Budget share", attribution: "Harbor Town Budget Office, 2022", figure: { chart: "bar", title: "Library budget share", categories: ["2019", "2020", "2021"], series: [{ name: "Share", values: [3, 2, 4] }], yTitle: "Percent of town budget", description: "A bar chart of the library share of the town budget for three years." }, provenance: { kind: "original", author_alias: "Budget Office", year_alias: 2022 } }],
  rubric: { total_points: 6, rows: [
    { row_id: "A", name: "Thesis", max: 1, descriptors: { "0": "No defensible position.", "1": "Defensible position on library funding." }, task_specific: "A position on funding that responds to the prompt." },
    { row_id: "B", name: "Evidence and commentary", max: 4, descriptors: { "0": "none", "1": "summary", "2": "some commentary", "3": "consistent commentary", "4": "consistent and explained" }, task_specific: "Uses at least three sources with commentary." },
    { row_id: "C", name: "Sophistication", max: 1, descriptors: { "0": "not shown", "1": "sustained complexity" }, task_specific: "Complexity of the issue." }], scoring_notes: ["Do not reward length."] },
  expected_features: { defensible_positions: ["fund fully", "fund partly", "fund by usage"], source_uses: ["A", "B", "C", "D", "E", "F"].map((s) => ({ source_id: s, usable_for: "evidence" })), common_pitfalls: ["summary only"] },
  samples: [], blueprint: { stances: ["x", "y", "z"] }, provenance: { kind: "original", note: "fictional" },
});
const sample = (tier: "high" | "mid" | "low", total: number, n: number, rs: { A: number; B: number; C: number }): ElSample => { const essay = words(tier, n) + "."; return { tier, target_total: total, essay, word_count: n, rubric_scores: { ...rs, total }, annotations: [1, 2, 3].map((i) => ({ quote: `${tier}${uid(i)} ${tier}${uid(i + 1)}`, comment: "earns credit for a clear claim", row_id: "A" as const })) }; };
const withSamples = (p: ElFrqPayload): ElFrqPayload => ({ ...p, samples: [sample("high", 6, 450, { A: 1, B: 4, C: 1 }), sample("mid", 4, 300, { A: 1, B: 3, C: 0 }), sample("low", 2, 160, { A: 0, B: 2, C: 0 })] });

describe("englang FRQ schema gates", () => {
  it("a complete synthesis set with three ordered samples has no violations", () => { expect(frqViolations(withSamples(synthesis()))).toEqual([]); });
  it("synthesis needs six sources A-F with a visual and a quantitative source", () => {
    const p = withSamples(synthesis()); const v = frqViolations({ ...p, sources: p.sources.slice(0, 5) });
    expect(v).toContain("synthesis_sources_5_not_6"); expect(v).toContain("synthesis_no_visual_source");
    expect(frqViolations({ ...p, sources: p.sources.map((s) => (s.id === "E" ? { ...s, kind: "text" as const } : s)) })).toContain("synthesis_no_quantitative_source");
  });
  it("needs at least three distinct stances", () => { const p = withSamples(synthesis()); expect(frqViolations({ ...p, sources: p.sources.map((s) => ({ ...s, stance: "same" })) })).toContain("synthesis_stances_1_lt_3"); });
  it("detects contradicting numbers between a table and a chart", () => {
    const p = synthesis(); const bad = p.sources.map((s) => (s.id === "E" ? { ...s, table: { columns: ["Year", "Share"], rows: [["2019", 7]] } } : s));
    const c = sourceNumberConflicts(bad.map((s) => (s.id === "E" ? { ...s, table: { columns: ["Year", "Share"], rows: [["2019", 7]] } } : s)));
    expect(c.length).toBe(1); expect(c[0]).toContain("2019");
    expect(sourceNumberConflicts(p.sources)).toEqual([]);
  });
  it("samples must be in word range, ordered, internally consistent and annotated with verbatim quotes", () => {
    const p = withSamples(synthesis());
    expect(frqViolations({ ...p, samples: p.samples.map((s) => (s.tier === "low" ? { ...s, essay: words("low", 40) + ".", word_count: 40 } : s)) }).some((x) => x.startsWith("sample_low_words"))).toBe(true);
    expect(frqViolations({ ...p, samples: p.samples.map((s) => (s.tier === "mid" ? { ...s, rubric_scores: { A: 1, B: 2, C: 0, total: 3 }, target_total: 3 } : s.tier === "low" ? { ...s, rubric_scores: { A: 0, B: 3, C: 0, total: 3 }, target_total: 3 } : s)) })).toContain("samples_not_strictly_ordered");
    expect(frqViolations({ ...p, samples: p.samples.map((s) => (s.tier === "high" ? { ...s, rubric_scores: { A: 1, B: 4, C: 1, total: 5 } } : s)) })).toContain("sample_high_rubric_scores_invalid");
    expect(frqViolations({ ...p, samples: p.samples.map((s) => (s.tier === "high" ? { ...s, annotations: [{ quote: "not in essay at all", comment: "x", row_id: "A" as const }, ...s.annotations] } : s)) })).toContain("sample_high_annotation_quote_not_in_essay");
  });
  it("rubric rows need every descriptor level and the dollar sign is banned", () => {
    const p = withSamples(synthesis()); const rows = p.rubric.rows.map((r) => (r.row_id === "B" ? { ...r, descriptors: { "0": "a", "1": "b" } } : r));
    expect(frqViolations({ ...p, rubric: { ...p.rubric, rows } })).toContain("rubric_row_B_descriptor_2_missing");
    expect(frqViolations({ ...p, prompt: { ...p.prompt, scenario: "It costs $5." } })).toContain("text_dollar_sign");
  });
  it("rhetorical analysis needs one passage and at least five identifiable devices inside the inventory", () => {
    const para = Array.from({ length: 6 }, (_, i) => [`${words(`p${i}a`, 40)}.`, `${words(`p${i}b`, 35)}.`]);
    const base = withSamples({ ...synthesis(), task_type: "rhetorical_analysis", template: "q2", sources: [{ id: "A", kind: "text", title: "Address", attribution: "Fictional Speaker, 1988", paragraphs: para, provenance: { kind: "original", author_alias: "Speaker", year_alias: 1988 } }], blueprint: { devices: [{ device: "metaphor", sentence_ids: [1], function: "x" }, { device: "anecdote", sentence_ids: [2], function: "x" }, { device: "repetition", sentence_ids: [3], function: "x" }, { device: "irony", sentence_ids: [4], function: "x" }, { device: "pathos", sentence_ids: [5], function: "x" }] }, expected_features: { rhetorical_choices: Array.from({ length: 5 }, (_, i) => ({ device: "metaphor", paragraph: 1, sentence_ids: [i + 1], effect: "x" })), common_pitfalls: ["x"] } });
    expect(frqViolations(base)).toEqual([]);
    expect(frqViolations({ ...base, blueprint: { devices: base.blueprint.devices!.slice(0, 3) } })).toContain("rhetorical_devices_3_lt_5");
    expect(frqViolations({ ...base, blueprint: { devices: [{ device: "made_up_device", sentence_ids: [99], function: "x" }, ...base.blueprint.devices!] } }).some((x) => x.startsWith("device_not_in_inventory"))).toBe(true);
  });
});

describe("englang FRQ display helpers", () => {
  it("renders Source A-F with the table as markdown and a pointer for the chart; the passage starts with the original-passage marker", () => {
    const d = frqPassageDisplay(synthesis()); expect(d.startsWith("ALTON original passage\n")).toBe(true);
    expect(d).toContain("Source E (table)"); expect(d).toContain("| Group | Visits per year |"); expect(d).toContain("Source F (chart)"); expect(d).toContain("appears below the sources");
    expect(tableMarkdown({ columns: ["a", "b"], rows: [[1, 2]] })).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |");
  });
  it("task text lists the requirements; reference text carries the rubric and all three samples with annotations", () => {
    const p = withSamples(synthesis()); expect(frqTaskText(p)).toContain("Your essay should:\n- Defend a position");
    const r = frqReferenceText(p); expect(r).toContain("not official College Board scoring"); expect(r).toContain("Sample response, high score (6/6"); expect(r).toContain("Sample response, low score (2/6"); expect(r).toContain('"highab highac" - earns credit');
  });
});
