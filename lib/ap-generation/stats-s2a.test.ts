import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateFrq, calibrateMc, gateFrq, gateMc, type FrqPack, type McPack } from "./gates";
import { gateGuideFrq, gateGuideMc } from "./guide-gates";
import { answerTextForExplanation, gateMathWrapping } from "./math-wrapping";
import { generatorDefects } from "./generator-defects";
import { statsGuide } from "./subjects/stats";
import { bundleReferenceChecks } from "./part-refine";
import { baseKeyOf, flattenSet, gateStatsSet, isSetPack, mergeSet, setVerdict, type SetPack } from "./stats-set";
import { gateStatsFrq } from "./stats-frq-checks";
import { planConversion } from "../ap-exam/convert";
import type { ApCurriculumFile } from "../ap-curriculum/types";

const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_statistics.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const topics = new Set(topicUnit.keys());
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");
const run = (stage: string, n: number, seed: number) => {
  const code = `import json,registry as R\nn=R.STATS_STAGES['${stage}']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,${n},${seed}) for k in n}}))`;
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 170000 });
  return { status: r.status, ...(r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {} }) } as { status: number | null; names: string[]; packs: Record<string, unknown[]> };
};

d("AP Statistics S2-a single MC archetypes", () => {
  const out = run("stats_s2a_singles", 3, 900);
  it("registers 15 archetypes that all appear in the guide JSON", () => {
    expect(out.status).toBe(0); expect(out.names).toHaveLength(15);
    const guide = new Set(statsGuide.archetypes.map((a) => a.id)); for (const n of out.names) expect(guide.has(n), n).toBe(true);
  });
  it("covers the pilot gaps: P1 skill 1.A, more P2 (2.A-2.E), conditions checks 4.E", () => {
    const sk = (id: string) => (out.packs[id][0] as McPack).skill;
    expect(out.names.filter((n) => sk(n) === "1.A").length).toBeGreaterThanOrEqual(2);
    expect(out.names.filter((n) => sk(n).startsWith("2.")).length).toBeGreaterThanOrEqual(5);
    expect(out.names.filter((n) => sk(n) === "4.E").length).toBeGreaterThanOrEqual(3);
  });
  it("every pack passes the deterministic gates, the blueprint, the stats guide and the figure gate", () => {
    for (const n of out.names) for (const p0 of out.packs[n] as (McPack & { blueprint: Partial<Blueprint> })[]) {
      const mp = { ...p0, explanation_en: expl(p0) } as McPack;
      const reasons = [...gateMc("ap_statistics", mp), ...calibrateMc("ap_statistics", mp), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp), ...validateBlueprint(p0.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_statistics", kind: "mc", payload: p0 as unknown as Record<string, unknown> });
      expect({ n, reasons, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, reasons: [], fig: [] });
    }
  });
});

d("AP Statistics shared sets (2 sets x 3 questions)", () => {
  const out = run("stats_s2a_sets", 3, 910);
  it("registers the probability/binomial set (unit 2) and the regression set (unit 5)", () => {
    expect(out.names).toEqual(["st_set_binomial", "st_set_regression"]);
    const unit = (n: string) => new Set((out.packs[n][0] as SetPack).items.map((i) => i.topic.split(".")[0]));
    expect([...unit("st_set_binomial")]).toEqual(["2"]); expect([...unit("st_set_regression")]).toEqual(["5"]);
  });
  it("each set pack has one shared stimulus, an intro and three independent questions that pass the member and set gates", () => {
    for (const n of out.names) for (const sp of out.packs[n] as SetPack[]) {
      expect(isSetPack(sp)).toBe(true); expect(gateStatsSet(sp)).toEqual([]);
      for (const m of flattenSet(sp, `${n}-k0`)) {
        const mp = { ...m, explanation_en: expl(m) } as McPack;
        const reasons = [...gateMc("ap_statistics", mp), ...calibrateMc("ap_statistics", mp), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp), ...validateBlueprint(m.blueprint as Partial<Blueprint>, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)];
        expect({ n, i: m.set.index, reasons }).toEqual({ n, i: m.set.index, reasons: [] });
        const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_statistics", kind: "mc", payload: m as unknown as Record<string, unknown> });
        expect(g.issues.filter((i) => i.level === "error")).toEqual([]);
      }
    }
  });
  it("merging the three passed members gives one candidate payload that converts to three problems sharing intro and figure", () => {
    const sp = out.packs.st_set_regression[0] as SetPack;
    const members = flattenSet(sp, "ap_statistics-m02-k0").map((m) => ({ ...m, explanation_en: expl(m) }));
    const payload = mergeSet(members);
    expect((payload.items as unknown[]).length).toBe(3);
    const plan = planConversion({ stockKey: "x", candidateKey: "x", apSubjectCode: "ap_statistics", kind: "mc", payload, keywordCode: "5.3", difficultyProvisional: "exam_prep" } as never);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.items.map((i) => i.index)).toEqual([0, 1, 2]);
    expect(new Set(plan.items.map((i) => i.passage)).size).toBe(1); expect(plan.items[0].passage).toContain("least-squares regression line"); expect(plan.items[0].passage).not.toContain("Questions refer");
    expect(plan.items.every((i) => i.figure)).toBe(true);
    expect(plan.items.map((i) => i.topic)).toEqual(["5.3", "5.3", "5.2"]);
  });
});

