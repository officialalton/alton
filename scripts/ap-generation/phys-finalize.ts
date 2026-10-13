// AP Physics 1 파일럿 마무리(LLM·DB 없음): 런(<run>/candidates.json)을 재고 행으로 만들어 data/ap/stock/<batch>-{items,pass-keys,summary}.json 을 쓴다.
//   npx tsx scripts/ap-generation/phys-finalize.ts --runs phys-p1-a --batch phys-p1a
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LATEST_GATE, buildStock, type RawCand } from "../../lib/ap-generation/stock";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { gateCandidate } from "../../lib/ap-figures/gate";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = arg("--runs", "phys-p1-a").split(","), BATCH = arg("--batch", "phys-p1a");
const root = path.resolve("data/ap/sample-2027"), out = path.resolve("data/ap/stock");
const runs: Record<string, RawCand[]> = {};
for (const r of RUNS) { const f = path.join(root, r, "candidates.json"); if (existsSync(f)) runs[r] = (JSON.parse(readFileSync(f, "utf-8")) as RawCand[]).map((c) => ({ ...c, gateOverride: LATEST_GATE } as RawCand)); }
const items = buildStock(runs, {});
// 결정적 TeX 위생(의미 변경 없음): 유료 런 시점의 생성기가 \text{ m/s^2} 처럼 text 안에 ^ 를 넣었다(KaTeX 가 거부 → 화면 증거에서 원문 수식 노출). 지수를 text 밖으로 옮긴다. 생성기는 같은 커밋에서 고쳤다(phys_common.unit_tex).
const fixTex = (v: unknown): unknown => typeof v === "string" ? v.replace(/\\text\{([^}^_]*?)\^(\{?-?\d+\}?)\}/g, (_m, a: string, e: string) => `\\text{${a}}^{${e.replace(/[{}]/g, "")}}`) : Array.isArray(v) ? v.map(fixTex) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fixTex(x)])) : v;
for (const i of items) i.payload = fixTex(i.payload) as typeof i.payload;
for (const i of items) if (Array.isArray(i.payload.items)) { i.structure = "shared_stimulus_set"; i.stockCell = i.stockCell.replace("|shared_set|", "|shared_stimulus_set|"); }
writeFileSync(path.join(out, `${BATCH}-items.json`), JSON.stringify(items.map((i) => ({ ...i })), null, 0));
const pass = items.filter((i) => i.validation === "auto_passed" && !i.duplicateOf && generatorDefects(i.payload).length === 0);
writeFileSync(path.join(out, `${BATCH}-pass-keys.json`), "[\n" + pass.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");

type Pl = { archetype?: string; topic?: string; option_scenes?: unknown[]; stimulus?: { kind?: string; data?: { variant?: string } }; items?: Pl[] };
const first = (p: Pl): Pl => (Array.isArray(p.items) ? p.items[0] : p);
const figKind = (p: Pl) => { const f = first(p); return f.option_scenes ? "choice_scenes" : (p.stimulus ?? f.stimulus)?.kind === "diagram" ? "scene" : (p.stimulus ?? f.stimulus)?.kind === "graph" ? "graph" : "none"; };
const stageCost = (dir: string) => { let c = 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { c += Number(JSON.parse(l).cost ?? 0); } catch { /* skip */ } } return Number(c.toFixed(4)); };
const rows = items.map((i) => { const p = i.payload as Pl; const g = gateCandidate({ candidateKey: i.stockKey, stockKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload as Record<string, unknown> }); return { key: i.stockKey, validation: i.validation, passed: pass.includes(i), archetype: first(p).archetype, unit: String(first(p).topic ?? "").split(".")[0], fig: figKind(p), renderType: g.renderType, renderStatus: g.status }; });
const by = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((o, x) => { const k = f(x); o[k] = (o[k] ?? 0) + 1; return o; }, {});
const summary = {
  runs: RUNS, rows: items.length, passed: pass.length, rejected: items.length - pass.length,
  passRate: Number((pass.length / Math.max(1, items.length)).toFixed(3)),
  singles: { candidates: rows.filter((r) => !String(r.key).includes("-set")).length },
  unitsPassed: by(rows.filter((r) => r.passed), (r) => r.unit), figPassed: by(rows.filter((r) => r.passed), (r) => r.fig), figAll: by(rows, (r) => r.fig),
  figPassRate: Object.fromEntries(Object.keys(by(rows, (r) => r.fig)).map((k) => [k, `${rows.filter((r) => r.passed && r.fig === k).length}/${rows.filter((r) => r.fig === k).length}`])),
  renderTypesPassed: by(rows.filter((r) => r.passed), (r) => r.renderType), archetypesPassed: by(rows.filter((r) => r.passed), (r) => String(r.archetype)),
  costUsd: Object.fromEntries(RUNS.filter((r) => existsSync(path.join(root, r))).map((r) => [r, stageCost(path.join(root, r))])),
};
writeFileSync(path.join(out, `${BATCH}-summary.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
