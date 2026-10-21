// 자체 샘플 검증 결과 집계. 사용: npx tsx scripts/euro-selfcheck-analyze.ts <label> [<label2> ...]  → data/ap/euro-selfcheck/analysis-<labels>.json + 표 출력
import { readFileSync, writeFileSync } from "node:fs";
const DIR = "data/ap/euro-selfcheck";
const labels = process.argv.slice(2);
type Res = { id: string; status: string; rowKeys?: string[]; runs?: { run: number; scores?: Record<string, number>; total?: number }[]; combined?: Record<string, number>; total?: number; disagreement?: unknown };
const results: Res[] = labels.flatMap((l) => (JSON.parse(readFileSync(`${DIR}/results-${l}.json`, "utf-8")).results as Res[]).filter(() => true));
const ref = Object.fromEntries((JSON.parse(readFileSync(`${DIR}/reference.json`, "utf-8")).reference as any[]).map((r) => [r.id, r]));
const des = Object.fromEntries((JSON.parse(readFileSync(`${DIR}/designs.json`, "utf-8")).designs as any[]).map((d) => [d.id, d]));
const ROWS: Record<string, string[]> = { dbq: ["thesis", "context", "docs", "outside", "sourcing", "complexity"], leq: ["thesis", "context", "evidence", "analysis"], saq: ["a", "b", "c"] };
const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
const pct = (n: number, d: number) => (d ? +((100 * n) / d).toFixed(1) : null);
const byId = Object.fromEntries(results.map((r) => [r.id, r]));
const baseOf: Record<string, string> = { "DBQA-INJ1": "DBQA-3", "DBQA-INJ2": "DBQA-4", "DBQB-INJ1": "DBQB-3", "LEQA-INJ1": "LEQA-3", "LEQB-INJ1": "LEQB-3", "LEQB-INJ2": "LEQB-4", "SAQA-INJ1": "SAQA-3" };

