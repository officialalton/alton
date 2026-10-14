// AP Computer Science A 런 마무리(LLM·DB 없음): 런(<run>/candidates.json)을 재고 행으로 만들어 data/ap/stock/<batch>-{items,pass-keys,summary}.json 을 쓴다. micro-finalize.ts 와 같은 방식(코드 문항은 TeX 위생 불필요).
//   npx tsx scripts/ap-generation/cs-finalize.ts --runs csa-p1-a --batch csa-p1a
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LATEST_GATE, buildStock, type RawCand } from "../../lib/ap-generation/stock";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { gateCandidate } from "../../lib/ap-figures/gate";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = arg("--runs", "csa-p1-a").split(","), BATCH = arg("--batch", "csa-p1a");
const root = path.resolve("data/ap/sample-2027"), out = path.resolve("data/ap/stock");
const runs: Record<string, RawCand[]> = {};
for (const r of RUNS) { const f = path.join(root, r, "candidates.json"); if (existsSync(f)) runs[r] = (JSON.parse(readFileSync(f, "utf-8")) as RawCand[]).map((c) => ({ ...c, gateOverride: LATEST_GATE } as RawCand)); }
const items = buildStock(runs, {});
writeFileSync(path.join(out, `${BATCH}-items.json`), JSON.stringify(items.map((i) => ({ ...i })), null, 0));
const pass = items.filter((i) => i.validation === "auto_passed" && !i.duplicateOf && generatorDefects(i.payload).length === 0);
writeFileSync(path.join(out, `${BATCH}-pass-keys.json`), "[\n" + pass.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");

type Pl = { archetype?: string; topic?: string; skill?: string; stimulus?: { kind?: string }; total_points?: number };
const stageCost = (dir: string) => { let c = 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { c += Number(JSON.parse(l).cost ?? 0); } catch { /* skip */ } } return Number(c.toFixed(4)); };
const rows = items.map((i) => { const p = i.payload as Pl; const g = gateCandidate({ candidateKey: i.stockKey, stockKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload as Record<string, unknown> }); return { key: i.stockKey, kind: i.kind, validation: i.validation, passed: pass.includes(i), archetype: p.archetype, unit: String(p.topic ?? "").split(".")[0], skill: p.skill, fig: p.stimulus?.kind ?? "none", renderType: g.renderType }; });
const by = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((o, x) => { const k = f(x); o[k] = (o[k] ?? 0) + 1; return o; }, {});
const mc = rows.filter((r) => r.kind === "mc"), fq = rows.filter((r) => r.kind !== "mc");
const summary = {
  runs: RUNS, rows: items.length, passed: pass.length, rejected: items.length - pass.length, passRate: Number((pass.length / Math.max(1, items.length)).toFixed(3)),
  mc: { rows: mc.length, passed: mc.filter((r) => r.passed).length, passRate: Number((mc.filter((r) => r.passed).length / Math.max(1, mc.length)).toFixed(3)) },
  frq: { rows: fq.length, passed: fq.filter((r) => r.passed).length, passRate: Number((fq.filter((r) => r.passed).length / Math.max(1, fq.length)).toFixed(3)) },
  unitsPassed: by(mc.filter((r) => r.passed), (r) => r.unit), skillsPassed: by(mc.filter((r) => r.passed), (r) => String(r.skill)), figPassed: by(rows.filter((r) => r.passed), (r) => r.fig), figAll: by(rows, (r) => r.fig),
  figPassRate: Object.fromEntries(Object.keys(by(rows, (r) => r.fig)).map((k) => [k, `${rows.filter((r) => r.passed && r.fig === k).length}/${rows.filter((r) => r.fig === k).length}`])),
  renderTypesPassed: by(rows.filter((r) => r.passed), (r) => r.renderType), archetypesPassed: by(rows.filter((r) => r.passed), (r) => String(r.archetype)), archetypesAll: by(rows, (r) => String(r.archetype)),
  failedArchetypes: Object.keys(by(rows, (r) => String(r.archetype))).filter((a) => !rows.some((r) => r.archetype === a && r.passed)),
  costUsd: Object.fromEntries(RUNS.filter((r) => existsSync(path.join(root, r))).map((r) => [r, stageCost(path.join(root, r))])),
};
writeFileSync(path.join(out, `${BATCH}-summary.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
