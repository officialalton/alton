import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateFrq, calibrateMc, gateMc, gateFrq, NOT_ASSESSED_MC, OPTION_COUNT, type McPack, type FrqPack } from "./gates";
import { gateGuideMc, gateGuideFrq } from "./guide-gates";
import { gateMathWrapping, answerTextForExplanation } from "./math-wrapping";
import { generatorDefects } from "./generator-defects";
import { gateBioFrq } from "./bio-frq-checks";
import { biologyGuide } from "./subjects/bio";
import { gateStatsSet, setSizeOf, type SetPack } from "./stats-set";
import { subjectToolsConfig } from "../exam-tools/subject-tools";
import { AP_FRQ_DELIVERY } from "../ap-exam/frq-delivery";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Biology P0 원형 테스트(무료: 네트워크·DB·LLM 없음). 수치 진실·결정성·선택지 구조·스킬 범위 정수계획은 Python unittest(test_bio_p0.py)가 하고, 여기서는 TS 게이트·가이드 일관성·세트·FRQ 게이트·도구 구성을 확인한다.
const SEEDS = Number(process.env.BIO_SEEDS ?? 2);
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_biology.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const topics = new Set(topicUnit.keys());

type Pk = McPack & { blueprint: Partial<Blueprint>; items?: (McPack & { blueprint: Partial<Blueprint> })[] };
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");

d("AP Biology P0 archetypes (Python generators, 2 seeds each)", () => {
  const code = "import json,registry as R\nn=R.BIO_STAGES['bio_mc_all']+R.BIO_STAGES['bio_sets']\nf=R.BIO_STAGES['bio_frq']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k," + SEEDS + ",500) for k in n},'frqPacks':{k:R.batch(k," + SEEDS + ",500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 512 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, FrqPack[]> };
  const flat = (n: string) => out.packs[n].flatMap((p) => (p.items ?? [p]).map((q) => ({ ...q, stimulus: q.stimulus ?? p.stimulus })));

  it("registers the single-item archetypes and the 9 four-item sets, covers all 8 units, and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names.filter((n) => n.startsWith("bi_")).length).toBeGreaterThanOrEqual(160);
    expect(out.names.filter((n) => n.startsWith("bis_"))).toHaveLength(9); // 2026-10-19 bis_n_cellcycle_set 추가
    const ids = biologyGuide.archetypes.map((a) => a.id);
    const expected = out.names.flatMap((n) => flat(n).slice(0, out.packs[n][0].items ? 4 : 1).map((q) => q.archetype));
    expect(ids).toEqual(expected);
    const units = new Set(out.names.flatMap((n) => flat(n).map((q) => String(q.topic).split(".")[0])));
    expect([...units].sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("every MC pack passes the deterministic gates, the guide and the blueprint", () => {
    const bad: { n: string; reasons: string[] }[] = [];
    for (const n of out.names) for (const p of flat(n)) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_biology", mp), ...calibrateMc("ap_biology", mp), ...gateGuideMc(biologyGuide, mp), ...gateMathWrapping(mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      if (reasons.length) bad.push({ n, reasons });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_biology);
      expect(NOT_ASSESSED_MC.ap_biology ?? []).not.toContain(p.skill);
      expect(p.skill).not.toBe("4.A");
    }
    expect(bad).toEqual([]);
  });

  it("every set pack has four items on one unit with a shared stimulus and passes the set gates", () => {
    for (const n of out.names.filter((x) => x.startsWith("bis_"))) for (const p of out.packs[n]) {
      expect({ n, issues: gateStatsSet(p as unknown as SetPack, { size: setSizeOf("ap_biology") }) }).toEqual({ n, issues: [] });
    }
  });

  it("table, graph, bar-chart and strand-diagram stimuli pass the figure gate", () => {
    const seen: Record<string, number> = {};
    const bad: { n: string; kind: string; fig: string[]; status: string }[] = [];
    for (const n of out.names) for (const p of flat(n)) {
      const kind = p.stimulus.kind;
      if (kind === "none" || kind === "text") continue;
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_biology", kind: "mc", payload: p as unknown as Record<string, unknown> });
      seen[kind] = (seen[kind] ?? 0) + 1;
      const fig = g.issues.filter((i) => i.level === "error").map((i) => i.code);
      if (fig.length || !["pass", "not_applicable"].includes(g.status)) bad.push({ n, kind, fig, status: g.status });
    }
    expect(bad).toEqual([]);
    expect(seen.graph).toBeGreaterThanOrEqual(10);
    expect(seen.table).toBeGreaterThanOrEqual(25);
    expect(seen.stat_chart).toBeGreaterThanOrEqual(2);
    expect(seen.diagram).toBeGreaterThanOrEqual(2);
  });

  it("registers the 6 FRQ types (2 long x 9 + 4 short x 4 = 34 points, 28 scenarios) and passes the FRQ gates", () => {
    const byTemplate: Record<string, number> = {};
    const weights: Record<string, number> = { bio_q1_results: 9, bio_q2_graphing: 9, bio_q3_investigation: 4, bio_q4_conceptual: 4, bio_q5_model: 4, bio_q6_data: 4 };
    const bad: { n: string; reasons: string[] }[] = [];
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      byTemplate[p.template] = (byTemplate[p.template] ?? 0) + 1;
      expect(p.total_points).toBe(weights[p.template]);
      const reasons = [...validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => `bp:${x.code}`), ...gateGuideFrq(biologyGuide, p), ...gateFrq("ap_biology", p, skills, { requirePartTopics: true, topics }), ...calibrateFrq(p, "ap_biology"), ...gateBioFrq(p as unknown as Record<string, unknown>, { topics }).map((x) => `bio:${x.code}`)];
      if (reasons.length) bad.push({ n, reasons });
      if (p.total_points === 4) { expect(p.parts).toHaveLength(4); expect(p.parts.every((x) => x.points === 1 && x.rubric_rows.length === 1)).toBe(true); }
    }
    expect(bad).toEqual([]);
    expect(Object.keys(byTemplate).sort()).toEqual(Object.keys(weights).sort());
    expect(out.frq.length).toBeGreaterThanOrEqual(24);
  });

  it("the Python suite (determinism, option structure, numeric truth, coverage ILP for two disjoint exams, FRQ structure) passes", () => {
    const t = spawnSync(PY, ["-B", "-m", "unittest", "test_bio_p0"], { cwd: ARCH, encoding: "utf-8", timeout: 280000 });
    expect({ status: t.status, tail: (t.stderr || "").split("\n").slice(-6).join("\n") }).toEqual({ status: 0, tail: expect.stringContaining("OK") });
  }, 300000);
});

describe("biologyGuide and exam tools", () => {
  it("lists 8 units whose MC weights bracket 100 percent and the 22 CED skill codes", () => {
    expect(biologyGuide.units).toHaveLength(8);
    expect(biologyGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(biologyGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(biologyGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(biologyGuide.skills.filter((s) => !s.mc).map((s) => s.code)).toEqual(["4.A"]);
    expect(biologyGuide.units.find((u) => u.unit === "7")?.mcWeight).toEqual([13, 20]);
  });
  it("is a hybrid subject: paper FRQ, four-item sets, scientific calculator and a biology reference panel", () => {
    expect(AP_FRQ_DELIVERY.ap_biology).toBe("paper");
    expect(setSizeOf("ap_biology")).toBe(4);
    expect(subjectToolsConfig("ap_biology")).toEqual({ calculatorTabs: ["scientific"], reference: "biology" });
  });
});
