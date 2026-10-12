// 그래프 원형 무료 사전 점검(LLM·DB·네트워크 없음, 디스크 무변경): 원형별 후보 팩에 결정적 게이트·설계도·그림 게이트·구조 look-alike(기존 재고 전체 + 이번 배치)를 돌린다.
//   npx tsx scripts/ap-generation/graph-precheck.ts --list graph_s1_ab --subject ap_calculus_ab [--seed0 3100] [--n 1]
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes, lookAlikeReason } from "../../lib/ap-exam/look-alike";
import { calibrateMc, gateMc, gateNoCalcExact, type McPack } from "../../lib/ap-generation/gates";
import { gateGuideMc } from "../../lib/ap-generation/guide-gates";
import { GUIDES } from "../../lib/ap-generation/subjects/calc-bc";
import { validateBlueprint, type Blueprint } from "../../lib/ap-generation/blueprint";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIST = arg("--list", "graph_s1_ab"); const SUBJECT = arg("--subject", "ap_calculus_ab"); const SEED0 = Number(arg("--seed0", "3100")); const N = Number(arg("--n", "1"));
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const ARCH = path.resolve("scripts/ap-generation/archetypes");
const py = (a: string[]): unknown => { const r = spawnSync(PY, ["-B", "registry.py", ...a], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr.slice(-300)); return JSON.parse(r.stdout); };
const curriculum = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const skillSet = new Set(curriculum.skills.map((s) => s.code)); const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const guide = GUIDES[SUBJECT as keyof typeof GUIDES];
const plain = (t: string) => t.replace(/\$/g, "");
const expl = (p: McPack) => `The correct answer is ${plain(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${plain(x.text)} is incorrect: ${x.why}`).join("\n");

// ---- 기존 재고(look-alike 기준): six-set-plan 과 같은 정의
type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; itemFamilyId: string; payload: Record<string, unknown>; duplicateOf?: string | null };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const P = (r: { payload: Record<string, unknown> }) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const stockFiles = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items"]; const extra = (process.env.PRECHECK_EXTRA_STOCK ?? "").split(",").filter(Boolean);
const raws = [...stockFiles, ...extra].flatMap((f) => JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]).filter((i) => (i.apSubjectCode === "ap_calculus_ab" || i.apSubjectCode === "ap_calculus_bc") && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf && i.kind === "mc");
const seen = new Set<string>(); const stock = raws.filter((r) => (seen.has(r.stockKey) ? false : (seen.add(r.stockKey), true)));
const stockIn = stock.map((i) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking }));

const names = (py(["list", LIST]) as { mc: string[] }).mc; const rows: { name: string; reasons: string[]; fig: string; need: string; pack: Record<string, unknown> }[] = [];
for (const n of names) {
  const packs = py(["batch", n, String(N), String(SEED0)]) as Record<string, unknown>[];
  if (!packs.length) { rows.push({ name: n, reasons: ["no_pack"], fig: "-", need: "-", pack: {} }); continue; }
  const p = packs[0]; const mp = { ...(p as unknown as McPack) }; mp.explanation_en = expl(mp);
  const reasons = [...gateMc(SUBJECT, mp), ...calibrateMc(SUBJECT, mp), ...gateGuideMc(guide as never, mp), ...gateNoCalcExact(mp)];
  reasons.push(...validateBlueprint(p.blueprint as Partial<Blueprint>, { skills: skillSet, topicUnit: topicUnit as Map<string, string> }).map((x) => `blueprint:${x.code}`));
  reasons.push(...generatorDefects(mp as unknown as Record<string, unknown>).map((d) => `generator_defect:${d.code}`));
  const g = gateCandidate({ stockKey: `new:${n}`, candidateKey: `new:${n}`, apSubjectCode: SUBJECT, kind: "mc", payload: { ...p, stimulus: p.stimulus } as Record<string, unknown> });
  for (const i of g.issues) if (i.level === "error") reasons.push(`figure:${i.code}`);
  if (g.status === "fail") reasons.push("figure_status_fail");
  if (!n.startsWith("c_") && g.need !== "required") reasons.push(`figure_need_${g.need}`); // c_ = 그래프 없는 일반 계산기 문항
  rows.push({ name: n, reasons: [...new Set(reasons)], fig: `${g.status}/${g.stimKind}${g.issues.filter((i) => i.level === "warn").length ? "+" + g.issues.filter((i) => i.level === "warn").map((i) => i.code).join(",") : ""}`, need: g.need, pack: p });
}
// look-alike: 신규(첫 팩) 각각을 기존 재고 전체와 신규끼리 비교
const newIn = rows.filter((r) => r.pack.stem).map((r) => ({ key: `new:${r.name}`, family: `new:${r.name}`, archetype: r.name, topic: String(r.pack.topic), stimKind: String((r.pack.stimulus as { kind?: string })?.kind ?? "none"), stem: String(r.pack.stem), thinking: ((r.pack.blueprint as Blueprint | undefined)?.student_thinking) }));
const hits: string[] = [];
for (const a of newIn) { for (const b of [...stockIn, ...newIn]) { if (a.key === b.key || (b.key.startsWith("new:") && b.key < a.key)) continue; const r = lookAlikeReason(a, b); if (r) hits.push(`${a.key} ~ ${b.key} (${r})`); } }
void clusterLookAlikes;
let ok = 0;
for (const r of rows) { const bad = r.reasons.length > 0 || hits.some((h) => h.startsWith(`new:${r.name} `) || h.includes(`~ new:${r.name} `)); if (!bad) ok++; console.log(`${bad ? "FAIL" : "ok  "} ${r.name.padEnd(34)} ${String(r.pack.topic ?? "").padEnd(6)} ${String(r.pack.skill ?? "").padEnd(4)} ${String(r.pack.calculator ?? "").padEnd(11)} fig=${r.fig} ${r.reasons.join(",")}`); }
console.log(`archetypes ${rows.length}, clean ${ok}`); if (hits.length) console.log("look-alike hits:\n" + hits.join("\n"));
