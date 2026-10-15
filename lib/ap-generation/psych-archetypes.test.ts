import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateFrq, calibrateMc, gateMc, gateFrq, NOT_ASSESSED_MC, OPTION_COUNT, type McPack, type FrqPack } from "./gates";
import { bundleReferenceChecks } from "./part-refine";
import { generatorDefects } from "./generator-defects";
import { flattenSet, gateStatsSet, setSizeOf, type SetPack } from "./stats-set";
import { gatePsychFrq } from "./psych-frq-checks";
import { psychGuide } from "./subjects/psych";
import { subjectToolsConfig } from "../exam-tools/subject-tools";
import { AP_FRQ_DELIVERY } from "../ap-exam/frq-delivery";
import { AP_LAYOUTS } from "../ap-exam/layouts";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Psychology 원형 테스트(무료: 네트워크·DB·LLM 없음). 결정성·변형 다양성·통계 정답의 독립 재계산·FRQ 숫자 일관성은 Python unittest(test_psych_p0.py)가 하고, 여기서는 TS 게이트·가이드 일관성·그림 게이트·과목 도구를 본다.
const SEEDS = Number(process.env.PSYCH_SEEDS ?? 2);
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_psychology.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topics = new Set(curriculum.units.flatMap((u) => u.topics.map((t) => t.code)));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

type Pk = McPack & { blueprint: Partial<Blueprint> };
type SetPk = SetPack & { items: Pk[] };
const expl = (p: McPack) => `The correct answer is ${p.options[p.key_index].text}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${x.text} is incorrect: ${x.why}`).join("\n");