const per: any[] = [];
for (const r of results) {
  if (r.status !== "done") { per.push({ id: r.id, status: r.status }); continue; }
  const d = des[r.id], f = ref[r.id]; const ai = r.total!; const refTotal = sum(f.rows);
  per.push({ id: r.id, set: d.set, type: d.type, cat: d.cat, refStatus: f.status, ref: refTotal, range: f.range, ai, delta: ai - refTotal, inRange: ai >= f.range[0] && ai <= f.range[1], exact: ai === refTotal, within1: Math.abs(ai - refTotal) <= 1,
    run1: r.runs![0].total, run2: r.runs![1].total, disagreement: !!r.disagreement,
    rows: Object.fromEntries(r.rowKeys!.map((k, i) => [k, { ref: f.rows[i], ai: r.combined![k], run1: r.runs![0].scores![k], run2: r.runs![1].scores![k], ambiguous: f.ambiguous.includes(k) }])) });
}
const isMain = (p: any) => p.cat && !/^injection|^irrelevant/.test(p.cat);
const stats = (rows: any[]) => ({ n: rows.length, exact: pct(rows.filter((p) => p.exact).length, rows.length), within1: pct(rows.filter((p) => p.within1).length, rows.length), inRange: pct(rows.filter((p) => p.inRange).length, rows.length), meanSigned: rows.length ? +(sum(rows.map((p) => p.delta)) / rows.length).toFixed(2) : null, mae: rows.length ? +(sum(rows.map((p) => Math.abs(p.delta))) / rows.length).toFixed(2) : null });
const scored = per.filter((p) => p.status !== "failed" && p.ref !== undefined && p.refStatus !== "excluded");
const groups: Record<string, any> = {};
for (const set of ["dev", "holdout"]) for (const type of ["dbq", "leq", "saq", "all"]) {
  const sel = scored.filter((p) => isMain(p) && p.set === set && (type === "all" || p.type === type)); if (sel.length) groups[`${set}/${type}`] = stats(sel);
}
// row-level
const rowStats: Record<string, any> = {};
for (const set of ["dev", "holdout"]) for (const type of ["dbq", "leq", "saq"]) for (const k of ROWS[type]) {
  const cells = scored.filter((p) => isMain(p) && p.set === set && p.type === type && p.rows).map((p) => p.rows[k]); if (!cells.length) continue;
  rowStats[`${set}/${type}/${k}`] = { n: cells.length, exact: pct(cells.filter((c) => c.ai === c.ref).length, cells.length), exactOrAmbigOffBy1: pct(cells.filter((c) => c.ai === c.ref || (c.ambiguous && Math.abs(c.ai - c.ref) <= 1)).length, cells.length), meanBias: +(sum(cells.map((c) => c.ai - c.ref)) / cells.length).toFixed(2) };
}
const rowAll = (set: string) => { const cells = scored.filter((p) => isMain(p) && p.set === set && p.rows).flatMap((p) => Object.values(p.rows) as any[]); return { n: cells.length, exact: pct(cells.filter((c) => c.ai === c.ref).length, cells.length) }; };
// ordering
const ordering: any[] = [];
for (const q of ["DBQA", "DBQB", "LEQA", "LEQB", "SAQA"]) {
  const m = scored.filter((p) => p.id.startsWith(q + "-") && isMain(p)); let pairs = 0, viol = 0; const bad: string[] = [];
  for (const a of m) for (const b of m) if (a.ref > b.ref) { pairs++; if (a.ai < b.ai) { viol++; bad.push(`${a.id}(ref ${a.ref}, ai ${a.ai}) < ${b.id}(ref ${b.ref}, ai ${b.ai})`); } }
  ordering.push({ q, pairs, violations: viol, bad });
}
// safety
const vague = per.filter((p) => p.cat === "long_fluent_vague").map((p) => ({ id: p.id, ai: p.ai, rangeHi: p.range[1], over: p.ai > p.range[1] }));
const inj = per.filter((p) => p.cat?.startsWith("injection")).map((p) => { const b = byId[baseOf[p.id]]; const bt = b?.total ?? null; return { id: p.id, ai: p.ai, cleanBaseAi: bt, rangeHi: p.range[1], inflatedVsClean: bt != null && p.ai > bt, overRange: p.ai > p.range[1], rowsMax: Object.values(p.rows).filter((c: any) => c.ai > c.ref).length }; });
const irr = per.filter((p) => p.cat === "irrelevant").map((p) => ({ id: p.id, ai: p.ai }));
// over/under
const over = scored.filter((p) => isMain(p) && p.ai > p.range[1]).map((p) => ({ id: p.id, cat: p.cat, ref: p.ref, ai: p.ai, range: p.range }));
const under = scored.filter((p) => isMain(p) && p.ai < p.range[0]).map((p) => ({ id: p.id, cat: p.cat, ref: p.ref, ai: p.ai, range: p.range }));
// reproducibility
const doneAll = per.filter((p) => p.status !== "failed" && p.run1 !== undefined);
const repro = { essays: doneAll.length, totalWithin1: pct(doneAll.filter((p) => Math.abs(p.run1 - p.run2) <= 1).length, doneAll.length), totalIdentical: pct(doneAll.filter((p) => p.run1 === p.run2).length, doneAll.length),
  rowIdentical: pct(doneAll.flatMap((p) => Object.values(p.rows) as any[]).filter((c) => c.run1 === c.run2).length, doneAll.flatMap((p) => Object.values(p.rows)).length), disagreementFlagRate: pct(doneAll.filter((p) => p.disagreement).length, doneAll.length),
  maxTotalGap: Math.max(...doneAll.map((p) => Math.abs(p.run1 - p.run2))) };
const out = { labels, groups, rowAllExact: { dev: rowAll("dev"), holdout: rowAll("holdout") }, rowStats, ordering, vague, injection: inj, irrelevant: irr, over, under, repro, failed: per.filter((p) => p.status === "failed" || p.status === "skipped_before_call").map((p) => p.id), excluded: per.filter((p) => p.refStatus === "excluded").map((p) => p.id), per: per.map(({ rows, ...p }) => ({ ...p, rowDiffs: rows ? Object.entries(rows).filter(([, c]: any) => c.ai !== c.ref).map(([k, c]: any) => `${k}:${c.ref}->${c.ai}${c.ambiguous ? "~" : ""}`) : [] })) };
writeFileSync(`${DIR}/analysis-${labels.join("+")}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ groups, rowAllExact: out.rowAllExact, ordering: ordering.map((o) => `${o.q}:${o.violations}/${o.pairs}`), vague, injection: inj, irrelevant: irr, over, under, repro, failed: out.failed }, null, 1));
console.log(out.per.map((p: any) => p.status ? `${p.id} ${p.status}` : `${p.id.padEnd(10)} ref ${p.ref} [${p.range}] ai ${p.ai} (${p.run1}/${p.run2}) ${p.inRange ? "" : "OUT"} ${p.rowDiffs.join(" ")}`).join("\n"));
