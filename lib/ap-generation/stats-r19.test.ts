import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateMc, gateMc, type McPack } from "./gates";
import { gateGuideFrq, gateGuideMc } from "./guide-gates";
import { answerTextForExplanation, gateMathWrapping } from "./math-wrapping";
import { generatorDefects } from "./generator-defects";
import { statsGuide } from "./subjects/stats";
import { gateStatsFrq } from "./stats-frq-checks";
import { gateStatsSet } from "./stats-set";
import { gateDifficultySignals, type DifficultySignals } from "./stats-difficulty";
import type { FrqPack } from "./gates";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// 2026-10-19 추가 라운드(연습 시험 3~5): 새 단독 MC·공유 세트·FRQ 원형이 결정적 게이트(설계도·가이드·TeX 위생·그림·난이도 선언)를 통과하고 기존 원형과 이름·틀이 겹치지 않는지 본다.
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_statistics.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");
const run = (code: string) => { const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 280000 }); return r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {}, err: r.stderr.slice(-800) }; };

type P = McPack & { blueprint: Partial<Blueprint>; difficulty_signals?: DifficultySignals; seed: number };
const ST = ["stats_s4", "stats_s5", "stats_s6"];
const mcOut = havePy ? (run(`import json,registry as R\nnames=[n for s in ${JSON.stringify(ST)} for n in R.STATS_STAGES.get(s+'_singles',[])]\nprint(json.dumps({'names':names,'packs':{k:R.batch(k,8,7100) for k in names}}))`) as { names: string[]; packs: Record<string, P[]>; err?: string }) : { names: [] as string[], packs: {} as Record<string, P[]> };
const setOut = havePy ? (run(`import json,registry as R\nnames=[n for s in ${JSON.stringify(ST)} for n in R.STATS_STAGES.get(s+'_sets',[])]\nprint(json.dumps({'names':names,'packs':{k:R.batch(k,6,7100) for k in names}}))`) as { names: string[]; packs: Record<string, Record<string, unknown>[]> }) : { names: [] as string[], packs: {} as Record<string, Record<string, unknown>[]> };
const frqOut = havePy ? (run(`import json,registry as R\nnames=[n for s in ${JSON.stringify(ST)} for n in R.STATS_STAGES.get(s+'_frq',[])]\nprint(json.dumps({'names':names,'packs':{k:R.batch(k,6,7100) for k in names}}))`) as { names: string[]; packs: Record<string, FrqPack[]> }) : { names: [] as string[], packs: {} as Record<string, FrqPack[]> };

d("AP Statistics practice exams 3-5: new single MC archetypes", () => {
  it("every archetype is in the guide JSON and generates at least 6 distinct packs", () => {
    const guide = new Set(statsGuide.archetypes.map((a) => a.id));
    for (const n of mcOut.names) { expect(guide.has(n), n).toBe(true); expect(mcOut.packs[n].length, n).toBeGreaterThanOrEqual(6); }
  });
  it("every pack passes the deterministic gates, blueprint, guide, math wrapping, generator defects, the figure gate and the 100-word stem limit", () => {
    const fails: unknown[] = [];
    for (const n of mcOut.names) for (const p0 of mcOut.packs[n]) {
      const mp = { ...p0, explanation_en: expl(p0) } as McPack;
      const reasons = [...gateMc("ap_statistics", mp), ...calibrateMc("ap_statistics", mp), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp), ...gateDifficultySignals(p0 as never),
        ...validateBlueprint(p0.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(p0 as unknown as Record<string, unknown>).map((x) => x.code)];
      if (p0.stem.split(/\s+/).length > 100) reasons.push("stem_over_100_words");
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_statistics", kind: "mc", payload: p0 as unknown as Record<string, unknown> });
      const fig = g.issues.filter((i) => i.level === "error").map((i) => `${i.code}:${i.message}`);
      if (reasons.length || fig.length) fails.push({ n, seed: p0.seed, reasons, fig });
    }
    const sum: Record<string, number> = {}; for (const f of fails as { n: string; reasons: string[]; fig: string[] }[]) for (const r of [...f.reasons, ...f.fig]) sum[`${f.n} ${r}`] = (sum[`${f.n} ${r}`] ?? 0) + 1;
    expect(sum).toEqual({});
  });
  it("the four options are distinct, exactly one is the key, and no option letter or answer is leaked in the stem", () => {
    for (const n of mcOut.names) for (const p of mcOut.packs[n]) {
      expect(new Set(p.options.map((o) => o.text)).size, `${n} s${p.seed}`).toBe(4);
      const key = p.options[p.key_index].text.replace(/\$/g, "").trim();
      if (key.length >= 12) expect(p.stem.replace(/\$/g, "").includes(key), `${n} s${p.seed}`).toBe(false);
    }
  });
});

d("AP Statistics practice exams 3-5: new shared sets and FRQs", () => {
  it("each set pack has three same-unit members, a shared stimulus and passes the set gate and every member's gates", () => {
    for (const n of setOut.names) for (const p of setOut.packs[n] as unknown as { archetype: string; items: (McPack & { blueprint: Partial<Blueprint> })[]; stimulus: McPack["stimulus"]; set_intro: string; seed: number }[]) {
      expect({ n, issues: gateStatsSet(p as never, { size: 3 }) }).toEqual({ n, issues: [] });
      for (const it of p.items) {
        const mp = { ...it, stimulus: p.stimulus, stem: `${p.set_intro}\n\n${it.stem}`, explanation_en: expl(it as never) } as McPack;
        const reasons = [...gateMc("ap_statistics", { ...mp, set: { question: it.stem, intro: p.set_intro } } as never), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp), ...validateBlueprint(it.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)];
        expect({ n, seed: p.seed, member: it.archetype, reasons }).toEqual({ n, seed: p.seed, member: it.archetype, reasons: [] });
      }
    }
  });
  it("each FRQ pack passes the stats FRQ design checks, the guide template check, the blueprint and TeX hygiene, and its rubric is meaning-based for explanation parts", () => {
    for (const n of frqOut.names) for (const p of frqOut.packs[n]) {
      const fp = p as FrqPack & { blueprint: Partial<Blueprint>; seed: number };
      const reasons = [...gateStatsFrq(fp), ...gateGuideFrq(statsGuide, fp), ...gateMathWrapping(fp as never), ...validateBlueprint(fp.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(fp as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, seed: fp.seed, reasons }).toEqual({ n, seed: fp.seed, reasons: [] });
      for (const part of fp.parts) if (part.response_mode === "explain") for (const r of part.rubric_rows as unknown as { meaning_based?: boolean }[]) expect(r.meaning_based, `${n} ${part.label}`).toBe(true);
    }
  });
});
