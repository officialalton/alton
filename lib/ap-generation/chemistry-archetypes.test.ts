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
import { chemistryGuide } from "./subjects/chem";
import { setSizeOf } from "./stats-set";
import { subjectToolsConfig } from "../exam-tools/subject-tools";
import { AP_FRQ_DELIVERY } from "../ap-exam/frq-delivery";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Chemistry P0 원형 테스트(무료: 네트워크·DB·LLM 없음). 수치 진실·결정성·그림 장면·스킬 범위 정수계획은 Python unittest(test_chem_p0.py)가 하고, 여기서는 TS 게이트·가이드 일관성·도구 구성을 확인한다.
const SEEDS = Number(process.env.CHEM_SEEDS ?? 2); // 기본 2 시드(빠름), 점검 때 CHEM_SEEDS=12 로 넓힌다
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_chemistry.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

type Pk = McPack & { blueprint: Partial<Blueprint>; items?: (McPack & { blueprint: Partial<Blueprint> })[] };
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");

d("AP Chemistry P0 archetypes (Python generators, 2 seeds each)", () => {
  const code = "import json,registry as R\nn=R.CHEM_STAGES['chem_mc_all']+R.CHEM_STAGES['chem_sets']\nf=R.CHEM_STAGES['chem_frq']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k," + SEEDS + ",500) for k in n},'frqPacks':{k:R.batch(k," + SEEDS + ",500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, FrqPack[]> };
  const flat = (n: string) => out.packs[n].flatMap((p) => (p.items ?? [p]).map((q) => ({ ...q, stimulus: q.stimulus ?? p.stimulus })));

  it("registers the singles and the 3 two-item sets, covers all 9 units, and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names.filter((n) => n.startsWith("ch_")).length).toBeGreaterThanOrEqual(90);
    expect(out.names.filter((n) => n.startsWith("chs_"))).toHaveLength(3);
    const ids = chemistryGuide.archetypes.map((a) => a.id);
    const expected = out.names.flatMap((n) => flat(n).slice(0, out.packs[n][0].items ? 2 : 1).map((q) => q.archetype));
    expect(ids).toEqual(expected);
    const units = new Set(out.names.flatMap((n) => flat(n).map((q) => String(q.topic).split(".")[0])));
    expect([...units].sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("every MC pack passes the deterministic gates, the guide and the blueprint", () => {
    for (const n of out.names) for (const p of flat(n)) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_chemistry", mp), ...calibrateMc("ap_chemistry", mp), ...gateGuideMc(chemistryGuide, mp), ...gateMathWrapping(mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, reasons }).toEqual({ n, reasons: [] });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_chemistry);
      expect(NOT_ASSESSED_MC.ap_chemistry).not.toContain(p.skill);
    }
  });

  it("graph stimuli pass the existing ap_graph figure gate (diagram variants have no TS renderer yet)", () => {
    let graphs = 0;
    for (const n of out.names) for (const p of flat(n)) {
      if (p.stimulus.kind !== "graph") continue;
      graphs++;
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_chemistry", kind: "mc", payload: p as unknown as Record<string, unknown> });
      expect({ n, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, fig: [] });
      expect({ n, status: g.status }).toEqual({ n, status: "pass" });
    }
    expect(graphs).toBeGreaterThanOrEqual(10);
  });

  it("registers the 7 FRQ types (3 long x 10 + 4 short x 4 = 46 points) and passes the FRQ gates", () => {
    expect([...out.frq].sort()).toEqual(["chf_long_kinetics", "chf_long_thermo", "chf_long_titration", "chf_short_bonding", "chf_short_equilibrium", "chf_short_pes", "chf_short_stoich"]);
    const w: Record<string, number> = { long: 10, short: 4 };
    let total = 0;
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      expect(p.total_points).toBe(w[p.template]);
      expect(validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)).toEqual([]);
      expect(gateGuideFrq(chemistryGuide, p).filter((c) => c !== "too_few_numeric_rows")).toEqual([]);
      expect({ n, reasons: [...gateFrq("ap_chemistry", p, skills, { requirePartTopics: false }), ...calibrateFrq(p, "ap_chemistry")] }).toEqual({ n, reasons: [] });
    }
    for (const n of out.frq) total += out.frqPacks[n][0].total_points;
    expect(total).toBe(46);
  });

  it("the Python suite (determinism, no duplicate structures, numeric truth, figure checks, skill/unit range ILP) passes", () => {
    const t = spawnSync(PY, ["-B", "-m", "unittest", "test_chem_p0"], { cwd: ARCH, encoding: "utf-8", timeout: 170000 });
    expect({ status: t.status, tail: (t.stderr || "").split("\n").slice(-6).join("\n") }).toEqual({ status: 0, tail: expect.stringContaining("OK") });
  }, 180000);
});

describe("chemistryGuide and exam tools", () => {
  it("lists 9 units whose MC weights bracket 100 percent and the 28 CED skill codes", () => {
    expect(chemistryGuide.units).toHaveLength(9);
    expect(chemistryGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(chemistryGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(chemistryGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(chemistryGuide.skills.filter((s) => !s.mc).map((s) => s.code)).toEqual(NOT_ASSESSED_MC.ap_chemistry);
    expect(chemistryGuide.units.find((u) => u.unit === "3")?.mcWeight).toEqual([18, 22]);
    expect(chemistryGuide.units.find((u) => u.unit === "8")?.mcWeight).toEqual([11, 15]);
  });
  it("is a hybrid subject: paper FRQ, two-item sets, scientific calculator and a chemistry reference panel", () => {
    expect(AP_FRQ_DELIVERY.ap_chemistry).toBe("paper");
    expect(setSizeOf("ap_chemistry")).toBe(2);
    expect(subjectToolsConfig("ap_chemistry")).toEqual({ calculatorTabs: ["scientific"], reference: "chemistry" });
  });
});
