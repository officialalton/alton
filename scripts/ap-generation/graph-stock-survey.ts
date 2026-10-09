// 읽기 전용: 현재 재고의 그래프 필수 MC 를 단원·원형·군집별로 나열한다(디스크 무변경). npx tsx scripts/ap-generation/graph-stock-survey.ts
import { readFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; payload: Record<string, unknown>; skillPrimary?: string; duplicateOf?: string | null };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const raws = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items"].flatMap((f) => JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]).filter((i) => (i.apSubjectCode === "ap_calculus_ab" || i.apSubjectCode === "ap_calculus_bc") && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf && i.kind === "mc");
const seen = new Set<string>(); const uniq = raws.filter((r) => (seen.has(r.stockKey) ? false : (seen.add(r.stockKey), true)));
const P = (r: Raw) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const gated = uniq.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
const cl = clusterLookAlikes(gated.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking })));
const rows = gated.filter((x) => x.g.need === "required" && x.g.stimKind === "graph").map(({ i }) => ({ key: i.stockKey, subj: i.apSubjectCode.slice(-2), topic: i.keywordCode, calc: i.calculator, arch: P(i).archetype, fam: cl.effectiveFamily.get(i.stockKey) }));
rows.sort((a, b) => a.topic.localeCompare(b.topic, undefined, { numeric: true }));
for (const r of rows) console.log([r.subj, r.topic, r.calc, r.arch, r.fam, r.key].join("\t"));
console.log("graph-required MC", rows.length, "distinct clusters", new Set(rows.map((r) => r.fam)).size);
