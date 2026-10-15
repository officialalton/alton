// AP U.S. History 런 마무리(LLM·DB 없음): 런(<run>/candidates.json)을 재고 행으로 만들어 data/ap/stock/<batch>-{items,pass-keys,summary}.json 을 쓴다. micro-finalize.ts 와 같은 방식 + 영어 요약(키 신뢰도 분포·스킬 범주·단계별 통과율).
//   npx tsx scripts/ap-generation/ushistory-finalize.ts --runs ush-p1-a --batch ush-p1a
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LATEST_GATE, buildStock, type RawCand } from "../../lib/ap-generation/stock";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { ushSkillCat } from "../../lib/ap-exam/ush-rules";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = arg("--runs", "ush-p1-a").split(","), BATCH = arg("--batch", "ush-p1a");
const root = path.resolve("data/ap/sample-2027"), out = path.resolve("data/ap/stock");
const runs: Record<string, RawCand[]> = {};
for (const r of RUNS) { const f = path.join(root, r, "candidates.json"); if (existsSync(f)) runs[r] = (JSON.parse(readFileSync(f, "utf-8")) as RawCand[]).map((c) => ({ ...c, gateOverride: LATEST_GATE } as RawCand)); }
// 표시 형식 정규화(멱등): 초기 실행의 set_intro 는 표지 뒤에 빈 구분선이 끼어 있다("ALTON-composed stimulus\n\n———\n\n(…)"). 학생 화면용 형식으로 고친다.
for (const list of Object.values(runs)) for (const c of list) { const p = c.payload as { set_intro?: unknown } | undefined; if (p && typeof p.set_intro === "string") p.set_intro = p.set_intro.replace(/^ALTON-composed stimulus\n\n———\n\n/, "ALTON-composed stimulus\n"); }
const items = buildStock(runs, {});
writeFileSync(path.join(out, `${BATCH}-items.json`), JSON.stringify(items.map((i) => ({ ...i })), null, 0));
const pass = items.filter((i) => i.validation === "auto_passed" && !i.duplicateOf && generatorDefects(i.payload).length === 0);
writeFileSync(path.join(out, `${BATCH}-pass-keys.json`), "[\n" + pass.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");

const stageCost = (dir: string) => { const c: Record<string, number> = {}; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (j.cached) continue; c[f.replace(/\.results\.jsonl$/, "")] = (c[f.replace(/\.results\.jsonl$/, "")] ?? 0) + Number(j.cost ?? 0); } catch { /* skip */ } } return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v.toFixed(4))])); };
type It = { skill?: string; key_confidence?: { score: number; band: string } };
const mcRows = items.filter((i) => i.kind === "mc"), frqRows = items.filter((i) => i.kind !== "mc");
const passMc = mcRows.filter((i) => pass.includes(i)); const passItems = passMc.flatMap((i) => ((i.payload.items as It[]) ?? []));
const auditRows = RUNS.flatMap((r) => { const f = path.join(root, r, "audit.json"); return existsSync(f) ? (JSON.parse(readFileSync(f, "utf-8")) as { skill?: string; det?: string[]; solverAgree?: number; adversary?: string | null; judge?: string | null; score?: number; pass?: boolean; reasons?: string[]; tier?: string }[]) : []; });
const itemAudit = auditRows.filter((a) => a.skill !== undefined);
const by = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((o, x) => { const k = f(x); o[k] = (o[k] ?? 0) + 1; return o; }, {});
const summary = {
  runs: RUNS, rows: items.length, passed: pass.length, rejected: items.length - pass.length,
  mcSets: { rows: mcRows.length, passed: passMc.length }, frqSets: { rows: frqRows.length, passed: frqRows.filter((i) => pass.includes(i)).length },
  mcItems: { generated: itemAudit.length, deterministicPass: itemAudit.filter((a) => (a.det ?? []).length === 0).length, solvers3of3: itemAudit.filter((a) => a.solverAgree === 1).length, finalPass: itemAudit.filter((a) => a.pass).length, firstPassRate: Number((itemAudit.filter((a) => a.pass).length / Math.max(1, itemAudit.length)).toFixed(3)) },
  failureReasons: by(itemAudit.filter((a) => !a.pass).flatMap((a) => (a.reasons ?? []).map((r) => r.replace(/_\d.*$/, ""))), (r) => r),
  keyConfidence: { items: passItems.length, high: passItems.filter((i) => i.key_confidence?.band === "high").length, medium: passItems.filter((i) => i.key_confidence?.band === "medium").length, mean: Number((passItems.reduce((a, i) => a + (i.key_confidence?.score ?? 0), 0) / Math.max(1, passItems.length)).toFixed(3)) },
  categoriesPassed: by(passItems, (i) => ushSkillCat(i.skill)), skillsPassed: by(passItems, (i) => String(i.skill)),
  renderTypesPassed: by(pass.map((r) => gateCandidate({ candidateKey: r.stockKey, stockKey: r.stockKey, apSubjectCode: r.apSubjectCode, kind: r.kind, payload: r.payload as Record<string, unknown> })), (g) => g.renderType),
  frqAudit: auditRows.filter((a) => a.tier),
  costUsd: Object.fromEntries(RUNS.filter((r) => existsSync(path.join(root, r))).map((r) => [r, stageCost(path.join(root, r))])),
};
writeFileSync(path.join(out, `${BATCH}-summary.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
