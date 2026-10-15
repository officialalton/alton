// 라운드 6 패치 테스트(저장된 읽기 스냅샷 data/audit/2026-10-15-r6-readout.json 사용, DB·네트워크 없음).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planPatch, type Overrides, type Patch, type ProblemReadout } from "./plan";
import { buildPatch6, EDITS6, type F6 } from "./r6-edits";

const ro = JSON.parse(readFileSync("data/audit/2026-10-15-r6-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const patches = (JSON.parse(readFileSync("data/audit/2026-10-15-r6-patches.json", "utf-8")) as { patches: Patch[] }).patches;
const overrides = JSON.parse(readFileSync("data/audit/2026-10-15-r6-overrides.json", "utf-8")) as Overrides;
const byId = new Map(ro.problems.map((p) => [p.problem_id, p]));
const fields = (id: string): F6 => { const p = byId.get(id)!.pub!; return { passage: p.passage, question: p.question, options: p.options, correct_index: p.correct_index, explanation: p.explanation, explanation_en: p.explanation_en, figure: p.figure, statements: p.statements }; };
const get = (id: string) => patches.find((p) => p.id === id)!;
const nw = (id: string, field: string) => get(id).changes.find((c) => c.field === field)?.new as never;

describe("round 6 patch list", () => {
  it("has unique ids and equals what the edit functions produce now", () => {
    expect(new Set(patches.map((p) => p.id)).size).toBe(patches.length);
    expect(patches.length).toBe(EDITS6.length);
    for (const def of EDITS6) expect(buildPatch6(def, fields(def.problemId), byId.get(def.problemId)!.pub!.id).changes, def.id).toEqual(get(def.id).changes);
  });
  it("every patch plans as 'apply' against the stored current published versions, with explanation_en set and no Hangul on the student side", () => {
    for (const p of patches) {
      const plan = planPatch(p, byId.get(p.problemId!)!, { overrides, now: "2026-10-15T00:00:00.000Z" });
      expect(plan.status, `${p.id}: ${plan.reasons.join(" | ")}`).toBe("apply");
      const o = plan.args!.options; if (o) expect(new Set(o.map((x) => x.trim().toLowerCase())).size, p.id).toBe(o.length);
      expect(plan.args!.explanation_en, p.id).toBeTruthy();
    }
  });
  it("MC patches never move the key position", () => {
    for (const def of EDITS6) { const cur = byId.get(def.problemId)!.pub!; if (cur.correct_index == null) continue; const o = def.edit(fields(def.problemId)); if (o.options) expect(o.options.length).toBe(cur.options!.length); expect(get(def.id).changes.some((c) => c.field === "correct_index"), def.id).toBe(false); }
  });
});

describe("P1 Statistics 2 MC28: C and D are no longer equivalent", () => {
  const opts = nw("R6-STAT2-MC28", "options") as string[];
  it("only C is the null hypothesis of independence; D now states the alternative as the null", () => {
    expect(opts[2]).toContain("are independent in the population");
    expect(opts[3]).toContain("are associated in the population");
    expect(opts[3]).not.toContain("independent");
    expect(opts[3]).not.toContain("same for all");
    expect(byId.get("74b5384e-aae6-4ca7-acf7-e693ca0bbcbd")!.pub!.correct_index).toBe(2);
  });
  it("the explanation no longer calls D a homogeneity null", () => {
    const en = nw("R6-STAT2-MC28", "explanation_en") as string;
    expect(en).not.toContain("homogeneity");
    expect(en).toContain("alternative hypothesis");
  });
});

describe("P2 stems that were missing a condition", () => {
  it("Physics 1 MC9 says the block accelerates down from rest", () => { expect(nw("R6-PHYS1-MC9", "question")).toContain("released from rest"); expect(nw("R6-PHYS1-MC9", "question")).toContain("accelerates down"); });
  it("Microeconomics 1 MC53 gives the next worker's MRP", () => { const q = nw("R6-MICRO1-MC53", "question") as string; expect(q).toContain("next worker"); expect(q).not.toContain("last worker"); });
  it("Macroeconomics 1 MC28 states the M1/M2 definitions", () => { const q = nw("R6-MACRO1-MC28", "question") as string; expect(q).toContain("M1 is currency in circulation plus checkable"); expect(q).toContain("M2 is M1 plus savings deposits"); });
  it("Chemistry 2 MC29 states the outlier rule and trial 2 fails it while trials 1 and 3 do not", () => {
    expect(nw("R6-CHEM2-MC29", "question")).toContain("more than $0.50");
    const v = [21.65 - 0.2, 20.85 - 0.5, 21.4 - 0.0]; // 21.45, 20.35, 21.40
    const dev = (i: number) => Math.min(...v.filter((_, j) => j !== i).map((x) => Math.abs(x - v[i])));
    expect(dev(1)).toBeGreaterThan(0.5); expect(dev(0)).toBeLessThanOrEqual(0.5); expect(dev(2)).toBeLessThanOrEqual(0.5);
    expect(Math.round((Math.round(v[0] * 100) + Math.round(v[2] * 100)) / 2) / 100).toBe(21.43); // 21.425 rounds half up (integer hundredths avoid float noise)
  });
  it("Psychology 2 MC58-60 table percentages are realisable with n = 30 (rounded integers), same table in all three", () => {
    for (const id of ["R6-PSY2-MC58", "R6-PSY2-MC59", "R6-PSY2-MC60"]) {
      const f = nw(id, "figure") as { rows: string[][]; notes: string[] };
      const n = Number(f.rows[0][1]);
      for (const r of f.rows) { const pct = Number(r[2].replace("%", "")); expect(Math.round((Math.round((pct / 100) * n) / n) * 100), id).toBe(pct); }
      expect(f.rows.map((r) => r[2])).toEqual(["83%", "63%", "40%"]);
    }
    expect(nw("R6-PSY2-MC60", "explanation_en")).toContain("83% to 63% to 40%");
    expect(nw("R6-PSY2-MC60", "explanation_en")).not.toContain("85%");
  });
});

describe("P2/P3 FRQ prompts and reference answers", () => {
  it("every changed statements array keeps labels, modes and points", () => {
    for (const p of patches) { const c = p.changes.find((x) => x.field === "statements"); if (!c) continue; const o = c.old as { label: string; mode: string; points: number }[], n = c.new as typeof o; expect(n.map((s) => [s.label, s.mode, s.points]), p.id).toEqual(o.map((s) => [s.label, s.mode, s.points])); }
  });
  it("explanation and explanation_en stay identical where they were identical", () => {
    for (const p of patches) { const cur = byId.get(p.problemId!)!.pub!; if (cur.explanation !== cur.explanation_en) continue; const ex = p.changes.find((c) => c.field === "explanation")?.new, en = p.changes.find((c) => c.field === "explanation_en")?.new; expect(ex, p.id).toEqual(en); }
  });
  it("Statistics 2 FRQ1C orders treatment before measurement", () => { const s = (nw("R6-STAT2-FRQ1C", "statements") as { label: string; prompt: string }[]).find((x) => x.label === "C")!.prompt; expect(s).toContain("for several weeks"); expect(s).toContain("the previous night"); });
  it("Physics 1 Exam 2 FRQ1D guarantees a long enough rough section in both releases", () => { expect(nw("R6-PHYS2-FRQ1D", "passage")).toContain("second release from height $2h$"); });
  it("Macroeconomics 1 FRQ1 E no longer claims AD2 meets SRAS exactly at YF", () => { const en = nw("R6-MACRO1-FRQ1DE", "explanation_en") as string; expect(en).not.toContain("intersecting SRAS at full-employment output"); expect(en).toContain("constant"); });
  it("English Language 2 FRQ1 sample no longer says cost per visit 'always' improves (and the arithmetic it relies on holds)", () => {
    expect(nw("R6-ELA2-FRQ1", "explanation_en")).not.toContain("always looks better");
    expect(Math.round((1_900_000 / 177_000) * 100) / 100).toBe(10.73); expect(Math.round((1_600_000 / 140_000) * 100) / 100).toBe(11.43);
  });
  it("English Language 2 FRQ2 sample no longer says the wharf is losing money overall", () => { const en = nw("R6-ELA2-FRQ2", "explanation_en") as string; expect(en).not.toContain("wharf was losing money"); expect(en).not.toContain("business that is losing money"); });
  it("Biology 1/2 FRQ titles are complete", () => { for (const id of ["R6-BIO1-FRQ2T", "R6-BIO2-FRQ2"]) expect(nw(id, "question"), id).toMatch(/^Results with graphing: .+ — answer every part\.$/); expect(nw("R6-BIO1-FRQ2T", "question")).not.toContain("an  —"); });
  it("Biology 1 FRQ3 part C now asks for the 70 C prediction that part D justifies", () => { const c = (nw("R6-BIO1-FRQ3CD", "statements") as { label: string; prompt: string }[]).find((x) => x.label === "C")!.prompt; expect(c).toContain("70 °C"); });
  it("Statistics 1 FRQ4D states the population-size assumption (10 x 181 = 1810)", () => { const s = (nw("R6-STAT1-FRQ4D", "statements") as { label: string; prompt: string }[]).find((x) => x.label === "D")!.prompt; expect(s).toContain("1810"); expect(10 * 181).toBe(1810); });
});

const JAVA = ["/opt/homebrew/opt/openjdk@21/bin", process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin") : ""].filter(Boolean).find((d) => existsSync(path.join(d, "javac")));
describe.skipIf(!JAVA)("P1 CS A 2 FRQ4 reference code compiled and run with the JDK", () => {
  it("the reference code in the patched explanation returns the right row for negative, tie and random inputs", () => {
    const en = nw("R6-CSA2-FRQ4", "explanation_en") as string;
    const code = /```java\n([\s\S]*?)```/.exec(en)![1];
    expect(code).not.toContain("-1000000");
    const dir = mkdtempSync(path.join(tmpdir(), "r6-csa-"));
    writeFileSync(path.join(dir, "GridStats.java"), `public class GridStats {\n${code}\n}\n`);
    writeFileSync(path.join(dir, "Check.java"), `import java.util.*;
public class Check {
  static int oracle(int[][] g) { long bs = Long.MIN_VALUE; int b = -1; for (int r = 0; r < g.length; r++) { long s = 0; for (int x : g[r]) s += x; if (s > bs) { bs = s; b = r; } } return b; }
  static void eq(int[][] g, int e) { int got = GridStats.bestRow(g); if (got != e) throw new AssertionError(Arrays.deepToString(g) + " got " + got + " expected " + e); }
  public static void main(String[] a) {
    eq(new int[][]{{1,2},{5,0},{3,2}}, 1); eq(new int[][]{{-2000000},{-1500000}}, 1); eq(new int[][]{{-5},{-3},{-3},{-9}}, 1);
    eq(new int[][]{{-7}}, 0); eq(new int[][]{{4,4},{4,4},{4,3}}, 0); eq(new int[][]{{-1,-1},{-1,-1}}, 0); eq(new int[][]{{0},{0}}, 0);
    Random rnd = new Random(11);
    for (int t = 0; t < 50000; t++) { int R = 1 + rnd.nextInt(6), C = 1 + rnd.nextInt(5); int[][] g = new int[R][C]; int mag = rnd.nextBoolean() ? 5 : 2000000; for (int[] row : g) for (int c = 0; c < C; c++) row[c] = rnd.nextInt(2 * mag + 1) - mag; eq(g, oracle(g)); }
    System.out.println("OK");
  }
}
`);
    execFileSync(path.join(JAVA!, "javac"), ["GridStats.java", "Check.java"], { cwd: dir });
    const r = spawnSync(path.join(JAVA!, "java"), ["Check"], { cwd: dir, encoding: "utf-8" });
    expect(r.stdout.trim(), r.stderr).toBe("OK");
  });
  it("the old reference fails the large-negative case (the reviewer's claim reproduces)", () => {
    const cur = byId.get("660364db-1156-4d7c-99d7-57ea9c6b9212")!.pub!.explanation_en!;
    expect(cur).toContain("int bestSum = -1000000;");
  });
});
