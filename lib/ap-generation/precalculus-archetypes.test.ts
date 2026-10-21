import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateFrq, calibrateMc, gateMc, gateFrq, gateNoCalcExact, OPTION_COUNT, type McPack, type FrqPack } from "./gates";
import { gateGuideMc, gateGuideFrq } from "./guide-gates";
import { gateMathWrapping, answerTextForExplanation } from "./math-wrapping";
import { generatorDefects } from "./generator-defects";
import { bundleReferenceChecks } from "./part-refine";
import { precalcGuide } from "./subjects/precalculus";
import { verifyPreFullComposition, preUnitBounds, PRE_FRQ_TEMPLATES } from "../ap-exam/full-set-rules";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Precalculus 원형 테스트(무료: 네트워크·DB·LLM 없음). 수치 진실은 Python 원형 안의 이중 경로 검사가 보장하고, 여기서는 TS 게이트·설계도·가이드 일관성을 본다.
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const SUBJECT = "ap_precalculus";
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, `../../data/ap/curriculum-2027/${SUBJECT}.json`), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
type Pk = McPack & { blueprint: Partial<Blueprint> };
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect. ${x.why}`).join("\n");

d("AP Precalculus archetypes (Python generators, 2 seeds each)", () => {
  const code = "import json,registry as R\nn=R.PRE_STAGES['pre_mc_all']\nf=R.PRE_STAGES['pre_frq_all']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k,2,500) for k in n},'frqPacks':{k:R.batch(k,2,500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, FrqPack[]> };

  it("registers 200 single MC archetypes over all three units and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names).toHaveLength(200);
    expect(precalcGuide.archetypes.map((a) => a.id)).toEqual(out.names.map((n) => out.packs[n][0].archetype));
    expect([...new Set(out.names.map((n) => String(out.packs[n][0].topic).split(".")[0]))].sort()).toEqual(["1", "2", "3"]);
  }, 180000);

  it("every MC pack passes the deterministic gates, the guide, the blueprint, the figure gate and the calculator split", () => {
    const fails: { n: string; reasons: string[] }[] = [];
    for (const n of out.names) for (const p of out.packs[n]) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc(SUBJECT, mp), ...calibrateMc(SUBJECT, mp), ...gateGuideMc(precalcGuide, mp), ...gateMathWrapping(mp), ...gateNoCalcExact(mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      if (reasons.length) fails.push({ n, reasons });
      expect(p.options).toHaveLength(OPTION_COUNT[SUBJECT]);
      expect(["required", "not_allowed"]).toContain(p.calculator);
      expect(["1", "2"]).toContain(p.skill);
      if (p.stimulus.kind === "graph") {
        const g = gateCandidate({ candidateKey: n, apSubjectCode: SUBJECT, kind: "mc", payload: p as unknown as Record<string, unknown> });
        expect({ n, status: g.status }).toEqual({ n, status: "pass" });
      }
    }
    expect([...new Set(fails.map((f) => `${f.n}:${f.reasons.join("|")}`))]).toEqual([]);
  }, 180000);

  it("registers 22 FRQ scenarios (at least five per type) of 6 points with the calculator split fc/mn required, mp/sy not allowed", () => {
    expect(out.frq).toHaveLength(22);
    const perType: Record<string, Set<string>> = {}; const fails: string[] = [];
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      (perType[p.template] ??= new Set()).add(n);
      expect(p.total_points).toBe(6);
      expect(p.calculator).toBe(p.template === "fc" || p.template === "mn" ? "required" : "not_allowed");
      expect(validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)).toEqual([]);
      expect(gateGuideFrq(precalcGuide, p).filter((c) => c !== "too_few_numeric_rows")).toEqual([]);
      const reasons = [...gateFrq(SUBJECT, p, skills, { requirePartTopics: false }), ...calibrateFrq(p, SUBJECT), ...bundleReferenceChecks(p)]; if (reasons.length) fails.push(`${n}:${reasons.join("|")}`);
    }
    expect(fails).toEqual([]);
    expect(Object.keys(perType).sort()).toEqual([...PRE_FRQ_TEMPLATES].sort());
    for (const t of PRE_FRQ_TEMPLATES) expect(perType[t].size).toBeGreaterThanOrEqual(5);
  }, 180000);
});

describe("precalcGuide and the full-set rules", () => {
  it("lists 3 units whose MC weights bracket 100 percent and matches the official exam structure", () => {
    expect(precalcGuide.units).toHaveLength(3);
    expect(precalcGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(precalcGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(precalcGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(curriculum.units).toHaveLength(3);
    expect(preUnitBounds()).toEqual({ "1": { min: 13, max: 16 }, "2": { min: 11, max: 16 }, "3": { min: 13, max: 14 } });
  });

  it("verifies a full composition: 29 no-calculator + 13 calculator MC, four FRQ types, unit ranges", () => {
    const mc = [...Array.from({ length: 29 }, (_, i) => ({ kind: "mc" as const, unit: String(1 + (i % 3)), calc: "not_allowed", template: null, candidateKey: `a${i}`, position: i + 1 })), ...Array.from({ length: 13 }, (_, i) => ({ kind: "mc" as const, unit: String(1 + (i % 3)), calc: "required", template: null, candidateKey: `b${i}`, position: 30 + i }))];
    const frq = PRE_FRQ_TEMPLATES.map((t, i) => ({ kind: "frq" as const, unit: null, calc: null, template: t, candidateKey: `f${i}`, position: i + 1 }));
    expect(verifyPreFullComposition([...mc, ...frq])).toEqual([]);
    expect(verifyPreFullComposition([...mc.slice(0, 41), ...frq])).toContain("mc_count_41/42");
  });
});
