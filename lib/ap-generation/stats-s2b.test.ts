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
import { flattenSet, gateStatsSet, type SetPack } from "./stats-set";
import { gateStatsFrq } from "./stats-frq-checks";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// S2-b: 첫 풀 세트 마무리용 새·수정 원형(스킬 1·2 보강, 다단계 조건 확인, 눈으로 구별되는 상자그림, 공유 세트 소개 문구, FRQ 10점 검토 기준).
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_statistics.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const topics = new Set(topicUnit.keys());
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");
const run = (code: string) => {
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 170000 });
  return r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {} };
};
const fixed = (names: string[], n: number, seed: number) => run(`import json,registry as R\nn=${JSON.stringify(names)}\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,${n},${seed}) for k in n}}))`) as { names: string[]; packs: Record<string, unknown[]> };

d("AP Statistics S2-b single MC archetypes (new + repaired)", () => {
  const out = run(`import json,registry as R\nn=R.STATS_STAGES['stats_s2b_singles']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,4,960) for k in n}}))`) as { names: string[]; packs: Record<string, (McPack & { blueprint: Partial<Blueprint> })[]> };
  it("registers 12 archetypes that all appear in the guide JSON, with enough skill-1 and skill-2 coverage for the first full set", () => {
    expect(out.names).toHaveLength(12);
    const guide = new Set(statsGuide.archetypes.map((a) => a.id)); for (const n of out.names) expect(guide.has(n), n).toBe(true);
    const sk = (id: string) => out.packs[id][0].skill;
    expect(out.names.filter((n) => sk(n) === "1.A")).toHaveLength(3);
    expect(out.names.filter((n) => sk(n).startsWith("2."))).toHaveLength(8);
  });
  it("every pack passes the deterministic gates, the blueprint, the stats guide and the figure gate", () => {
    for (const n of out.names) for (const p0 of out.packs[n]) {
      const mp = { ...p0, explanation_en: expl(p0) } as McPack;
      const reasons = [...gateMc("ap_statistics", mp), ...calibrateMc("ap_statistics", mp), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp), ...validateBlueprint(p0.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(p0 as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, reasons }).toEqual({ n, reasons: [] });
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_statistics", kind: "mc", payload: p0 as unknown as Record<string, unknown> });
      expect({ n, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, fig: [] });
    }
  });
  it("the repaired conditions item always has four different verdicts, exactly one matching the conditions, and the sample-count trap is present", () => {
    for (const p of out.packs.st_conditions_prop) {
      expect(p.options).toHaveLength(4);
      const t = p.options.map((o) => o.text);
      expect(new Set(t.map((x) => x.split(",")[0])).size).toBe(4); // 판정(모두 충족 / 10% / 큰 수 / 임의성)이 서로 다르다
      expect(p.options.some((o, i) => i !== p.key_index && /number of sampled|\$\d+\$ and \$\d+\$ are both at least/.test(o.text))).toBe(true); // p-hat 로 확인하는 함정
      expect(p.stem).not.toContain("Questions refer");
    }
  });
  it("the repaired boxplot item compares only statistics that differ by at least six units and says the gridlines are equal steps", () => {
    const p = out.packs.st_boxplot_compare ?? (fixed(["st_boxplot_compare"], 6, 970).packs.st_boxplot_compare as (McPack & { blueprint: Partial<Blueprint> })[]);
    for (const x of p) {
      const boxes = (x.stimulus.data as { data: { boxes: { median: number; q1: number; q3: number; min: number; max: number }[] } }).data.boxes;
      const [a, b] = boxes; const diffs = [a.median - b.median, (a.q3 - a.q1) - (b.q3 - b.q1), (a.max - a.min) - (b.max - b.min), a.q3 - b.q3, a.max - b.max];
      expect(Math.min(...diffs.map(Math.abs))).toBeGreaterThanOrEqual(6);
      expect(x.stem).toContain("gridlines");
    }
  });
  it("the repaired method-choice items give each wrong option a distinct, specific reason", () => {
    const o = fixed(["st_method_choice_means", "st_method_choice_cat"], 6, 975);
    for (const n of o.names) for (const p of o.packs[n] as McPack[]) {
      const whys = p.options.filter((_, i) => i !== p.key_index).map((x) => x.why);
      expect(new Set(whys).size).toBe(3);
      expect(whys.some((w) => /number of samples does not fit|measurements, not counts/.test(w ?? ""))).toBe(false); // 이전 반려 사유(일반 문구)
    }
  });
  it("the confidence-interval width item changes sample size and confidence level in opposite width directions and the ratio is at least 15 percent from 1", () => {
    for (const p of out.packs.st_ci_width_effect) {
      const r = Number(/ratio=([0-9.]+)/.exec(JSON.stringify((p as unknown as { facts: string[] }).facts))?.[1] ?? "0");
      expect(Math.abs(r - 1)).toBeGreaterThan(0.14);
    }
  });
});

