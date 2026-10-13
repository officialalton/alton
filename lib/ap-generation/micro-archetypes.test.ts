import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateFrq, calibrateMc, gateMc, gateFrq, NOT_ASSESSED_MC, OPTION_COUNT, type McPack, type FrqPack } from "./gates";
import { gateMicroFrq } from "./micro-frq-checks";
import { bundleReferenceChecks } from "./part-refine";
import { generatorDefects } from "./generator-defects";
import { microGuide } from "./subjects/micro";
import { subjectToolsConfig } from "../exam-tools/subject-tools";
import { AP_FRQ_DELIVERY } from "../ap-exam/frq-delivery";
import { MICRO_FRQ_PROFILES } from "../ap-exam/micro-rules";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Microeconomics P0 원형 테스트(무료: 네트워크·DB·LLM 없음). 수치 진실·결정성·단원/스킬 범위 정수계획·FRQ 과제 유형 비중은 Python unittest(test_micro_p0.py)가 하고, 여기서는 TS 게이트·가이드 일관성·도구 구성을 확인한다.
const SEEDS = Number(process.env.MICRO_SEEDS ?? 2);
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_microeconomics.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topics = new Set(curriculum.units.flatMap((u) => u.topics.map((t) => t.code)));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

type Pk = McPack & { blueprint: Partial<Blueprint> };
const expl = (p: McPack) => `The correct answer is ${p.options[p.key_index].text}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${x.text} is incorrect: ${x.why}`).join("\n");

d("AP Microeconomics P0 archetypes (Python generators, 2 seeds each)", () => {
  const code = "import json,registry as R\nn=R.MICRO_STAGES['micro_mc_all']\nf=R.MICRO_STAGES['micro_frq']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k," + SEEDS + ",500) for k in n},'frqPacks':{k:R.batch(k," + SEEDS + ",500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, FrqPack[]> };

  it("registers the MC archetypes, covers all 6 units, and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names.length).toBeGreaterThanOrEqual(90);
    expect(microGuide.archetypes.map((a) => a.id)).toEqual(out.names.map((n) => out.packs[n][0].archetype));
    const units = new Set(out.names.map((n) => String(out.packs[n][0].topic).split(".")[0]));
    expect([...units].sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("every MC pack passes the deterministic gates (five options) and the blueprint", () => {
    const fails: { n: string; reasons: string[] }[] = [];
    for (const n of out.names) for (const p of out.packs[n]) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_microeconomics", mp), ...calibrateMc("ap_microeconomics", mp), ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      if (reasons.length) fails.push({ n, reasons });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_microeconomics);
      expect(NOT_ASSESSED_MC.ap_microeconomics).not.toContain(p.skill);
    }
    expect(fails).toEqual([]);
  });

  it("graph and payoff-matrix stimuli pass the figure gate (ap_graph:econ_curves, ap_table:payoff_matrix)", () => {
    let graphs = 0, matrices = 0, tables = 0;
    const fails: { n: string; status: string; err: string[] }[] = [];
    for (const n of out.names) for (const p of out.packs[n]) {
      if (p.stimulus.kind !== "graph" && p.stimulus.kind !== "payoff_matrix" && p.stimulus.kind !== "table") continue;
      if (p.stimulus.kind === "graph") graphs++; else if (p.stimulus.kind === "payoff_matrix") matrices++; else tables++;
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_microeconomics", kind: "mc", payload: p as unknown as Record<string, unknown> });
      const err = g.issues.filter((i) => i.level === "error").map((i) => `${i.code}:${i.message}`);
      if (g.status !== "pass" || err.length) fails.push({ n, status: g.status, err });
    }
    expect(fails).toEqual([]);
    expect(graphs).toBeGreaterThanOrEqual(20);
    expect(matrices).toBeGreaterThanOrEqual(3);
    expect(tables).toBeGreaterThanOrEqual(20);
  });

  it("registers the FRQ types (long 10 / short 5) and passes the FRQ gates", () => {
    expect(out.frq.length).toBeGreaterThanOrEqual(8);
    const fails: { n: string; what: string; codes: string[] }[] = [];
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      expect([10, 5]).toContain(p.total_points);
      const chk: Record<string, string[]> = {
        blueprint: validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code),
        free: gateMicroFrq(p as unknown as Record<string, unknown>, { topics, skills }).map((x) => `${x.code}:${x.message}`),
        ref: bundleReferenceChecks(p),
        gate: [...gateFrq("ap_microeconomics", p, skills, { requirePartTopics: true, topics }), ...calibrateFrq(p, "ap_microeconomics")],
      };
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_microeconomics", kind: "frq_bundle", payload: p as unknown as Record<string, unknown> });
      chk.figure = g.issues.filter((i) => i.level === "error").map((i) => i.code);
      for (const [what, codes] of Object.entries(chk)) if (codes.length) fails.push({ n, what, codes });
    }
    expect(fails).toEqual([]);
  });

  it("the task-type point profiles in micro-rules.ts equal the profiles computed from the generated FRQ packs", () => {
    const type: Record<string, "graph" | "assertion" | "explain" | "numeric"> = { draw: "graph", identify: "assertion", select: "assertion", explain: "explain", calculate: "numeric" };
    for (const n of out.frq) {
      const p = out.frqPacks[n][0]; const tot = { points: 0, graph: 0, assertion: 0, explain: 0, numeric: 0 };
      for (const pt of p.parts) { tot.points += pt.points; tot[type[pt.response_mode]] += pt.points; }
      expect({ n, tot }).toEqual({ n, tot: MICRO_FRQ_PROFILES[n] });
    }
  });

  it("the Python suite (determinism, no duplicate structures, numeric truth, graph checks, unit/skill/FRQ-task range checks) passes", () => {
    const t = spawnSync(PY, ["-B", "-m", "unittest", "test_micro_p0"], { cwd: ARCH, encoding: "utf-8", timeout: 170000 });
    expect({ status: t.status, tail: (t.stderr || "").split("\n").slice(-6).join("\n") }).toEqual({ status: 0, tail: expect.stringContaining("OK") });
  }, 180000);
});

describe("microGuide and exam tools", () => {
  it("lists 6 units whose MC weights bracket 100 percent and the 13 CED skill codes", () => {
    expect(microGuide.units).toHaveLength(6);
    expect(microGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(microGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(microGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(microGuide.skills.filter((s) => !s.mc).map((s) => s.code)).toEqual(NOT_ASSESSED_MC.ap_microeconomics);
    expect(microGuide.units.find((u) => u.unit === "3")?.mcWeight).toEqual([22, 25]);
  });
  it("is a hybrid subject: paper FRQ, five options, a four-function calculator and the micro reference panel", () => {
    expect(AP_FRQ_DELIVERY.ap_microeconomics).toBe("paper");
    expect(OPTION_COUNT.ap_microeconomics).toBe(5);
    expect(subjectToolsConfig("ap_microeconomics")).toEqual({ calculatorTabs: ["basic"], reference: "microeconomics" });
  });
});
