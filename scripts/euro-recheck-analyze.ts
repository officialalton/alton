// 재검증 결과 집계(사전 등록 기준 P1–P12). 사용: npx tsx scripts/euro-recheck-analyze.ts → data/ap/euro-selfcheck-2/analysis.json
import { readFileSync, writeFileSync } from "node:fs";
const DIR = "data/ap/euro-selfcheck-2";
const ref = JSON.parse(readFileSync(`${DIR}/reference.json`, "utf-8")).reference as Record<string, any>;
const reps: Record<string, Record<string, any>> = { rep1: JSON.parse(readFileSync(`${DIR}/results-rep1.json`, "utf-8")).results, rep2: JSON.parse(readFileSync(`${DIR}/results-rep2.json`, "utf-8")).results };
const designs = (JSON.parse(readFileSync(`${DIR}/designs.json`, "utf-8")).designs as any[]);
const pct = (n: number, d: number) => (d ? +((100 * n) / d).toFixed(1) : null);
const out: any = { per: [] };
for (const repName of ["rep1", "rep2"]) {
  const R = reps[repName];
  const rows = designs.filter((d) => ref[d.id]?.status === "consensus" && R[d.id]?.status === "accept").map((d) => ({ id: d.id, type: d.type, cat: d.cat, q: d.q, ref: ref[d.id].total as number, ai: R[d.id].total as number, d: R[d.id].total - ref[d.id].total }));
  const stat = (xs: typeof rows) => ({ n: xs.length, exact: pct(xs.filter((x) => x.d === 0).length, xs.length), within1: pct(xs.filter((x) => Math.abs(x.d) <= 1).length, xs.length), meanSigned: xs.length ? +(xs.reduce((n, x) => n + x.d, 0) / xs.length).toFixed(2) : null });
  const rowCells: { key: string; d: number }[] = [];
  for (const d of designs) if (ref[d.id]?.status !== undefined && R[d.id]?.status === "accept") for (const [k, v] of Object.entries(ref[d.id].rows as Record<string, any>)) if (v.value !== null) rowCells.push({ key: `${d.type}/${k}`, d: R[d.id].scores[k] - v.value });
  const byRow: Record<string, any> = {}; for (const c of rowCells) (byRow[c.key] ??= []).push(c.d);
  const pairs: any[] = [];
  for (const q of ["LEQ-C", "DBQ-C"]) { const m = rows.filter((x) => x.q === q); for (const a of m) for (const b of m) if (a.ref > b.ref && a.ai < b.ai) pairs.push(`${a.id}(ref ${a.ref},ai ${a.ai}) < ${b.id}(ref ${b.ref},ai ${b.ai})`); }
  const vague = designs.filter((d) => d.cat === "long_fluent_vague").map((d) => ({ id: d.id, ref: ref[d.id]?.total, ai: R[d.id]?.total, status: R[d.id]?.status }));
  const inj = designs.filter((d) => d.cat === "injection_direct").map((d) => ({ id: d.id, status: R[d.id].status, total: R[d.id].total, firstPassTotal: R[d.id].firstPassTotal, passes: R[d.id].passes, base: d.base, baseAi: R[d.base]?.total, baseRef: ref[d.base]?.total }));
  const irr = designs.filter((d) => d.cat === "irrelevant").map((d) => ({ id: d.id, status: R[d.id].status, total: R[d.id].total, firstPassTotal: R[d.id].firstPassTotal }));
  const nonTamper = designs.filter((d) => d.cat !== "injection_direct");
  const underReview = nonTamper.filter((d) => R[d.id].status === "under_review").map((d) => d.id);
  out[repName] = { all: stat(rows), leq: stat(rows.filter((x) => x.type === "leq")), dbq: stat(rows.filter((x) => x.type === "dbq")), rowExact: pct(rowCells.filter((c) => c.d === 0).length, rowCells.length), rowN: rowCells.length, rowBias: Object.fromEntries(Object.entries(byRow).map(([k, v]: any) => [k, { n: v.length, exact: pct(v.filter((x: number) => x === 0).length, v.length), bias: +(v.reduce((a: number, b: number) => a + b, 0) / v.length).toFixed(2) }])), orderViolations: pairs, vague, injection: inj, irrelevant: irr, underReview, underReviewRate: pct(underReview.length, nonTamper.length), callsPerEssay: +(designs.reduce((n, d) => n + (R[d.id].passes ?? 0), 0) / designs.filter((d) => R[d.id].passes).length).toFixed(2), per: designs.map((d) => ({ id: d.id, status: R[d.id].status, reason: R[d.id].reason, passes: R[d.id].passes, triggers: R[d.id].triggers, firstPassTotal: R[d.id].firstPassTotal, total: R[d.id].total, ref: ref[d.id]?.total ?? null, refStatus: ref[d.id]?.status ?? null, scores: R[d.id].scores, refRows: ref[d.id] ? Object.fromEntries(Object.entries(ref[d.id].rows).map(([k, v]: any) => [k, v.value])) : null })) };
}
// 재현성(rep1 vs rep2, 둘 다 점수가 나온 응답)
const both = designs.filter((d) => reps.rep1[d.id].status === "accept" && reps.rep2[d.id].status === "accept");
out.repro = { n: both.length, within1: pct(both.filter((d) => Math.abs(reps.rep1[d.id].total - reps.rep2[d.id].total) <= 1).length, both.length), identical: pct(both.filter((d) => reps.rep1[d.id].total === reps.rep2[d.id].total).length, both.length), rowIdentical: pct(both.flatMap((d) => Object.keys(reps.rep1[d.id].scores).map((k) => reps.rep1[d.id].scores[k] === reps.rep2[d.id].scores[k])).filter(Boolean).length, both.flatMap((d) => Object.keys(reps.rep1[d.id].scores)).length), diffs: both.filter((d) => reps.rep1[d.id].total !== reps.rep2[d.id].total).map((d) => `${d.id}:${reps.rep1[d.id].total}/${reps.rep2[d.id].total}`) };
const refEntries = Object.values(ref); const refRowsAll = refEntries.flatMap((x: any) => Object.values(x.rows) as any[]);
out.reference = { essays: refEntries.length, noConsensusEssays: refEntries.filter((x: any) => x.status === "no_consensus").length, rows: refRowsAll.length, disputedRows: refRowsAll.filter((r: any) => r.basis !== "agreed").length, noConsensusRows: refRowsAll.filter((r: any) => r.value === null).length };
writeFileSync(`${DIR}/analysis.json`, JSON.stringify(out, null, 1));
const { per: _p1, ...s1 } = out.rep1; const { per: _p2, ...s2 } = out.rep2;
console.log(JSON.stringify({ reference: out.reference, repro: out.repro, rep1: s1, rep2: s2 }, null, 1));
console.log(out.rep1.per.map((p: any, i: number) => `${p.id.padEnd(10)} ref ${p.ref}(${p.refStatus}) r1 ${p.status}${p.status === "accept" ? " " + p.total : ""}[1st ${p.firstPassTotal} passes ${p.passes}] r2 ${out.rep2.per[i].status}${out.rep2.per[i].status === "accept" ? " " + out.rep2.per[i].total : ""}`).join("\n"));
