import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateMc, gateMc, type McPack } from "./gates";
import { gateGuideMc } from "./guide-gates";
import { answerTextForExplanation, gateMathWrapping } from "./math-wrapping";
import { generatorDefects } from "./generator-defects";
import { statsGuide } from "./subjects/stats";
import { structuralBand, type DifficultySignals } from "./stats-difficulty";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// S3: 다단계·결합 개념 MC 원형 10개(docs/ap/statistics-difficulty.md). 모든 원형이 구조 난이도 신호를 선언하고, 정답은 파이썬 이중 경로와 별개로 여기서(TypeScript) 다시 계산한다.
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const d = havePy ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_statistics.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");
const run = (code: string) => { const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 170000 }); return r.status === 0 ? JSON.parse(r.stdout) : { names: [], packs: {} }; };

type P = McPack & { blueprint: Partial<Blueprint>; difficulty_signals: DifficultySignals; seed: number };
const out = havePy ? (run(`import json,registry as R\nn=R.STATS_STAGES['stats_s3_singles']\nprint(json.dumps({'names':n,'packs':{k:R.batch(k,12,9300) for k in n}}))`) as { names: string[]; packs: Record<string, P[]> }) : { names: [] as string[], packs: {} as Record<string, P[]> };
const num = (t: string) => Number(t.replace(/[$,\\]/g, ""));
const dollars = (t: string) => [...t.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
const ncdf = (z: number) => { // Abramowitz-Stegun 7.1.26 가 아닌 고정밀 연분수 대신 Taylor/erf 급수(|z|<=8)
  const erf = (x: number) => { let s = x, t = x; for (let n = 1; n < 80; n++) { t *= (-x * x) / n; s += t / (2 * n + 1); } return (2 / Math.sqrt(Math.PI)) * s; };
  return 0.5 * (1 + erf(z / Math.SQRT2));
};

d("AP Statistics S3 multi-step MC archetypes", () => {
  it("registers 10 archetypes in the guide JSON; each declares signals that the structural rule classifies as exam_prep", () => {
    expect(out.names).toHaveLength(10);
    const guide = new Set(statsGuide.archetypes.map((a) => a.id));
    for (const n of out.names) { expect(guide.has(n), n).toBe(true); expect(out.packs[n].length, n).toBeGreaterThanOrEqual(8); for (const p of out.packs[n]) expect(structuralBand(p.difficulty_signals), `${n} s${p.seed}`).toBe("exam_prep"); }
  });
  it("every pack passes the deterministic gates (including the signal declaration), blueprint, guide, math wrapping, generator defects and the figure gate", () => {
    for (const n of out.names) for (const p0 of out.packs[n]) {
      const mp = { ...p0, explanation_en: expl(p0) } as McPack;
      const reasons = [...gateMc("ap_statistics", mp), ...calibrateMc("ap_statistics", mp), ...gateGuideMc(statsGuide, mp), ...gateMathWrapping(mp), ...validateBlueprint(p0.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(p0 as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, seed: p0.seed, reasons }).toEqual({ n, seed: p0.seed, reasons: [] });
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_statistics", kind: "mc", payload: p0 as unknown as Record<string, unknown> });
      expect({ n, fig: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, fig: [] });
    }
  });
  it("every wrong option is the first failure point of a declared step and the key is never a wrong option", () => {
    for (const n of out.names) for (const p of out.packs[n]) {
      const wrong = p.options.filter((_, i) => i !== p.key_index).map((o) => o.text);
      expect(Object.keys(p.difficulty_signals.distractor_fail_step).sort()).toEqual([...wrong].sort());
      expect(new Set(Object.values(p.difficulty_signals.distractor_fail_step)).size, `${n} s${p.seed}`).toBeGreaterThanOrEqual(p.difficulty_signals.steps.length - 1);
    }
  });
  it("st_two_draw_conditional: the key and the three wrong values are the four quantities of the tree arithmetic for exactly one case, recomputed here", () => {
    for (const p of out.packs.st_two_draw_conditional) {
      const [a, b] = dollars(p.stem).slice(0, 2).map(Number); const N = a + b;
      const P2 = (f: number, s: number) => ((f === 0 ? a : b) === 0 ? 0 : 0) + ((s === 0 ? a : b) - (f === s ? 1 : 0)) / (N - 1);
      const vals = p.options.map((o) => Number(o.value)); const key = vals[p.key_index];
      const cases: number[][] = [];
      for (const first of [0, 1]) for (const ev of [0, 1]) {
        const P1 = (first === 0 ? a : b) / N; const joint = P1 * P2(first, ev); const tot = (a / N) * P2(0, ev) + (b / N) * P2(1, ev);
        if (Math.abs(joint / tot - key) < 6e-4) cases.push([joint / tot, P2(first, ev), joint, tot]);
      }
      expect(cases.length, `s${p.seed}`).toBeGreaterThanOrEqual(1);
      const ok = cases.some((c) => c.every((v) => vals.some((x) => Math.abs(x - v) < 6e-4)));
      expect(ok, `s${p.seed} ${vals}`).toBe(true);
    }
  });
  it("st_phat_normal_prob: the key probability equals the normal tail recomputed from the stem, and the stem's conditions hold", () => {
    for (const p of out.packs.st_phat_normal_prob) {
      const m = p.stem.match(/Suppose that \$(\d+)\\%\$ of the \$(\d+)\$[\s\S]*selected, and [\s\S]*P\(\\hat\{p\} ([<>]) ([\d.]+)\)/)!;
      const pct = Number(m[1]) / 100; const Npop = Number(m[2]); const n = Number(p.stem.match(/sample of \$(\d+)\$/)![1]); const upper = m[3] === ">"; const c = Number(m[4]);
      expect(n * pct).toBeGreaterThanOrEqual(10); expect(n * (1 - pct)).toBeGreaterThanOrEqual(10); expect(Npop).toBeGreaterThanOrEqual(10 * n);
      const z = (c - pct) / Math.sqrt((pct * (1 - pct)) / n); const v = upper ? 1 - ncdf(z) : ncdf(z);
      expect(Math.abs(Number(p.options[p.key_index].value) - v)).toBeLessThan(5e-4);
      expect(p.options[p.key_index].text).toContain(`$${v.toFixed(3)}$`);
    }
  });
  it("st_power_table_change: every table power is recomputed with an independent normal CDF and the key direction matches the two table cells named in the stem", () => {
    for (const p of out.packs.st_power_table_change) {
      const sd = Number(p.stem.match(/standard deviation of \$(\d+)\$/)![1]); const mu0 = Number(p.stem.match(/H_0: \\mu = (\d+)/)![1]); const mua = Number(p.stem.match(/alternative \$\\mu = (\d+)\$/)![1]);
      const tab = (p.stimulus.data as { data: { columns: string[]; rows: string[][] } }).data; const alphas = tab.columns.slice(1).map((c) => Number(c.replace("alpha = ", "")));
      const zq = (a: number) => { let lo = 0, hi = 6; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (1 - ncdf(m) > a) lo = m; else hi = m; } return (lo + hi) / 2; };
      for (const row of tab.rows) alphas.forEach((a, j) => expect(Math.abs(1 - ncdf(zq(a) - ((mua - mu0) * Math.sqrt(Number(row[0]))) / sd) - Number(row[j + 1]))).toBeLessThan(0.0051));
      const m = p.stem.match(/currently uses \$n = (\d+)\$ and \$\\alpha = ([\d.]+)\$ and is considering a change to \$n = (\d+)\$ and \$\\alpha = ([\d.]+)\$/)!;
      const cell = (n: string, a: string) => Number(tab.rows.find((r) => r[0] === n)![alphas.indexOf(Number(a)) + 1]);
      const up = cell(m[3], m[4]) > cell(m[1], m[2]); const typeIdown = Number(m[4]) < Number(m[2]);
      const key = p.options[p.key_index].text;
      expect(key.includes("Type I error decreases")).toBe(typeIdown); expect(key.endsWith("increases")).toBe(up);
    }
  });
  it("st_outlier_effect: correlation and slope with and without the highlighted point are recomputed here and match the key wording", () => {
    const fit = (xs: number[], ys: number[]) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; } return { b: sxy / sxx, r: sxy / Math.sqrt(sxx * syy) }; };
    for (const p of out.packs.st_outlier_effect) {
      const dd = (p.stimulus.data as { data: { points: number[][]; highlights: { index: number }[] } }).data; const hi = dd.highlights[0].index;
      const all = fit(dd.points.map((q) => q[0]), dd.points.map((q) => q[1])); const wo = dd.points.filter((_, i) => i !== hi); const w0 = fit(wo.map((q) => q[0]), wo.map((q) => q[1]));
      const rUp = Math.abs(w0.r) > Math.abs(all.r); const rel = Math.abs(Math.abs(w0.b) - Math.abs(all.b)) / Math.max(Math.abs(all.b), 0.1);
      const key = p.options[p.key_index].text;
      expect(key.includes(rUp ? "correlation becomes stronger" : "correlation becomes weaker")).toBe(true);
      expect(key.includes("about the same")).toBe(rel < 0.12);
      if (rel >= 0.12) expect(key.includes(Math.abs(w0.b) > Math.abs(all.b) ? "noticeably steeper" : "noticeably less steep")).toBe(true);
    }
  });
  it("st_chisq_setup: the degrees of freedom in the key are (rows-1)(columns-1) of the table and no wrong option has them with the same hypothesis wording", () => {
    for (const p of out.packs.st_chisq_setup) {
      const dd = (p.stimulus.data as { data: { cells: number[][] } }).data; const df = (dd.cells.length - 1) * (dd.cells[0].length - 1);
      expect(p.options[p.key_index].text).toContain(`$df = ${df}$`);
      const wrongSame = p.options.filter((o, i) => i !== p.key_index && o.text === p.options[p.key_index].text);
      expect(wrongSame).toHaveLength(0);
      const hom = p.stem.includes("independent random sample of");
      expect(p.options[p.key_index].text.includes("independent in the population")).toBe(!hom);
    }
  });
  it("st_sampling_dist_xbar: the key standard deviation is sigma over root n recomputed from the stem and the center is the population mean, not the observed sample mean", () => {
    for (const p of out.packs.st_sampling_dist_xbar) {
      const mu = Number(p.stem.match(/\\mu = (\d+)/)![1]); const sig = Number(p.stem.match(/\\sigma = (\d+)/)![1]); const n = Number(p.stem.match(/random sample of \$(\d+)\$ observations/)![1]);
      const [m, s] = dollars(p.options[p.key_index].text).map(Number);
      expect(m).toBe(mu); expect(Math.abs(s - sig / Math.sqrt(n))).toBeLessThan(0.006);
      const normalPop = p.stem.includes("approximately normal, with mean");
      const shape = p.options[p.key_index].text.endsWith("approximately normal");
      expect(shape).toBe(normalPop || n >= 30);
    }
  });
  it("st_block_table: the block gap and the within-block differences in the key are recomputed from the table", () => {
    for (const p of out.packs.st_block_table) {
      const rows = (p.stimulus.data as { data: { rows: string[][] } }).data.rows; const mean = (i: number) => Number(rows[i][3]);
      const d1 = mean(0) - mean(1), d2 = mean(2) - mean(3), G = (mean(2) - mean(0) + mean(3) - mean(1)) / 2;
      const [gap, within] = dollars(p.options[p.key_index].text).map(Number);
      expect(gap).toBe(Math.round(G)); expect(within).toBe(Math.round((d1 + d2) / 2)); expect(Math.abs(d1 - d2)).toBeLessThanOrEqual(2.05); expect(gap).toBeGreaterThanOrEqual(12);
      expect(Math.max(...rows.map((r) => Number(r[4])))).toBeLessThanOrEqual(5.5);
    }
  });
  it("st_ci_test_consistency: the decision in the key follows the position of the null value and the direction of the alternative, recomputed from the stem", () => {
    for (const p of out.packs.st_ci_test_consistency) {
      const iv = p.stem.match(/interval of \$\(([\d.]+), ([\d.]+)\)\$/)!; const lo = Number(iv[1]), hi = Number(iv[2]);
      const m0 = Number(p.stem.match(/H_0: \\mu = ([\d.]+)/)![1]); const ha = p.stem.match(/H_a: \\mu (\\ne|>|<) /)![1];
      const outside = ha === "\\ne" ? m0 < lo || m0 > hi : ha === ">" ? m0 < lo : m0 > hi;
      const key = p.options[p.key_index].text;
      expect(key.startsWith("Reject")).toBe(outside); if (outside) expect(key).toContain(`\\mu ${ha} ${m0}`);
      expect(key.includes("convincing evidence that $\\mu = ")).toBe(false);
    }
  });
  it("st_t_procedure_conditions and st_residual_r2_model: the key is the unique option with the correct procedure/pattern and verdict", () => {
    for (const p of out.packs.st_t_procedure_conditions) {
      const sym = (t: string) => t.startsWith("roughly symmetric"); const ok = (n: number, shape: string) => n >= 30 || sym(shape);
      const dm = p.stem.match(/dotplot of the \$(\d+)\$ differences \([^)]*\) is (strongly right-skewed with an outlier|roughly symmetric with no outliers)/);
      const key = p.options[p.key_index].text; let met: boolean;
      if (dm) { met = ok(Number(dm[1]), dm[2]); expect(key.startsWith("Matched-pairs $t$ procedure")).toBe(true); }
      else { const gs = [...p.stem.matchAll(/dotplot of the \$(\d+)\$ values for .*? is (strongly right-skewed with an outlier|roughly symmetric with no outliers)/g)]; expect(gs).toHaveLength(2); met = gs.every((g) => ok(Number(g[1]), g[2])); expect(key.startsWith("Two-sample $t$ procedure")).toBe(true); }
      expect(key.includes("normality condition is met")).toBe(met); expect(key.includes("normality condition is not met")).toBe(!met);
      expect(p.options.filter((o, i) => i !== p.key_index && o.text === key)).toHaveLength(0);
    }
    for (const p of out.packs.st_residual_r2_model) {
      const curved = /large \$r\^2\$ does not show/.test(p.options[p.key_index].text); const r2 = Number(p.stem.match(/r\^2 = ([\d.]+)\$\. /)![1]);
      expect(curved).toBe(r2 >= 0.85); expect(p.options[p.key_index].text.startsWith(curved ? "The linear model is not appropriate" : "The linear model is appropriate")).toBe(true);
    }
  });
});