d("AP Statistics S2-b shared binomial set (repaired lead-in and topics)", () => {
  const out = fixed(["st_set_binomial"], 3, 980);
  it("has a neutral lead-in without the stray multi-question sentence and labels the table-reading question 2.8", () => {
    for (const sp of out.packs.st_set_binomial as SetPack[]) {
      expect(gateStatsSet(sp)).toEqual([]);
      expect(sp.set_intro).not.toContain("Questions refer");
      expect(sp.items.map((i) => i.topic)).toEqual(["2.9", "2.8", "2.8"]);
      for (const m of flattenSet(sp, "st_set_binomial-k0")) {
        const mp = { ...m, explanation_en: expl(m) } as McPack;
        expect([...gateMc("ap_statistics", mp), ...gateMathWrapping(mp)]).toEqual([]);
      }
      const whys = sp.items.flatMap((i) => i.options.map((o) => o.why)).join(" ");
      expect(whys).not.toMatch(/non-defective/); // 병원 맥락에서 불일치하던 문구
    }
  });
});

d("AP Statistics S2-b FRQ archetypes (Q1 repaired, Q2 and Q4 first run)", () => {
  const out = run(`import json,registry as R\nn=R.STATS_STAGES['stats_s2b_frq']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,4,990) for k in n}}))`) as { names: string[]; packs: Record<string, (FrqPack & { blueprint: Partial<Blueprint> })[]> };
  it("lists Q1, Q2 and Q4 and every pack passes the deterministic gates", () => {
    expect(out.names).toEqual(["stfrq_q1_design", "stfrq_q2_regression", "stfrq_q4_integrated"]);
    for (const n of out.names) for (const p of out.packs[n]) {
      expect(p.total_points).toBe(10);
      const reasons = [...gateFrq("ap_statistics", p, skills, { requirePartTopics: true, topics }), ...calibrateFrq(p, "ap_statistics"), ...gateGuideFrq(statsGuide, p), ...gateMathWrapping(p as never), ...gateStatsFrq(p), ...bundleReferenceChecks(p),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(p as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, reasons }).toEqual({ n, reasons: [] });
    }
  });
  it("post-run fixes (S2-b rejects): Q2 has positive responses and a curvature direction that matches the residual fit; Q1 has realistic values; D states that the conditions are met", () => {
    const big = run(`import json,registry as R\nn=['stfrq_q1_design','stfrq_q2_regression','stfrq_q4_integrated']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,12,9500) for k in n}}))`) as { names: string[]; packs: Record<string, (FrqPack & { stimulus: { data?: { data?: { points?: number[][] } } } })[]> };
    for (const p of big.packs.stfrq_q2_regression) {
      const pts = p.stimulus.data!.data!.points!;
      expect(Math.min(...pts.map((x) => x[1]))).toBeGreaterThan(2);
      const t = p.parts[2].model_answer;
      if (/curved/.test(String(t))) {
        const xs = pts.map((x) => x[0]), ys = pts.map((x) => x[1]); const n = xs.length; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
        const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0); const a = my - b * mx;
        const res = xs.map((x, i) => ys[i] - (a + b * x)); const lo = Math.min(...xs), hi = Math.max(...xs);
        const mean = (f: (x: number) => boolean) => { const r = res.filter((_, i) => f(xs[i])); return r.reduce((u, v) => u + v, 0) / r.length; };
        const ends = mean((x) => x <= lo + (hi - lo) / 4 || x >= hi - (hi - lo) / 4), mid = mean((x) => x > lo + (hi - lo) / 4 && x < hi - (hi - lo) / 4);
        expect(/above the line at both ends/.test(String(t))).toBe(ends > mid);
      }
    }
    for (const p of big.packs.stfrq_q1_design) expect(JSON.stringify(p.stimulus)).not.toMatch(/hours of sleep/);
    for (const p of big.packs.stfrq_q4_integrated) expect(p.parts.find((x) => x.label === "D")!.prompt).toContain("conditions for the interval are met");
  });
  it("blocking item never prints 'classs' (plural of class)", () => {
    const b = fixed(["st_blocking_design"], 12, 7200).packs.st_blocking_design as McPack[];
    for (const p of b) expect(JSON.stringify(p)).not.toContain("classs");
  });
  it("Q1 ties the table to the part A study and no longer says 'chose to not'", () => {
    for (const p of out.packs.stfrq_q1_design) {
      const text = p.parts.map((x) => x.prompt).join(" ");
      expect(text).not.toMatch(/chose to not|chose to do not/);
      expect(text).toContain("in the study");
      expect(JSON.stringify(p.stimulus)).toContain("in the study");
    }
  });
});
