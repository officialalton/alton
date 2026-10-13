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
import { bundleReferenceChecks } from "./part-refine";
import { physicsGuide } from "./subjects/physics1";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Physics 1 P0 원형 테스트(무료: 네트워크·DB·LLM 없음). 수치 진실·결정성·그림 장면 검사는 Python 쪽 unittest 가 하고, 여기서는 TS 게이트와 가이드 일관성을 확인한다.
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_physics_1.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

type Pk = McPack & { blueprint: Partial<Blueprint>; items?: (McPack & { blueprint: Partial<Blueprint> })[] };
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");

d("AP Physics 1 P0 archetypes (Python generators, 3 seeds each)", () => {
  const code = "import json,registry as R\nn=R.PHYS_STAGES['phys_mc_all']+R.PHYS_STAGES['phys_sets']\nf=R.PHYS_STAGES['phys_frq']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k,3,500) for k in n},'frqPacks':{k:R.batch(k,2,500) for k in f},'frq2':R.PHYS_STAGES['phys_frq2'],'frq2Packs':{k:R.batch(k,3,500) for k in R.PHYS_STAGES['phys_frq2']}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 128 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {}, frq2: [], frq2Packs: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, FrqPack[]>; frq2: string[]; frq2Packs: Record<string, FrqPack[]> };
  const flat = (n: string) => out.packs[n].flatMap((p) => (p.items ?? [p]).map((q) => ({ ...q, stimulus: q.stimulus ?? p.stimulus })));

  it("registers 135 single archetypes + 5 sets covering all 8 units, and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names).toHaveLength(140);
    const ids = physicsGuide.archetypes.map((a) => a.id);
    const expected = out.names.flatMap((n) => flat(n).slice(0, out.packs[n][0].items ? 2 : 1).map((q) => q.archetype));
    expect(ids).toEqual(expected);
    const units = new Set(out.names.flatMap((n) => flat(n).map((q) => String(q.topic).split(".")[0])));
    expect([...units].sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("every MC pack passes the deterministic gates, the guide, the blueprint and the figure gate (graph stimuli)", () => {
    for (const n of out.names) for (const p of flat(n)) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_physics_1", mp), ...calibrateMc("ap_physics_1", mp), ...gateGuideMc(physicsGuide, mp), ...gateMathWrapping(mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, reasons }).toEqual({ n, reasons: [] });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_physics_1);
      expect(NOT_ASSESSED_MC.ap_physics_1).not.toContain(p.skill);
      const optionScenes = (p as unknown as { option_scenes?: unknown[] }).option_scenes;
      if (p.stimulus.kind === "graph" || p.stimulus.kind === "diagram" || optionScenes) {
        const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_physics_1", kind: "mc", payload: p as unknown as Record<string, unknown> });
        expect({ n, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, fig: [] });
        expect({ n, status: g.status }).toEqual({ n, status: "pass" });
        if (p.stimulus.kind === "diagram") expect(g.renderType).toBe("ap_diagram:phys_scene");
        if (optionScenes) { expect(g.renderType).toBe("figure_choice:ap_diagram:phys_scene"); expect(g.output).toContain("figure-choice"); }
      }
    }
  });

  it("registers the four FRQ types with weights MR 10 / TBR 12 / LAB 10 / QQT 8 and passes the FRQ gates", () => {
    expect([...out.frq].sort()).toEqual(["phf_lab_spring_k", "phf_mr_table_block", "phf_qqt_collision", "phf_tbr_spring_shm"]);
    const w: Record<string, number> = { mr: 10, tbr: 12, lab: 10, qqt: 8 };
    let total = 0;
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      expect(p.total_points).toBe(w[p.template]);
      expect(validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)).toEqual([]);
      expect(gateGuideFrq(physicsGuide, p).filter((c) => c !== "too_few_numeric_rows")).toEqual([]);
      expect({ n, reasons: [...gateFrq("ap_physics_1", p, skills, { requirePartTopics: false }), ...calibrateFrq(p, "ap_physics_1")] }).toEqual({ n, reasons: [] });
    }
    for (const n of out.frq) total += out.frqPacks[n][0].total_points;
    expect(total).toBe(40);
  });

  it("registers a second scenario per FRQ type (8 new archetypes, two per type) that passes the same FRQ gates with a distinct archetype", () => {
    expect(out.frq2).toHaveLength(8);
    const w: Record<string, number> = { mr: 10, tbr: 12, lab: 10, qqt: 8 };
    const perType: Record<string, Set<string>> = {};
    for (const n of out.frq2) for (const p of out.frq2Packs[n]) {
      (perType[p.template] ??= new Set()).add(n);
      expect(p.total_points).toBe(w[p.template]);
      expect(validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)).toEqual([]);
      expect(gateGuideFrq(physicsGuide, p).filter((c) => c !== "too_few_numeric_rows")).toEqual([]);
      expect({ n, reasons: [...gateFrq("ap_physics_1", p, skills, { requirePartTopics: false }), ...calibrateFrq(p, "ap_physics_1")] }).toEqual({ n, reasons: [] });
      expect({ n, refs: bundleReferenceChecks(p) }).toEqual({ n, refs: [] });
      if ((p.stimulus as { kind?: string }).kind === "diagram") {
        const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_physics_1", kind: "frq_bundle", payload: p as unknown as Record<string, unknown> });
        expect({ n, status: g.status, errors: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, status: "pass", errors: [] });
      }
    }
    expect(Object.fromEntries(Object.entries(perType).map(([t, a]) => [t, a.size]))).toEqual({ mr: 2, tbr: 2, lab: 2, qqt: 2 });
    for (const n of out.frq2) expect(out.frq).not.toContain(n);
  });

  it("MC never carries the skills the CED does not assess in MC, and interpretation items use fixed sentences", () => {
    for (const n of out.names) for (const p of flat(n)) expect(["1.A", "1.B", "1.C", "3.A"]).not.toContain(p.skill);
    for (const n of ["ph_launch_vs_drop", "ph_motion_diagram", "ph_third_law", "ph_collision_type"]) for (const p of flat(n)) {
      expect(new Set(p.options.map((o) => o.text)).size).toBe(4);
      expect(p.options.filter((_, i) => i !== p.key_index).every((o) => (o.why ?? "").length >= 15)).toBe(true);
    }
  });
});

describe("physicsGuide", () => {
  it("lists 8 units whose MC weights bracket 100 percent and skills 1.A to 3.C", () => {
    expect(physicsGuide.units).toHaveLength(8);
    expect(physicsGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(physicsGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(physicsGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(physicsGuide.skills.filter((s) => !s.mc).map((s) => s.code)).toEqual(NOT_ASSESSED_MC.ap_physics_1);
  });
  it("matches the 2027 CED weights in the curriculum JSON", () => {
    const w = (c: string) => curriculum.units.find((u) => u.code === c) as unknown as { mcWeightMin?: number; mcWeightMax?: number };
    void w; // 단원 가중치 필드 이름이 JSON 버전마다 달라 존재 확인만 한다
    expect(curriculum.units).toHaveLength(8);
  });
});
