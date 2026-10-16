// AP U.S. History 제2 모델 패널 요약(무료·읽기 전용): 각 실행의 panel.json(MC 세트: Fable 블라인드 풀이 + 사실 점검 플래그)과 frq.json 의 사실 점검 결과를 모아 data/ap/stock/ush-panel-flags.json 로 쓴다.
//   npx tsx scripts/ap-generation/ush-panel-summary.ts --runs ush-p1-a,ush-p2-a,ush-p3-a,ush-p1-b
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve("data/ap/sample-2027"); const runs = arg("--runs", "ush-p1-a,ush-p2-a,ush-p3-a,ush-p1-b").split(",");
type Flag = { where: string; kind: string; detail: string }; const out: Record<string, unknown> = {}; const kinds: Record<string, number> = {}; let sets = 0, items = 0, agree = 0;
for (const r of runs) {
  const pf = path.join(root, r, "panel.json"), sf = path.join(root, r, "sets.json"), ff = path.join(root, r, "frq.json");
  if (existsSync(pf)) { const panel = JSON.parse(readFileSync(pf, "utf-8")) as Record<string, { answers: ({ choice: number } | null)[]; flags: Flag[] }>; const rows = existsSync(sf) ? (JSON.parse(readFileSync(sf, "utf-8")) as { spec: { id: string }; items: { key_index: number }[] }[]) : [];
    for (const [id, p] of Object.entries(panel)) { sets++; const row = rows.find((x) => x.spec.id === id); p.answers.forEach((a, i) => { if (a && row?.items[i]) { items++; if (Number(a.choice) === row.items[i].key_index) agree++; } }); for (const f of p.flags) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1; out[`${r}:${id}`] = { flags: p.flags.map((f) => ({ where: f.where, kind: f.kind, detail: f.detail.slice(0, 300) })) }; } }
  if (existsSync(ff)) for (const f of JSON.parse(readFileSync(ff, "utf-8")) as { id: string; fact?: Flag[] }[]) { if (!f.fact) continue; for (const x of f.fact) kinds[`frq_${x.kind}`] = (kinds[`frq_${x.kind}`] ?? 0) + 1; out[`${r}:${f.id}`] = { flags: f.fact.map((x) => ({ where: x.where, kind: x.kind, detail: x.detail.slice(0, 300) })) }; }
}
const summary = { runs, panelSets: sets, panelItems: items, panelKeyAgreement: agree, flagKinds: kinds };
writeFileSync("data/ap/stock/ush-panel-flags.json", JSON.stringify({ summary, entries: out }, null, 1)); console.log(JSON.stringify(summary));