d("AP Psychology archetypes (Python generators, 2 seeds each)", () => {
  const code = "import json,registry as R\nn=R.PSYCH_STAGES['psych_mc_all']\ns=R.PSYCH_STAGES['psych_sets']\nf=R.PSYCH_STAGES['psych_frq']\nprint(json.dumps({'names':n,'sets':s,'frq':f,'packs':{k:R.batch(k," + SEEDS + ",500) for k in n},'setPacks':{k:R.batch(k,1,500) for k in s},'frqPacks':{k:R.batch(k,1,500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], sets: [], frq: [], packs: {}, setPacks: {}, frqPacks: {} }) as { names: string[]; sets: string[]; frq: string[]; packs: Record<string, Pk[]>; setPacks: Record<string, SetPk[]>; frqPacks: Record<string, FrqPack[]> };

  it("registers the archetypes, covers all 5 units, and the guide JSON lists the same ids (sets as <id>_q1..q3)", () => {
    expect(r.status).toBe(0);
    expect(out.names.length).toBeGreaterThanOrEqual(150);
    expect(out.sets.length).toBeGreaterThanOrEqual(20);
    const ids = [...out.names.map((n) => out.packs[n][0].archetype), ...out.sets.flatMap((n) => out.setPacks[n][0].items.map((i) => i.archetype))];
    expect(psychGuide.archetypes.map((a) => a.id)).toEqual(ids);
    const units = new Set(psychGuide.archetypes.map((a) => String(a.topic).split(".")[0]));
    expect([...units].sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("every single MC pack passes the deterministic gates (four options, no 4.x skill) and the blueprint", () => {
    const fails: { n: string; reasons: string[] }[] = [];
    for (const n of out.names) for (const p of out.packs[n]) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_psychology", mp), ...calibrateMc("ap_psychology", mp), ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      if (reasons.length) fails.push({ n, reasons });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_psychology);
      expect(NOT_ASSESSED_MC.ap_psychology).not.toContain(p.skill);
    }
    expect(fails).toEqual([]);
  });

  it("every shared set (3 items, one unit) passes the set gate and each flattened item passes the MC gates", () => {
    expect(setSizeOf("ap_psychology")).toBe(3);
    const fails: { n: string; reasons: string[] }[] = [];
    for (const n of out.sets) {
      const sp = out.setPacks[n][0];
      const reasons = [...gateStatsSet(sp, { size: 3 })];
      flattenSet(sp, `x-${n}`).forEach((m, j) => {
        const mp = { ...m, explanation_en: expl(m) } as McPack;
        reasons.push(...gateMc("ap_psychology", mp).map((x) => `q${j + 1}:${x}`), ...calibrateMc("ap_psychology", mp).map((x) => `q${j + 1}:${x}`), ...validateBlueprint((m as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => `q${j + 1}:${x.code}`));
      });
      if (reasons.length) fails.push({ n, reasons });
    }
    expect(fails).toEqual([]);
  });

  it("table and chart stimuli pass the figure gate", () => {
    let figs = 0;
    const fails: { n: string; status: string; err: string[] }[] = [];
    const all: [string, Record<string, unknown>][] = [...out.names.flatMap((n) => out.packs[n].map((p) => [n, p as unknown as Record<string, unknown>] as [string, Record<string, unknown>])), ...out.sets.map((n) => [n, { ...out.setPacks[n][0], stem: out.setPacks[n][0].items[0].stem, options: out.setPacks[n][0].items[0].options } as unknown as Record<string, unknown>] as [string, Record<string, unknown>])];
    for (const [n, p] of all) {
      const kind = (p.stimulus as { kind: string }).kind;
      if (kind !== "table" && kind !== "stat_chart") continue;
      figs++;
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_psychology", kind: "mc", payload: p });
      const err = g.issues.filter((i) => i.level === "error").map((i) => `${i.code}:${i.message}`);
      if (g.status !== "pass" || err.length) fails.push({ n, status: g.status, err });
    }
    expect(fails).toEqual([]);
    expect(figs).toBeGreaterThanOrEqual(20);
  });

  it("registers the FRQ scenarios (4 Article Analysis + 4 Evidence-Based) and passes the FRQ gates", () => {
    expect(out.frq.length).toBe(8);
    const fails: { n: string; what: string; codes: string[] }[] = [];
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      expect(p.total_points).toBe(7);
      const chk: Record<string, string[]> = {
        blueprint: validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code),
        free: gatePsychFrq(p as unknown as Record<string, unknown>).map((x) => x.code),
        ref: bundleReferenceChecks(p),
        gate: [...gateFrq("ap_psychology", p, skills, { requirePartTopics: true, topics }), ...calibrateFrq(p, "ap_psychology")],
      };
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_psychology", kind: "frq_bundle", payload: p as unknown as Record<string, unknown> });
      chk.figure = g.issues.filter((i) => i.level === "error").map((i) => i.code);
      for (const [what, codes] of Object.entries(chk)) if (codes.length) fails.push({ n, what, codes });
    }
    expect(fails).toEqual([]);
  });

  it("the Python suite (determinism, variants, key position balance, statistics recomputation, FRQ numbers) passes", () => {
    const t = spawnSync(PY, ["-B", "-m", "unittest", "test_psych_p0"], { cwd: ARCH, encoding: "utf-8", timeout: 170000 });
    expect({ status: t.status, tail: (t.stderr || "").split("\n").slice(-6).join("\n") }).toEqual({ status: 0, tail: expect.stringContaining("OK") });
  }, 180000);
});

describe("psychGuide, exam layout and exam tools", () => {
  it("lists 5 units whose MC weights bracket 100 percent and the 11 CED skill codes; 4.x are not assessed in MC", () => {
    expect(psychGuide.units).toHaveLength(5);
    expect(psychGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(psychGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(psychGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(psychGuide.skills.filter((s) => !s.mc).map((s) => s.code)).toEqual(NOT_ASSESSED_MC.ap_psychology);
    expect(psychGuide.units.every((u) => u.mcWeight[0] === 15 && u.mcWeight[1] === 25)).toBe(true);
  });
  it("is 75 MC with four options in 90 minutes and 2 FRQ in 70 minutes, typed answers, no calculator and no reference panel (the CED lists neither)", () => {
    const l = AP_LAYOUTS.ap_psychology;
    expect(l.map((s) => [s.kind, s.count, s.minutes, s.options ?? null])).toEqual([["mc", 75, 90, 4], ["frq", 2, 70, null]]);
    expect(AP_FRQ_DELIVERY.ap_psychology).toBe("digital");
    expect(OPTION_COUNT.ap_psychology).toBe(4);
    expect(subjectToolsConfig("ap_psychology")).toEqual({ calculatorTabs: [], reference: null });
  });
});
