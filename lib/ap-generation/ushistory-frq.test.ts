import { describe, expect, it } from "vitest";
import { USH_FRQ_SCHEMA_VERSION, USH_RUBRIC_ID, USH_RUBRIC_ROWS, frqPassageDisplay, frqReferenceText, frqTaskText, frqViolations, taskOf, type UshFrqPayload } from "./ushistory-frq";
import { toEssayPayload } from "../essay-grading/payload";

const words = (n: number, w = "word") => Array.from({ length: n }, (_, i) => `${w}${i % 9 === 0 ? "a" : "b"}`).join(" ");
const src = (id: string, kind: "primary_text" | "secondary_text", n = 80) => ({ id, kind, title: `Title ${id}`, attribution: `A fictional clerk, 1850 (ALTON-composed, in the style of a ledger note ${id})`, body: words(n, `t${id}x`), provenance: { kind: "alton_composed" as const, note: "x" } });
const rows = (task: "saq" | "dbq" | "leq") => USH_RUBRIC_ROWS[task].map((r) => ({ ...r, descriptors: Object.fromEntries(Array.from({ length: r.max + 1 }, (_, k) => [String(k), `level ${k}`])), task_specific: "specific" }));
const essay = (n: number, tag: string) => `${words(n, tag)} the quoted phrase here ${tag}`;
const sample = (task: "saq" | "dbq" | "leq", tier: "high" | "mid" | "low", total: number, w: number) => { const rs: Record<string, number> = {}; let left = total; for (const r of USH_RUBRIC_ROWS[task]) { const v = Math.min(r.max, left); rs[r.row_id] = v; left -= v; } const e = essay(w, tier); return { tier, target_total: total, essay: e, word_count: e.split(/\s+/).length, rubric_scores: { ...rs, total }, annotations: [1, 2, 3].map(() => ({ quote: "the quoted phrase here", comment: "earns credit", row_id: USH_RUBRIC_ROWS[task][0].row_id })) }; };
const base = (template: "saq1" | "saq2" | "saq3" | "dbq" | "leq"): UshFrqPayload => {
  const task = taskOf(template);
  const sources = template === "saq1" ? [src("A", "secondary_text"), src("B", "secondary_text")] : template === "saq2" ? [src("A", "primary_text")] : template === "saq3" ? [{ id: "A", kind: "table" as const, title: "T", attribution: "Compiled (ALTON-composed illustrative data)", body: "A fictional table.", table: { columns: ["Year", "Value"], rows: [["1950", 1], ["1955", 2], ["1960", 3]] }, provenance: { kind: "alton_composed" as const, note: "x" } }] : template === "dbq" ? [src("1", "primary_text"), src("2", "primary_text"), src("3", "primary_text"), src("4", "primary_text"), src("5", "secondary_text"), src("6", "primary_text"), { id: "7", kind: "table" as const, title: "T", attribution: "Compiled (ALTON-composed illustrative data)", body: "d", table: { columns: ["Year", "V"], rows: [["1", 1], ["2", 2], ["3", 3]] }, provenance: { kind: "alton_composed" as const, note: "x" } }] : [];
  const tot = { saq: [3, 2, 1], dbq: [6, 4, 2], leq: [5, 3, 1] }[task]; const w = { saq: [100, 80, 50], dbq: [600, 400, 200], leq: [500, 350, 180] }[task];
  return { schema_version: USH_FRQ_SCHEMA_VERSION, task_type: task, template, period: task === "dbq" ? 4 : 6, periods: [3, 4, 5, 6], title: "A question", prompt: { scenario: "Scenario.", task: "Task text.", requirements: task === "saq" ? [] : ["Respond with a thesis."], ...(task === "saq" ? { parts: [{ label: "A" as const, prompt: "Briefly describe ONE thing.", points: 1 as const }, { label: "B" as const, prompt: "Briefly explain ONE thing.", points: 1 as const }, { label: "C" as const, prompt: "Briefly explain ONE other thing.", points: 1 as const }] } : {}) },
    sources, rubric: { rubric_id: USH_RUBRIC_ID, total_points: { saq: 3, dbq: 7, leq: 6 }[task], rows: rows(task), scoring_notes: [] },
    expected_features: { defensible_theses: ["a", "b"], outside_evidence: ["1", "2", "3", "4"], doc_uses: Array.from({ length: 7 }, (_, i) => ({ source_id: String(i + 1), usable_for: "x" })), saq_answers: { a: ["x"], b: ["y"], c: ["z"] }, common_pitfalls: ["p"], facts: ["f1", "f2"] },
    samples: [sample(task, "high", tot[0], w[0]), sample(task, "mid", tot[1], w[1]), sample(task, "low", tot[2], w[2])], provenance: { kind: "alton_composed", note: "n" } };
};

describe("ush-frq-1 gates", () => {
  it.each(["saq1", "saq2", "saq3", "dbq", "leq"] as const)("a well-formed %s pack has no violations", (t) => { const p = base(t); expect(frqViolations(p).filter((v) => !/^source_.*words/.test(v))).toEqual([]); });
  it("rejects wrong structure: SAQ1 with one source, DBQ with 6 documents, LEQ with sources, real person, unmarked source", () => {
    const a = base("saq1"); a.sources = a.sources.slice(0, 1); expect(frqViolations(a)).toContain("saq1_needs_two_secondary_texts");
    const d = base("dbq"); d.sources = d.sources.slice(0, 6); expect(frqViolations(d)).toContain("dbq_documents_6_not_7");
    const l = base("leq"); l.sources = [src("A", "primary_text")]; expect(frqViolations(l)).toContain("leq_has_sources");
    const r = base("saq2"); r.sources[0].attribution = "President Lincoln, 1863 (ALTON-composed)"; expect(frqViolations(r).join()).toMatch(/real_person/);
    const u = base("saq2"); u.sources[0].attribution = "A clerk, 1850"; expect(frqViolations(u).join()).toMatch(/not_marked_alton_composed/);
  });
  it("rejects samples that are not strictly ordered or whose scores do not sum", () => {
    const p = base("dbq"); p.samples[1].rubric_scores.total = 6; expect(frqViolations(p).join()).toMatch(/rubric_scores_invalid|not_strictly|far_from/);
  });
  it("displays documents and the task, and the reference text lists rows and samples", () => {
    const d = base("dbq"); expect(frqPassageDisplay(d)).toMatch(/^ALTON-composed stimulus\nDocument 1/); expect(frqPassageDisplay(base("leq"))).toBe(""); expect(frqTaskText(base("saq1"))).toMatch(/\(A\) Briefly describe/);
    const ref = frqReferenceText(d); expect(ref).toMatch(/worth 7 points/); expect(ref).toMatch(/Sample response, high score \(6\/7/);
  });
  it("the essay grader adapter reads the same payload (ush_frq) for all three task types", () => {
    for (const t of ["saq1", "dbq", "leq"] as const) { const p = base(t); const ctx = toEssayPayload({ ush_frq: p, parts: [{ label: "A", prompt: "x" }] }) as { sources: unknown[]; samples: unknown[] } | null; expect(ctx).not.toBeNull(); expect(ctx!.samples).toHaveLength(3); }
  });
});
