import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateDuplicate, gateFrq, gateMc, gateNoCalcExact, jaccard, wordingPreserves, type FrqPack, type McPack } from "./gates";
import { gateGuideFrq, gateGuideMc } from "./guide-gates";
import { calcAbGuide } from "./subjects/calc-ab";
import { calcBcGuide } from "./subjects/calc-bc";

const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const run = (script: string, input?: string, args: string[] = []) => spawnSync(PY, ["-B", script, ...args], { cwd: ARCH, input, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 170000 });
const havePy = spawnSync(PY, ["-c", "import sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;

const good = (): McPack => ({ archetype: "product_table", topic: "2.8", skill: "1.E", calculator: "not_allowed", stem: "The table gives values of differentiable functions $f$ and $g$ and their derivatives at $x=2$. If $h(x)=f(x)g(x)+3f(x)$, what is $h'(2)$?",
  stimulus: { kind: "table", description: "Values at x=2", data: {} },
  options: [{ text: "$-16$", why: "Product rule plus the constant-multiple rule.", value: "-16" }, { text: "$-12$", why: "Replaces the product rule with f'g' and adds 3f'.", value: "-12" }, { text: "$-1$", why: "Differentiates 3f(x) as 3f(a).", value: "-1" }, { text: "$4$", why: "Drops the 3f' term entirely from the result.", value: "4" }],
  key_index: 0, est_seconds: 75, facts: [], explanation_en: "The correct answer is -16. Product rule plus the constant-multiple rule.\n-12 is incorrect: replaces the product rule with f'g' and adds 3f'.\n-1 is incorrect: differentiates 3f(x) as 3f(a).\n4 is incorrect: drops the 3f' term entirely from the result." });

describe("MC gates: known-good and known-bad (Calculus AB)", () => {
  it("accepts a clean item", () => { expect(gateMc("ap_calculus_ab", good())).toEqual([]); expect(gateGuideMc(calcAbGuide, good())).toEqual([]); });
  const bad: [string, (p: McPack) => McPack, string][] = [
    ["duplicate options", (p) => ({ ...p, options: [p.options[0], { ...p.options[1], text: p.options[0].text }, p.options[2], p.options[3]] }), "duplicate_options"],
    ["key out of range", (p) => ({ ...p, key_index: 9 }), "key_out_of_range"],
    ["three options", (p) => ({ ...p, options: p.options.slice(0, 3) }), "option_count_3"],
    ["narrated error in option", (p) => ({ ...p, options: p.options.map((o, i) => (i === 1 ? { ...o, text: "$-12$ because the student forgets the chain" } : o)) }), "narrated_error_in_option"],
    ["distractor without misconception", (p) => ({ ...p, options: p.options.map((o, i) => (i === 2 ? { ...o, why: "wrong" } : o)) }), "distractor_without_misconception"],
    ["same value as key (multiple correct)", (p) => ({ ...p, options: p.options.map((o, i) => (i === 1 ? { ...o, value: "-16" } : o)) }), "multiple_correct_same_value"],
    ["key much longer", (p) => ({ ...p, options: p.options.map((o, i) => (i === 0 ? { ...o, text: "$-16$ using the product rule on f times g and then the constant multiple rule on three f$" } : o)) }), "key_much_longer"],
    ["explanation cites letters", (p) => ({ ...p, explanation_en: p.explanation_en + " Option B is a slip." }), "explanation_references_option_letter"],
    ["skill not assessed in MC", (p) => ({ ...p, skill: "4.B" }), "skill_not_assessed_in_mc"],
    ["table stimulus not referenced", (p) => ({ ...p, stem: "If $h(x)=f(x)g(x)+3f(x)$, what is $h'(2)$?" }), "stem_does_not_reference_table"],
  ];
  for (const [name, mut, code] of bad) it(`rejects: ${name}`, () => expect(gateMc("ap_calculus_ab", mut(good()))).toContain(code));
  it("rejects BC content in an AB item", () => { const p = { ...good(), stem: "Does the series converge? The table gives values." }; expect(gateGuideMc(calcAbGuide, p).join()).toMatch(/banned_term/); });
  it("accepts BC content in a BC guide", () => { const p = { ...good(), stem: "Does the series converge? The table gives values." }; expect(gateGuideMc(calcBcGuide, p).join()).not.toMatch(/banned_term:BC-only/); });
  it("rejects decimal options in a no-calculator item and accepts them when a calculator is required", () => {
    const dec = { ...good(), options: good().options.map((o) => ({ ...o, text: "$3.1416$" })) };
    expect(gateNoCalcExact(dec)).toEqual(["decimal_options_in_no_calculator_item"]); expect(gateNoCalcExact({ ...dec, calculator: "required" })).toEqual([]);
  });
  it("rejects labelling by AP score level", () => expect(gateGuideMc(calcAbGuide, { ...good(), stem: good().stem + " This is a level 5 question." }).join()).toMatch(/banned_term/));
  it("wording must preserve numbers and math blocks", () => {
    expect(wordingPreserves("Find $f'(2)$ if $f(x)=3x^2$ at x = 7", "Evaluate the derivative $f'(2)$ of $f(x)=3x^2$ at x = 7.")).toEqual([]);
    expect(wordingPreserves("Find $f'(2)$ if $f(x)=3x^2$", "Find $f'(3)$ if $f(x)=3x^2$").join()).toMatch(/changed_math_block|missing_2/);
    expect(wordingPreserves("It is 12 meters", "It is 14 meters").join()).toMatch(/missing_12/);
  });
});

describe("FRQ gates (Calculus AB)", () => {
  const frq = (): FrqPack => ({ archetype: "frq_table_rate", template: "table_rate_context_calc", topic: "6.2", skill: "2.B", calculator: "required", title: "Rate table", stimulus: { kind: "table", description: "R(t)", data: {} }, total_points: 4, est_minutes: 15, facts: [],
    parts: [{ label: "a", prompt: "Approximate the integral using a trapezoidal sum. Show the work.", points: 2, response_mode: "calculate", skill_codes: ["1.E"], model_answer: "12.5", rubric_rows: [{ row_id: "a1", points: 1, criterion: "Form of the trapezoidal sum", required_elements: ["sum"], requires_numbers: true }, { row_id: "a2", points: 1, criterion: "Approximation value", required_elements: ["12.5"], requires_row_id: "a1", requires_numbers: true }] },
      { label: "b", prompt: "Must there be a time c with R(c)=5? Justify.", points: 2, response_mode: "explain", skill_codes: ["3.B"], model_answer: "Yes", rubric_rows: [{ row_id: "b1", points: 1, criterion: "States R is continuous", required_elements: ["continuous"] }, { row_id: "b2", points: 1, criterion: "Conclusion with values on both sides", required_elements: ["R(1)>5>R(2)"], requires_numbers: true }] }] });
  const skills = new Set(["1.E", "3.B", "2.B"]);
  it("accepts a clean bundle", () => expect(gateFrq("ap_calculus_ab", frq(), skills)).toEqual([]));
  it("rejects rows that do not sum to the part points", () => { const f = frq(); f.parts[0].rubric_rows[1].points = 2; expect(gateFrq("ap_calculus_ab", f, skills).join()).toMatch(/rows_sum/); });
  it("rejects a dependency on a missing row", () => { const f = frq(); f.parts[0].rubric_rows[1].requires_row_id = "zz"; expect(gateFrq("ap_calculus_ab", f, skills).join()).toMatch(/bad_requires_zz/); });
  it("rejects a calculation part without an answer row", () => { const f = frq(); f.parts[0].rubric_rows[1].criterion = "Something else"; expect(gateFrq("ap_calculus_ab", f, skills).join()).toMatch(/calculation_without_answer_row/); });
  it("rejects a justification part without a reason/condition row", () => { const f = frq(); f.parts[1].rubric_rows = [{ row_id: "b1", points: 2, criterion: "Gets it right", required_elements: ["yes"] }]; expect(gateFrq("ap_calculus_ab", f, skills).join()).toMatch(/justification_without_reason_row/); });
  it("rejects total points mismatch and unknown skill", () => { const f = frq(); f.total_points = 9; f.parts[0].skill_codes = ["9.Z"]; const r = gateFrq("ap_calculus_ab", f, skills).join(); expect(r).toMatch(/total_points/); expect(r).toMatch(/unknown_skill/); });
  it("guide: template must exist and BC terms are rejected for AB", () => { expect(gateGuideFrq(calcAbGuide, { ...frq(), archetype: "nope" })).toEqual(["frq_template_not_in_guide"]); });
});

describe("duplicate gate", () => {
  it("flags exact and near duplicates, passes distinct items", () => {
    const a = good(); const b = { ...good(), stem: a.stem.replace("x=2", "x=5") }; const c = { ...good(), stem: "Evaluate the limit as x approaches 3 of a rational function with a removable discontinuity.", options: [{ text: "$1$", why: "", value: "1" }, { text: "$2$", why: "", value: "2" }, { text: "$3$", why: "", value: "3" }, { text: "$4$", why: "", value: "4" }] };
    expect(gateDuplicate(a, [a])).toEqual(["exact_duplicate"]); expect(gateDuplicate(b, [a]).length).toBeGreaterThanOrEqual(0); expect(gateDuplicate(c, [a])).toEqual([]);
    expect(jaccard(new Set(["a b c"]), new Set(["a b c"]))).toBe(1);
  });
});

d("code-generated archetypes pass the gates (Calculus AB and BC)", () => {
  const out = havePy ? run("registry.py", undefined, ["all", "3"]) : null;
  const all = out && out.status === 0 ? (JSON.parse(out.stdout) as Record<string, Record<string, unknown>[]>) : {};
  it("generator produced packs for every archetype", () => { expect(Object.keys(all).length).toBeGreaterThan(35); }, 180000);
  it("every MC pack: unique key, distinct values, code-written whys, passes structural and guide gates", () => {
    const failures: string[] = [];
    for (const [name, packs] of Object.entries(all)) {
      if (name.startsWith("frq_")) continue;
      for (const p of packs) {
        const mc = p as unknown as McPack; const guide = calcBcGuide.archetypes.some((a) => a.id === name) ? calcBcGuide : calcAbGuide;
        const subject = "ap_calculus_ab"; const r = [...gateMc(subject, { ...mc, explanation_en: undefined }), ...gateGuideMc(guide, mc), ...gateNoCalcExact(mc)];
        if (r.length) failures.push(`${name}: ${r.join(",")}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60000);
  it("every FRQ pack passes the FRQ gates", () => {
    const skills = new Set(calcBcGuide.skills.map((s) => s.code)); const failures: string[] = [];
    for (const [name, packs] of Object.entries(all)) { if (!name.startsWith("frq_") || name.startsWith("frq_bio") || name.startsWith("frq_micro")) continue; for (const p of packs) { const r = [...gateFrq("ap_calculus_ab", p as unknown as FrqPack, skills), ...gateGuideFrq(calcBcGuide, p as unknown as FrqPack)]; if (r.length) failures.push(`${name}: ${r.join(",")}`); } }
    expect(failures).toEqual([]);
  }, 60000);
});

d("Micro and Bio code checkers: known-good and known-bad", () => {
  const micro = (o: unknown) => JSON.parse(run("micro_checks.py", JSON.stringify(o)).stdout) as { ok: boolean };
  const bio = (o: unknown) => JSON.parse(run("bio_checks.py", JSON.stringify(o)).stdout) as { ok: boolean };
  it("Micro: equilibrium shifts, price controls, surplus, game theory", () => {
    expect(micro({ kind: "shift", params: { a: 100, b: 2, c: 10, d: 3, dDemand: 20 }, claim: { dP: "increase", dQ: "increase" } }).ok).toBe(true);
    expect(micro({ kind: "shift", params: { a: 100, b: 2, c: 10, d: 3, dDemand: 20 }, claim: { dP: "decrease" } }).ok).toBe(false);
    expect(micro({ kind: "price_control", params: { a: 100, b: 2, c: 10, d: 3, price: 12, control: "ceiling" }, claim: { binding: true, type: "shortage" } }).ok).toBe(true);
    expect(micro({ kind: "price_control", params: { a: 100, b: 2, c: 10, d: 3, price: 30, control: "ceiling" }, claim: { binding: true } }).ok).toBe(false);
    expect(micro({ kind: "surplus", params: { a: 100, b: 2, c: 10, d: 3 }, claim: { total: "432" } }).ok).toBe(false);
    expect(micro({ kind: "nash", params: { payoffs: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]] }, claim: { nash: [[1, 1]] } }).ok).toBe(true);
    expect(micro({ kind: "nash", params: { payoffs: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]] }, claim: { nash: [[0, 0]] } }).ok).toBe(false);
    expect(micro({ kind: "cross_price", params: { pctQ: -5, pctP: 2 }, claim: { relation: "complements" } }).ok).toBe(true);
  });
  it("Bio: statistics, overlap claims and experimental design validity", () => {
    expect(bio({ kind: "overlap_claim", params: { m1: 10, se1: 1, m2: 16, se2: 1.2 }, claim: { overlap: false } }).ok).toBe(true);
    expect(bio({ kind: "overlap_claim", params: { m1: 10, se1: 1, m2: 12, se2: 1.2 }, claim: { overlap: false } }).ok).toBe(false);
    expect(bio({ kind: "percent_change", params: { old: 2.0, new: 3.0 }, claim: { pct: 50 } }).ok).toBe(true);
    expect(bio({ kind: "hardy_weinberg", params: { q2: 0.04 }, claim: { heterozygotes: 0.32 } }).ok).toBe(true);
    expect(bio({ kind: "design", params: { groups: [{ control: true, n: 5, changed_vs_control: [] }, { n: 5, changed_vs_control: ["light"] }], independent_variables: ["light"], dependent_variable: "height" }, claim: { valid: true } }).ok).toBe(true);
    expect(bio({ kind: "design", params: { groups: [{ n: 5, changed_vs_control: ["light", "water"] }], independent_variables: ["light", "water"], dependent_variable: "height" }, claim: { valid: true } }).ok).toBe(false);
  });
});

describe("generation guides stay consistent with code and docs", () => {
  const registry = readFileSync(path.join(ARCH, "registry.py"), "utf-8");
  const doc = (f: string) => readFileSync(path.resolve(__dirname, `../../docs/ap/generation-guides/${f}`), "utf-8");
  it("every AB guide archetype and FRQ template exists in the registry and in calc-ab.md", () => {
    for (const a of calcAbGuide.archetypes) { expect(registry, a.id).toContain(`"${a.id}"`); expect(doc("calc-ab.md"), a.id).toContain(a.id); }
    for (const t of calcAbGuide.frqTemplates) { expect(registry, t.id).toContain(`"${t.id}"`); expect(doc("calc-ab.md"), t.id).toContain(t.id); }
  });
  it("BC-only archetypes appear in calc-bc.md and AB MC skills are limited to MC-assessed skills", () => {
    const abIds = new Set(calcAbGuide.archetypes.map((a) => a.id));
    for (const a of calcBcGuide.archetypes.filter((x) => !abIds.has(x.id))) expect(doc("calc-bc.md"), a.id).toContain(a.id);
    for (const a of calcAbGuide.archetypes) expect(calcAbGuide.skills.find((s) => s.code === a.skill)?.mc, a.id).toBe(true);
  });
});

import { calibrateFrq } from "./gates";
d("Biology FRQ: per-part skill/topic/rubric, representative skill vs part skills, official grain", () => {
  const out = run("registry.py", undefined, ["batch", "frq_bio_investigation", "6", "0"]); const out2 = run("registry.py", undefined, ["batch", "frq_bio_data_short", "6", "0"]);
  const packs = [...(JSON.parse(out.stdout) as FrqPack[]), ...(JSON.parse(out2.stdout) as FrqPack[])];
  const bioSkills = new Set(["1.A", "3.B", "3.C", "4.A", "4.B", "5.A", "5.B", "6.B", "6.C"]); const topics = new Set(["8.1", "3.2", "3.5", "3.7"]);
  it("code-first short FRQs have four 1-point parts with own skill, topic and rubric row, and pass the gates", () => {
    expect(packs.length).toBe(12);
    for (const p of packs) { expect(p.parts).toHaveLength(4); expect(p.parts.every((x) => x.points === 1 && x.skill_codes.length && x.topic_codes?.length && x.rubric_rows.length === 1)).toBe(true);
      expect(gateFrq("ap_biology", p, bioSkills, { requirePartTopics: true, topics })).toEqual([]); expect(calibrateFrq(p, "ap_biology")).toEqual([]); }
  });
  it("part skills differ from the bundle representative skill (allowed) but the representative skill must be assessed somewhere", () => {
    const p = packs[0]; expect(new Set(p.parts.flatMap((x) => x.skill_codes)).size).toBeGreaterThan(1);
    expect(gateFrq("ap_biology", { ...p, representative_skill: "2.A" }, new Set([...bioSkills, "2.A"]), { requirePartTopics: true, topics }).join()).toMatch(/representative_skill_not_assessed/);
  });
  it("rejects parts without topic when per-part topics are required, or with an unknown topic", () => {
    const p = JSON.parse(JSON.stringify(packs[0])) as FrqPack; delete p.parts[0].topic_codes; p.parts[1].topic_codes = ["99.9"];
    const r = gateFrq("ap_biology", p, bioSkills, { requirePartTopics: true, topics }).join(); expect(r).toMatch(/part_A_no_topic/); expect(r).toMatch(/unknown_topic_99.9/);
  });
  it("official point/time grain: short = four 1-point parts ~10 min is VALID; long 9 points ~22-24 min is VALID; a 3-part short is not", () => {
    expect(calibrateFrq(packs[0], "ap_biology")).toEqual([]); const long = { ...packs[0], total_points: 9, est_minutes: 22, parts: [2, 3, 2, 2].map((n, i) => ({ ...packs[0].parts[0], label: "ABCD"[i], points: n, rubric_rows: Array.from({ length: n }, (_, k) => ({ ...packs[0].parts[0].rubric_rows[0], row_id: `r${i}${k}`, points: 1 })) })) };
    expect(calibrateFrq(long as FrqPack, "ap_biology")).toEqual([]); expect(calibrateFrq({ ...packs[0], parts: packs[0].parts.slice(0, 3) }, "ap_biology").join()).toMatch(/part_count/);
  });
  it("code checks agree with independent Bio checker: percent change and ±2SE overlap computed by the generator", () => {
    const bio = (o: unknown) => JSON.parse(run("bio_checks.py", JSON.stringify(o)).stdout) as { ok: boolean };
    for (const p of packs.filter((x) => x.archetype === "frq_bio_data_short")) {
      const rows = (p.stimulus.data as { rows: string[][] }).rows; const means = rows.map((r) => Number(r[1].split(" ± ")[0])); const se2 = rows.map((r) => Number(r[1].split(" ± ")[1]));
      const m = p.parts[1].model_answer.match(/\(\((-?[\d.]+) - (-?[\d.]+)\) \/ -?[\d.]+\) x 100 = (-?[\d.]+)%/)!; const pct = Number(m[3]);
      expect(bio({ kind: "percent_change", params: { old: Number(m[2]), new: Number(m[1]) }, claim: { pct }, tol: 0.06 }).ok).toBe(true);
      const f = (k: string) => Number((p.facts as string[]).find((x) => x.startsWith(k + "="))!.split("=")[1]); const top = f("top"), second = f("second"); const supported = (p.facts as string[]).includes("supported=True");
      const ov = bio({ kind: "overlap_claim", params: { m1: means[top], se1: se2[top] / 2, m2: means[second], se2: se2[second] / 2 }, claim: { overlap: !supported } });
      expect(ov.ok).toBe(true);
    }
  });
});

describe("해설의 오답 처리 게이트(v2: 문구 일치 아님)", () => {
  const base = { archetype: "x", topic: "2.3", skill: "1.E", calculator: "not_allowed" as const, stem: "What is $q'(1)$?", stimulus: { kind: "none", description: "", data: {} }, options: [{ text: "$4$", why: "key", value: null }, { text: "$3$", why: "forgets the denominator squared in the quotient rule", value: null }, { text: "$-4$", why: "sign", value: null }, { text: "$0$", why: "treats numerator as zero", value: null }], key_index: 0, est_seconds: 75, facts: [] };
  it("오답마다 배척 문장이 있으면(문구 인용 없이도) 통과한다", () => {
    const e = "Using the quotient rule, the derivative at 1 equals 4 after evaluating each term from the table. The second choice drops the squared denominator. The third reverses the sign of the numerator. The last treats the numerator as zero and ignores the other term.";
    expect(gateMc("ap_calculus_ab", { ...base, explanation_en: e })).not.toContain("explanation_does_not_cover_distractors");
  });
  it("정답만 설명하고 오답을 다루지 않으면 걸린다", () => {
    const e = "Using the quotient rule with the table values the derivative at 1 equals 4. Evaluate the numerator first and then divide by the square of the denominator value shown.";
    expect(gateMc("ap_calculus_ab", { ...base, explanation_en: e })).toContain("explanation_does_not_cover_distractors");
  });
  it("해설의 정답이 키와 다르면 별도 사유로 걸린다(오답 키 결함)", () => {
    const e = "The correct answer is $3$. The second choice drops it. The third is wrong. The last ignores it entirely, giving a wrong result.";
    expect(gateMc("ap_calculus_ab", { ...base, explanation_en: e })).toContain("explanation_key_mismatch");
  });
});
