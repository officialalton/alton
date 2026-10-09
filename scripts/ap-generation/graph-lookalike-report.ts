// 신규 그래프 배치의 구조 look-alike 판정(무료·읽기 전용): 통과 항목마다 기존 재고 전체·같은 배치의 다른 항목과 군집이 되는지 본다. 군집이 되면 '신규 고유 항목'으로 세지 않는다.
//   npx tsx scripts/ap-generation/graph-lookalike-report.ts --file graph-s1-items [--write <json>]
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { lookAlikeReason } from "../../lib/ap-exam/look-alike";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const NEW = arg("--file", "graph-s1-items");
type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; skillPrimary?: string; payload: Record<string, unknown>; duplicateOf?: string | null; archetype?: string };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const load = (f: string) => JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[];
const P = (r: Raw) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const ok = (i: Raw) => (i.apSubjectCode === "ap_calculus_ab" || i.apSubjectCode === "ap_calculus_bc") && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf && i.kind === "mc";
const oldFiles = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items", "graph-s1-items", "graph-s2a-items", "graph-s2b-items", "graph-s3a-items", "graph-s3b-items", "graph-s3c-items", "graph-s3d-items"].filter((f) => f !== NEW);
const olds = oldFiles.flatMap((f) => { try { return load(f); } catch { return []; } }).filter(ok);
const news = load(NEW).filter(ok);
const inp = (i: Raw) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking });
const oldIn = olds.map(inp); const newIn = news.map(inp);
const rows = news.map((n, idx) => {
  const a = newIn[idx]; const g = gateCandidate({ stockKey: n.stockKey, candidateKey: n.stockKey, apSubjectCode: n.apSubjectCode, kind: "mc", payload: n.payload });
  const hits: string[] = [];
  for (const b of oldIn) { const r = lookAlikeReason({ ...a, family: `x:${a.key}` }, { ...b, family: `y:${b.key}` }); if (r) hits.push(`stock ${b.key} (${r})`); }
  newIn.forEach((b, j) => { if (j === idx) return; const r = lookAlikeReason({ ...a, family: `x:${a.key}` }, { ...b, family: `y:${b.key}` }); if (r) hits.push(`new ${b.key} (${r})`); });
  return { key: n.stockKey, topic: n.keywordCode, skill: n.skillPrimary, calc: n.calculator, arch: P(n).archetype, graphRequired: g.need === "required" && g.stimKind === "graph", status: g.status, hits };
});
const counted = rows.filter((r) => r.graphRequired && r.status !== "fail" && r.hits.length === 0);
console.log(`신규 통과 ${rows.length}, 그래프 필수 ${rows.filter((r) => r.graphRequired).length}, look-alike 없음(고유로 셈) ${counted.length}, 탈락 ${rows.length - counted.length}`);
for (const r of rows.filter((x) => x.hits.length)) console.log("LOOK-ALIKE", r.key, r.arch, r.hits.join("; "));
if (arg("--write")) writeFileSync(arg("--write"), JSON.stringify({ rows, counted: counted.map((r) => r.key) }, null, 1));
const by = (f: (r: (typeof rows)[number]) => string) => { const m = new Map<string, number>(); for (const r of counted) m.set(f(r), (m.get(f(r)) ?? 0) + 1); return [...m].sort().map(([k, v]) => `${k}:${v}`).join(" "); };
console.log("단원", by((r) => `u${r.topic.split(".")[0]}`)); console.log("스킬", by((r) => `s${(r.skill ?? "0")[0]}`)); console.log("계산기", by((r) => r.calc)); console.log("원형", counted.length, "개 서로 다른 원형", new Set(counted.map((r) => r.arch)).size);
