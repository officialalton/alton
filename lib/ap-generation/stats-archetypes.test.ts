import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateMc, gateMc, statsMcRules, type McPack } from "./gates";
import { gateGuideMc } from "./guide-gates";
import { gateMathWrapping, answerTextForExplanation } from "./math-wrapping";
import { generatorDefects } from "./generator-defects";
import { statsGuide } from "./subjects/stats";
import { OPTION_COUNT } from "./gates";
import type { ApCurriculumFile } from "../ap-curriculum/types";

const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_statistics.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

d("AP Statistics S1 pilot archetypes (Python, 3 seeds each)", () => {
  const code = "import json,sys,registry as R\nn=R.STATS_STAGES['stats_s1_all']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,3,500) for k in n}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 170000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {} }) as { names: string[]; packs: Record<string, (McPack & { blueprint: Partial<Blueprint> })[]> };
  const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");

  it("registers 20 archetypes in risk order (L 10, M 6, H 4) and the guide JSON lists exactly the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names).toHaveLength(20);
    expect(statsGuide.archetypes.map((a) => a.id)).toEqual(out.names);
    const unit = (id: string) => String(out.packs[id][0].topic).split(".")[0];
    const perUnit: Record<string, number> = {}; for (const n of out.names) perUnit[unit(n)] = (perUnit[unit(n)] ?? 0) + 1;
    expect(perUnit).toEqual({ "1": 5, "2": 5, "3": 4, "4": 3, "5": 3 });
  });
  it("every pack passes the deterministic gates, the blueprint, the stats guide and the figure gate", () => {
    for (const n of out.names) for (const p of out.packs[n]) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_statistics", mp), ...calibrateMc("ap_statistics", mp), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      const g = gateCandidate({ candidateKey: `${n}`, apSubjectCode: "ap_statistics", kind: "mc", payload: p as unknown as Record<string, unknown> });
      expect({ n, reasons, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, reasons: [], fig: [] });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_statistics);
      expect(p.calculator).toBe("allowed");
    }
  });
  it("interpretation items use only fixed sentences (one key, three named misconceptions) and no option letter is referenced", () => {
    for (const n of ["st_ci_interpretation", "st_pvalue_interpretation", "st_slope_interp", "st_confounder"]) for (const p of out.packs[n]) {
      expect(new Set(p.options.map((o) => o.text)).size).toBe(4);
      expect(p.options.filter((_, i) => i !== p.key_index).every((o) => (o.why ?? "").length >= 15)).toBe(true);
    }
  });
});

describe("statsMcRules", () => {
  const base = (o: Partial<McPack>): McPack => ({ archetype: "x", topic: "2.11", skill: "3.C", calculator: "allowed", stem: "Round to three decimal places. What is the probability?", stimulus: { kind: "none", description: "", data: {} },
    options: [0.212, 0.41, 0.788, 0.424].map((v, i) => ({ text: `$${v}$`, why: "a named misconception here", value: String(v) })), key_index: 0, est_seconds: 80, facts: [], ...o });
  it("requires a stated rounding convention when options are decimals and spaces values at least two last digits apart", () => {
    expect(statsMcRules(base({}))).toEqual([]);
    expect(statsMcRules(base({ stem: "What is the probability?" }))).toContain("rounding_convention_not_stated");
    const close = base({ options: [0.212, 0.213, 0.788, 0.424].map((v) => ({ text: `$${v}$`, why: "a named misconception here", value: String(v) })) });
    expect(statsMcRules(close)).toContain("options_too_close_for_rounding");
  });
  it("does not apply the decimal rule to sentence options that quote data values", () => {
    const s = base({ stem: "Which interpretation is correct?", options: [0, 1, 2, 3].map((i) => ({ text: `We are $95\\%$ confident the proportion is between $0.2${i}1$ and $0.3${i}2$`, why: "a named misconception here", value: null })) });
    expect(statsMcRules(s)).toEqual([]);
  });
});