d("AP Statistics FRQ archetypes (4 questions x 10 one-point rows)", () => {
  const code = "import json,registry as R\nn=R.STATS_STAGES['stats_s2a_frq']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,4,920) for k in n}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {} }) as { names: string[]; packs: Record<string, (FrqPack & { blueprint: Partial<Blueprint> })[]> };
  it("has the four official types", () => { expect(out.names).toEqual(["stfrq_q1_design", "stfrq_q2_regression", "stfrq_q3_prop_test", "stfrq_q4_integrated"]); });
  it("every pack has ten 1-point rows, typed responses, the guide template and passes all deterministic gates", () => {
    for (const n of out.names) for (const p of out.packs[n]) {
      expect(p.total_points).toBe(10); expect(p.parts.flatMap((x) => x.rubric_rows)).toHaveLength(10);
      expect(p.parts.every((x) => ["explain", "calculate"].includes(x.response_mode))).toBe(true);
      const reasons = [...gateFrq("ap_statistics", p, skills, { requirePartTopics: true, topics }), ...calibrateFrq(p, "ap_statistics"), ...gateGuideFrq(statsGuide, p), ...gateMathWrapping(p as never), ...gateStatsFrq(p), ...bundleReferenceChecks(p),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(p as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, reasons }).toEqual({ n, reasons: [] });
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_statistics", kind: "frq_bundle", payload: p as unknown as Record<string, unknown> });
      expect(g.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });
  it("Q1 has the investigative-question part (skill 1.A, topic 1.10, three rows); Q3 covers hypotheses, conditions, statistic and conclusion", () => {
    const q1 = out.packs.stfrq_q1_design[0]; const e = q1.parts.find((x) => x.skill_codes.includes("1.A"))!;
    expect(e.topic_codes).toContain("1.10"); expect(e.rubric_rows).toHaveLength(3);
    const sk = new Set(out.packs.stfrq_q3_prop_test[0].parts.flatMap((x) => x.skill_codes)); for (const s of ["2.E", "4.E", "3.E", "4.G"]) expect(sk.has(s)).toBe(true);
  });
  it("converts to one essay problem whose reference answer states it is not official scoring", () => {
    const p = out.packs.stfrq_q2_regression[0];
    const plan = planConversion({ stockKey: "x", candidateKey: "x", apSubjectCode: "ap_statistics", kind: "frq_bundle", payload: p as unknown as Record<string, unknown>, keywordCode: "5.4", difficultyProvisional: "exam_prep" } as never);
    expect(plan.ok).toBe(true); if (!plan.ok) return;
    expect(plan.items).toHaveLength(1); expect(plan.items[0].format).toBe("essay"); expect(plan.items[0].explanationEn).toContain("not official College Board scoring");
    expect((plan.items[0].statements as { mode: string }[]).every((s) => ["explain", "calculate"].includes(s.mode))).toBe(true);
  });
  it("gateStatsFrq rejects a missing investigative part, a 2-point row, drawing input and the wrong total", () => {
    const base = JSON.parse(JSON.stringify(out.packs.stfrq_q1_design[0])) as FrqPack;
    const noInv = JSON.parse(JSON.stringify(base)) as FrqPack; noInv.parts.forEach((x) => { x.skill_codes = x.skill_codes.filter((s) => s !== "1.A"); if (!x.skill_codes.length) x.skill_codes = ["2.A"]; });
    expect(gateStatsFrq(noInv)).toContain("q1_missing_investigative_question_part_1A_topic_1.10");
    const two = JSON.parse(JSON.stringify(base)) as FrqPack; two.parts[0].rubric_rows[0].points = 2; expect(gateStatsFrq(two)).toContain("stats_frq_row_not_one_point");
    const draw = JSON.parse(JSON.stringify(base)) as FrqPack; draw.parts[1].prompt += " Sketch a boxplot."; expect(gateStatsFrq(draw)).toContain("stats_frq_part_B_needs_drawing_input");
    const tot = JSON.parse(JSON.stringify(base)) as FrqPack; tot.total_points = 9; expect(gateStatsFrq(tot)).toContain("stats_frq_points_9_not_10");
  });
});

describe("shared-set gates and verdict", () => {
  const mk = (): SetPack => ({
    archetype: "st_set_x", topic: "2.9", skill: "3.D", calculator: "allowed", set_intro: "Questions refer to the following information. A shared scenario with enough words to count as an intro.", stimulus: { kind: "stat_chart", description: "d", data: { chart: "table" } },
    set_size: 3, est_seconds: 240, facts: [], items: [0, 1, 2].map((i) => ({ archetype: `st_set_x_q${i + 1}`, topic: "2.9", skill: "3.D", calculator: "allowed", stem: `Question number ${i + 1} about the shared data?`, options: ["Answer alpha number one", "Answer beta number two", "Answer gamma number three", "Answer delta number four"].map((t) => ({ text: t, why: "named misconception text", value: null })), key_index: i, est_seconds: 80, facts: [] })),
  });
  it("accepts a well-formed set", () => expect(gateStatsSet(mk())).toEqual([]));
  it("rejects wrong size, missing shared stimulus, duplicate questions, spanning units and answer leaks", () => {
    const two = mk(); two.items.pop(); expect(gateStatsSet(two)[0]).toMatch(/set_size_2/);
    const ns = mk(); ns.stimulus = { kind: "none", description: "", data: {} }; expect(gateStatsSet(ns)).toContain("set_without_shared_stimulus");
    const dup = mk(); dup.items[1].stem = dup.items[0].stem; expect(gateStatsSet(dup)).toContain("set_duplicate_question");
    const span = mk(); span.items[2].topic = "5.3"; expect(gateStatsSet(span).some((x) => x.startsWith("set_spans_units"))).toBe(true);
    const leak = mk(); leak.items[1].stem = "Since the answer is Answer alpha number one, what next?"; expect(gateStatsSet(leak)).toContain("set_item_2_stem_contains_item_1_answer");
  });
  it("a set passes only when all three members pass; one failure rejects the whole set with the member number", () => {
    expect(setVerdict([{ passed: true, reasons: [] }, { passed: true, reasons: [] }, { passed: true, reasons: [] }]).passed).toBe(true);
    const v = setVerdict([{ passed: true, reasons: [] }, { passed: false, reasons: ["solver_disagrees"] }, { passed: true, reasons: [] }]);
    expect(v.passed).toBe(false); expect(v.reasons).toEqual(["set_item_2:solver_disagrees"]);
    expect(setVerdict([{ passed: true, reasons: [] }]).passed).toBe(false);
  });
  it("member keys map back to the set key", () => expect(baseKeyOf("ap_statistics-m16-k0-q2")).toBe("ap_statistics-m16-k0"));
});
