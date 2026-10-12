// 그래프·일반 신규 배치 전체 요약(무료·읽기 전용): 통과 항목의 단원·스킬·표현·계산기·고유 문항군, 기존 재고(이번 배치 제외) 및 신규끼리 look-alike. 디스크 무변경.
//   npx tsx scripts/ap-generation/graph-batch-summary.ts
import { readFileSync, readdirSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes, lookAlikeReason } from "../../lib/ap-exam/look-alike";
type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; skillPrimary?: string; payload: Record<string, unknown>; duplicateOf?: string | null };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const load = (f: string) => JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8")) as Raw[];
const P = (r: Raw) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const ok = (i: Raw) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf;
const newFiles = readdirSync("data/ap/stock").filter((f) => /^graph-s.*-items\.json$/.test(f)).sort();
const oldFiles = ["items.json", "s1a-items.json", "v1ab-items.json", "v45ab-items.json", "bc-topup-items.json"];
const olds = oldFiles.flatMap(load).filter((i) => ok(i) && i.kind === "mc"); const seen = new Set<string>();
const oldIn = olds.filter((r) => (seen.has(r.stockKey) ? false : (seen.add(r.stockKey), true))).map((i) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking }));
const rowsAll = newFiles.flatMap((f) => load(f).map((r) => ({ f, r })));
const passed = rowsAll.filter(({ r }) => ok(r) && r.kind === "mc");
const newIn = passed.map(({ r }) => ({ key: r.stockKey, family: `n:${r.stockKey}`, archetype: P(r).archetype, topic: r.keywordCode, stimKind: P(r).stimulus?.kind ?? "none", stem: P(r).stem ?? "", thinking: P(r).blueprint?.student_thinking }));
let rejectedLA = 0; const counted: { r: Raw; graph: boolean }[] = []; const la: string[] = [];
passed.forEach(({ r }, idx) => {
  const a = newIn[idx]; const g = gateCandidate({ stockKey: r.stockKey, candidateKey: r.stockKey, apSubjectCode: r.apSubjectCode, kind: "mc", payload: r.payload });
  const hits = [...oldIn.map((b) => ({ b, o: "stock" })), ...newIn.filter((_, j) => j !== idx).map((b) => ({ b, o: "new" }))].filter(({ b }) => lookAlikeReason({ ...a, family: `x:${a.key}` }, { ...b, family: `y:${b.key}` }));
  if (hits.length) { rejectedLA++; la.push(`${r.stockKey} ~ ${hits.map((h) => h.o + ":" + h.b.key).join(",")}`); return; }
  counted.push({ r, graph: g.need === "required" && g.stimKind === "graph" });
});
const cnt = (xs: typeof counted, f: (x: Raw) => string) => { const m = new Map<string, number>(); for (const { r } of xs) m.set(f(r), (m.get(f(r)) ?? 0) + 1); return [...m].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([k, v]) => `${k}:${v}`).join(" "); };
const fam = clusterLookAlikes(counted.map(({ r }) => ({ key: r.stockKey, family: r.itemFamilyId, archetype: P(r).archetype, topic: r.keywordCode, stimKind: P(r).stimulus?.kind ?? "none", stem: P(r).stem ?? "", thinking: P(r).blueprint?.student_thinking })));
console.log(`배치 파일 ${newFiles.length}개, 후보 ${rowsAll.length}(MC ${rowsAll.filter((x) => x.r.kind === "mc").length}, FRQ ${rowsAll.filter((x) => x.r.kind !== "mc").length}), 자동 통과 ${rowsAll.filter(({ r }) => ok(r)).length}(MC ${passed.length}, FRQ ${rowsAll.filter(({ r }) => ok(r) && r.kind !== "mc").length})`);
console.log(`통과 MC 중 look-alike 로 탈락 ${rejectedLA}, 고유로 셈 ${counted.length}(그래프 필수 ${counted.filter((c) => c.graph).length}, 일반 ${counted.filter((c) => !c.graph).length}), 서로 다른 문항군 ${new Set(counted.map(({ r }) => fam.effectiveFamily.get(r.stockKey))).size}`);
for (const [name, xs] of [["그래프 필수", counted.filter((c) => c.graph)], ["일반(그래프 없음)", counted.filter((c) => !c.graph)]] as const) { console.log(`[${name}] ${xs.length}건`); console.log("  단원", cnt(xs, (r) => `u${r.keywordCode.split(".")[0]}`)); console.log("  스킬", cnt(xs, (r) => `s${(r.skillPrimary ?? "0")[0]}`)); console.log("  계산기", cnt(xs, (r) => r.calculator)); console.log("  과목", cnt(xs, (r) => r.apSubjectCode.slice(-2))); console.log("  표현", cnt(xs, (r) => P(r).stimulus?.kind ?? "none")); }
if (la.length) console.log("LOOK-ALIKE", la.join("\n"));
const frqPassed = rowsAll.filter(({ r }) => ok(r) && r.kind !== "mc"); console.log("FRQ 통과", frqPassed.map(({ r }) => `${r.stockKey}(${r.keywordCode},${r.calculator})`).join(" "));
