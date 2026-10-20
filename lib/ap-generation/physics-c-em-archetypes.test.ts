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
import { physicsCEmGuide } from "./subjects/physics-c-em";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Physics C: Electricity and Magnetism 원형 테스트(무료: 네트워크·DB·LLM 없음). 수치 진실은 Python 원형 안의 이중 경로 검사가 보장하고, 여기서는 TS 게이트·설계도·가이드 일관성을 확인한다.
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const SUBJECT = "ap_physics_c_electricity_and_magnetism";
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, `../../data/ap/curriculum-2027/${SUBJECT}.json`), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

type Pk = McPack & { blueprint: Partial<Blueprint>; items?: (McPack & { blueprint: Partial<Blueprint> })[] };
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");

d("AP Physics C: Electricity and Magnetism archetypes (Python generators, 3 seeds each)", () => {
  const code = "import json,registry as R\nn=R.PHYSE_STAGES['physe_mc_all']+R.PHYSE_STAGES['physe_sets_all']\nf=R.PHYSE_STAGES['physe_frq_all']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k,3,500) for k in n},'frqPacks':{k:R.batch(k,2,500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 128 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, FrqPack[]> };
  const flat = (n: string) => out.packs[n].flatMap((p) => (p.items ?? [p]).map((q) => ({ ...q, stimulus: q.stimulus ?? p.stimulus })));

  it("registers the single and set archetypes covering all 6 units (8-13), and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names.length).toBeGreaterThanOrEqual(224); // 1차 저작: 단독 121 + 2문항 세트 6(이후 라운드가 더한다)
    const ids = physicsCEmGuide.archetypes.map((a) => a.id);
    const expected = out.names.flatMap((n) => flat(n).slice(0, out.packs[n][0].items ? 2 : 1).map((q) => q.archetype));
    expect(ids).toEqual(expected);
    const units = new Set(out.names.flatMap((n) => flat(n).map((q) => String(q.topic).split(".")[0])));
    expect([...units].sort()).toEqual(["10", "11", "12", "13", "8", "9"]);
  });

  it("every MC pack passes the deterministic gates, the guide, the blueprint and the figure gate", () => {
    const fails: { n: string; reasons: string[] }[] = [];
    for (const n of out.names) for (const p of flat(n)) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc(SUBJECT, mp), ...calibrateMc(SUBJECT, mp), ...gateGuideMc(physicsCEmGuide, mp), ...gateMathWrapping(mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      if (reasons.length) fails.push({ n, reasons });
      expect(p.options).toHaveLength(OPTION_COUNT[SUBJECT]);
      expect(NOT_ASSESSED_MC[SUBJECT]).not.toContain(p.skill);
      if (p.stimulus.kind === "graph" || p.stimulus.kind === "diagram") {
        const g = gateCandidate({ candidateKey: n, apSubjectCode: SUBJECT, kind: "mc", payload: p as unknown as Record<string, unknown> });
        expect({ n, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, fig: [] });
        expect({ n, status: g.status }).toEqual({ n, status: "pass" });
      }
    }
    expect([...new Set(fails.map((f) => `${f.n}:${f.reasons.join("|")}`))]).toEqual([]);
  });

  it("registers the FRQ scenarios, an equal number per type, with weights MR 10 / TBR 12 / LAB 10 / QQT 8 and passes the FRQ gates", () => {
    expect(out.frq.length).toBeGreaterThanOrEqual(20);
    const w: Record<string, number> = { mr: 10, tbr: 12, lab: 10, qqt: 8 };
    const perType: Record<string, Set<string>> = {};
    const fails: { n: string; reasons: string[] }[] = [];
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      (perType[p.template] ??= new Set()).add(n);
      expect(p.total_points).toBe(w[p.template]);
      expect(validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)).toEqual([]);
      expect(gateGuideFrq(physicsCEmGuide, p).filter((c) => c !== "too_few_numeric_rows")).toEqual([]);
      const reasons = [...gateFrq(SUBJECT, p, skills, { requirePartTopics: false }), ...calibrateFrq(p, SUBJECT), ...bundleReferenceChecks(p)]; if (reasons.length) fails.push({ n, reasons });
    }
    expect([...new Set(fails.map((f) => `${f.n}:${f.reasons.join("|")}`))]).toEqual([]);
    expect(Object.fromEntries(Object.entries(perType).map(([t, a]) => [t, a.size]))).toEqual({ mr: out.frq.length / 4, tbr: out.frq.length / 4, lab: out.frq.length / 4, qqt: out.frq.length / 4 });
  });

  it("MC never carries the skills not assessed in MC, and claim items use fixed sentences", () => {
    for (const n of out.names) for (const p of flat(n)) expect(["1.A", "1.B", "1.C", "3.A"]).not.toContain(p.skill);
    for (const n of ["pe_charging_induction_claim", "pe_flux_outside_charge_claim", "pe_conductor_field_claim", "pe_lenz_direction_claim"]) for (const p of flat(n)) {
      expect(new Set(p.options.map((o) => o.text)).size).toBe(4);
      expect(p.options.filter((_, i) => i !== p.key_index).every((o) => (o.why ?? "").length >= 15)).toBe(true);
    }
  });
});

describe("physicsCEmGuide", () => {
  it("lists 6 units whose MC weights bracket 100 percent and the official skills", () => {
    expect(physicsCEmGuide.units).toHaveLength(6);
    expect(physicsCEmGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(physicsCEmGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(physicsCEmGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(physicsCEmGuide.skills.filter((s) => !s.mc).map((s) => s.code)).toEqual(NOT_ASSESSED_MC[SUBJECT]);
    expect(curriculum.units).toHaveLength(6);
  });
});
