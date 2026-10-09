// 풀 모의고사 문항군 상한 1 + 구조적 look-alike 점검(읽기 전용·무료·DB 없음·게시본 무변경).
//   npx tsx scripts/ap-generation/family-cap-report.ts --subject ap_calculus_ab|ap_calculus_bc [--json <scratch 경로>]
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes, lookAlikeReason } from "../../lib/ap-exam/look-alike";
import { OFFICIAL, selectMc, verify, type Cand } from "../../lib/ap-exam/ab-select";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ""; };
const SUBJECT = arg("--subject") || "ap_calculus_ab"; const BC = SUBJECT === "ap_calculus_bc";
type It = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; payload: Record<string, any>; skillPrimary?: string; duplicateOf?: string | null; archetype?: string };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const files = ["items", "s1a-items", "v1ab-items", "v45ab-items", ...(BC ? ["bc-topup-items"] : [])];
const all = files.flatMap((f) => { try { return JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as It[]; } catch { return [] as It[]; } }).filter((i) => (BC ? ["ap_calculus_ab", "ap_calculus_bc"].includes(i.apSubjectCode) : i.apSubjectCode === SUBJECT) && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
const abSel = JSON.parse(readFileSync("data/ap/stock/ab-full-set-selection.json", "utf-8")).keys as Record<string, string[]>; const abKeys = new Set(Object.values(abSel).flat());
const by = new Map(all.map((i) => [i.stockKey, i]));
const gi = (i: It) => gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload });
const mcIt = all.filter((i) => i.kind === "mc").filter((i) => gi(i).status !== "fail");
const li = (i: It) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: i.payload.archetype, topic: i.keywordCode, stimKind: i.payload.stimulus?.kind ?? "none", stem: i.payload.stem ?? "", thinking: i.payload.blueprint?.student_thinking as string[] | undefined });
const cl = clusterLookAlikes(mcIt.map(li)); const eff = cl.effectiveFamily;
const mk = (i: It): Cand => { const g = gi(i); return { key: i.stockKey, kind: "mc", unit: Number(i.keywordCode.split(".")[0]), skillCat: Number((i.skillPrimary ?? "0")[0]), calc: i.calculator as Cand["calc"], family: eff.get(i.stockKey)!, type: i.keywordCode, graphRequired: g.need === "required" && g.stimKind === "graph", screenVerified: false, renderOk: true, fullMockUses: 0, practiceUses: 0 }; };
const out: string[] = []; const P = (s = "") => out.push(s);
const raw = new Set(mcIt.map((i) => i.itemFamilyId)).size;
P(`## ${SUBJECT} 재고 (MC ${mcIt.length}건): 문항군 ID ${raw}개 -> 구조적 look-alike 병합 후 ${new Set(eff.values()).size}개; 2건 이상 군집 ${cl.clusters.length}개`);
const idOnly = cl.clusters.filter((c) => new Set(c.keys.map((k) => by.get(k)!.itemFamilyId)).size > 1);
P(`- 군 ID 가 서로 다른데 구조상 같은 군집(분류 누락 후보): ${idOnly.length}개 / 해당 문항 ${idOnly.reduce((a, c) => a + c.keys.length, 0)}건`);
for (const c of idOnly.slice(0, 40)) P(`  - ${c.reasons.join("+")}: ${c.keys.map((k) => `${k.split(":").pop()}[${by.get(k)!.keywordCode}]`).join(", ")}`);
if (!BC) {
  const order = [...abSel.mcA, ...abSel.mcB]; P(`\n## 게시본 AB 풀 모의고사 MC 42: 문항군 ID 기준 / 구조 기준 위반(위치)`);
  const g = (f: (k: string) => string) => { const m = new Map<string, number[]>(); order.forEach((k, i) => m.set(f(k), [...(m.get(f(k)) ?? []), i + 1])); return [...m.values()].filter((v) => v.length > 1); };
  P(`- 군 ID 기준 중복쌍: ${JSON.stringify(g((k) => by.get(k)!.itemFamilyId))}`); P(`- 구조 기준 중복군: ${JSON.stringify(g((k) => eff.get(k)!))}`);
  const q = (n: number) => by.get(order[n - 1])!; P(`\n## Q9 vs Q4/Q5 실제 풀이 구조`);
  for (const n of [4, 5, 9]) { const i = q(n); P(`- Q${n} ${i.keywordCode} skill ${i.skillPrimary} archetype ${i.payload.archetype} stim ${i.payload.stimulus?.kind}: ${String(i.payload.stem).replace(/\s+/g, " ").slice(0, 230)}\n  풀이: ${(i.payload.blueprint?.student_thinking ?? []).join(" -> ")}`); }
  P(`- lookAlikeReason(Q9,Q4)=${lookAlikeReason(li(q(9)), li(q(4)))}, (Q4,Q5)=${lookAlikeReason(li(q(4)), li(q(5)))}`);
}
const pool = mcIt.filter((i) => !(BC && abKeys.has(i.stockKey))).map(mk);
const distinct = (xs: Cand[]) => new Set(xs.map((c) => c.family)).size;
P(`\n## 칸별 서로 다른 군집 수 vs 필요(풀 MC 42, ${BC ? "AB 풀 세트 사용분 제외" : "전체"}; 군집당 1개만 선택 가능)`);
const U = BC ? ({ 1: [3, 4], 2: [3, 4], 3: [3, 4], 4: [3, 4], 5: [5, 6], 6: [7, 8], 7: [3, 4], 8: [3, 4], 9: [5, 6], 10: [7, 8] } as Record<number, [number, number]>) : OFFICIAL.unitBounds;
for (const u of Object.keys(U).map(Number)) { const x = pool.filter((c) => c.unit === u); P(`- U${u} 필요 ${U[u][0]}-${U[u][1]}: 군집 ${distinct(x)} (계산기 불가 ${distinct(x.filter((c) => c.calc === "not_allowed"))}, 필수 ${distinct(x.filter((c) => c.calc === "required"))})`); }
P(`- 계산기 불가 군집 ${distinct(pool.filter((c) => c.calc === "not_allowed"))} (필요 29), 필수 ${distinct(pool.filter((c) => c.calc === "required"))} (필요 13), 그래프필수 군집 ${distinct(pool.filter((c) => c.graphRequired))} (필요 10), 스킬 1/2/3 군집 ${[1, 2, 3].map((k) => distinct(pool.filter((c) => c.skillCat === k))).join("/")} (필요 ${[1, 2, 3].map((k) => OFFICIAL.skillBounds[k][0]).join("/")} 이상)`);
if (!BC) {
  const r = selectMc(pool, { seed: 7 }); P(`\n## AB 풀 MC 재선택(상한 1·구조 look-alike 병합): ${r ? "해 있음" : "해 못 찾음(불가능 증명 아님; 칸별 군집 수가 판단 근거)"}`);
  if (r) P(verify({ ...r, frqA: [], frqB: [] }).filter((x) => !x.id.startsWith("frq")).map((x) => `${x.ok ? "OK" : "NO"} ${x.text} ${x.detail}`).join("\n"));
}
if (!BC) {
  // 최소 교체 탐색: 게시본에서 군집당 1개만 남기고(앞 번호 유지) 나머지를 제외, 나머지는 잠가서 교체 슬롯만 움직인다.
  const prev = { mcA: abSel.mcA, mcB: abSel.mcB }; const pm = new Map(pool.map((c) => [c.key, c])); const seen = new Set<string>(); const drop = new Set<string>();
  for (const k of [...prev.mcA, ...prev.mcB]) { const f = pm.get(k)!.family; if (seen.has(f)) drop.add(k); else seen.add(f); }
  P(`\n## 최소 교체안(게시본 기준; 적용 안 함): 제거 ${drop.size}건 = ${[...drop].map((k) => `Q${[...prev.mcA, ...prev.mcB].indexOf(k) + 1}`).join(", ")}`);
  for (const gmin of [10, 9]) { const r = selectMc(pool, { seed: 7, exclude: drop, graphRequiredMin: gmin, prev: { mcA: prev.mcA.map((k) => pm.get(k)!).filter(Boolean), mcB: prev.mcB.map((k) => pm.get(k)!).filter(Boolean) } });
    P(`- 그래프 필수 하한 ${gmin}: ${r ? "해 있음" : "해 못 찾음"}`); if (!r) continue; const order = [...prev.mcA, ...prev.mcB], neu = [...r.mcA, ...r.mcB]; const nk = new Set(neu.map((c) => c.key)); const add = neu.filter((c) => !order.includes(c.key));
    const gone = order.map((k, i) => ({ k, i: i + 1 })).filter((x) => !nk.has(x.k)); P(`  교체 ${gone.length}건:`); gone.forEach((g, n) => { const o = pm.get(g.k)!, a = add[n]; P(`  - Q${g.i} ${g.k} (U${o.unit}.${o.type} skill${o.skillCat} ${o.calc} graph=${o.graphRequired}) -> ${a?.key} (U${a?.unit}.${a?.type} skill${a?.skillCat} ${a?.calc} graph=${a?.graphRequired})`); });
    P(`  재검증: ${verify({ ...r, frqA: [], frqB: [] }, { familyCap: 1, minFamilies: 21, graphRequiredMin: gmin }).filter((x) => !x.id.startsWith("frq")).map((x) => `${x.ok ? "OK" : "NO"}:${x.id}`).join(" ")}`); }
}
if (arg("--json")) writeFileSync(arg("--json"), JSON.stringify({ subject: SUBJECT, clusters: cl.clusters }, null, 1));
console.log(out.join("\n"));
