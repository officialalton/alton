// 6세트 배정용 재고 로더(읽기 전용, DB 없음). six-set-plan.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과)에
// 화면 증거 보유 여부·신규(graph-s*) 여부·표현 종류를 덧붙인다. 문항군 = 구조 look-alike 군집(AB+BC 합산).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { STOCK_FILES } from "./keys-file";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; payload: Record<string, unknown>; skillPrimary?: string; duplicateOf?: string | null; archetype?: string };
export type Item = {
  key: string; kind: "mc" | "frq"; subj: "ab" | "bc"; unit: number; skill: number; calc: "required" | "not_allowed" | "na"; fam: string; type: string;
  graph: boolean; native: boolean; bcOnly: boolean; rep: string; archetype: string; screen: boolean; isNew: boolean; pending: "" | "graph70" | "sib21" | "supp"; batch: string; renderType: string;
};
export const AB_B: Record<number, [number, number]> = { 1: [5, 6], 2: [5, 6], 3: [3, 4], 4: [5, 6], 5: [7, 8], 6: [7, 8], 7: [3, 4], 8: [5, 6] };
export const BC_B: Record<number, [number, number]> = { 1: [3, 4], 2: [3, 4], 3: [3, 4], 4: [3, 4], 5: [5, 6], 6: [7, 8], 7: [3, 4], 8: [3, 4], 9: [5, 6], 10: [7, 8] };
export const SK: Record<number, [number, number]> = { 1: [21, 29], 2: [7, 12], 3: [5, 8] };

export function loadPool(opts: { requireScreen?: boolean; strictFamilies?: boolean } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const bcCur = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_calculus_bc.json", "utf-8")) as ApCurriculumFile;
  const scope = new Map(bcCur.units.flatMap((u) => u.topics.map((t) => [t.code, (t as unknown as { scope: string }).scope] as const)));
  // 증거 파일별 키 집합. 비프로덕션 검증 대기 = 증거가 신규 두 파일(evidence-graph-s1s3 = 신규 70건, evidence-v1v45-siblings = 증거 없던 형제 21건)에만 있는 항목.
  const evBy = new Map<string, Set<string>>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) (evBy.get(e.candidate_key) ?? evBy.set(e.candidate_key, new Set()).get(e.candidate_key)!).add(f);
  const ev = new Set(evBy.keys());
  const pendingOf = (k: string): Item["pending"] => { const fs = evBy.get(k); if (!fs) return ""; if ([...fs].every((f) => f === "evidence-graph-s1s3.json")) return "graph70"; if ([...fs].every((f) => f === "evidence-v1v45-siblings.json")) return "sib21"; if ([...fs].every((f) => f === "evidence-supp.json")) return "supp"; return ""; };
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (!batchOf.has(r.stockKey)) { batchOf.set(r.stockKey, f); raws.push(r); } } }
  const live = raws.filter((i) => (i.apSubjectCode === "ap_calculus_ab" || i.apSubjectCode === "ap_calculus_bc") && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const P = (r: Raw) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
  const cl = clusterLookAlikes(gated.filter((x) => x.i.kind === "mc").map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking })));
  const all: Item[] = gated.map(({ i, g }) => ({
    key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", subj: i.apSubjectCode === "ap_calculus_bc" ? "bc" : "ab", unit: Number(i.keywordCode.split(".")[0]), skill: Number((i.skillPrimary ?? "0")[0]),
    calc: i.calculator as Item["calc"], fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId,
    type: i.kind === "frq_bundle" ? (i.archetype ?? i.keywordCode) : i.keywordCode, graph: g.need === "required" && g.stimKind === "graph", native: i.apSubjectCode === "ap_calculus_bc", bcOnly: scope.get(i.keywordCode) === "bc_only",
    rep: g.renderType, archetype: String(P(i).archetype ?? i.archetype ?? ""), screen: ev.has(i.stockKey), isNew: /^(graph-s|supp-)/.test(batchOf.get(i.stockKey) ?? ""), pending: pendingOf(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType,
  }));
  if (opts.strictFamilies) { // 구조 검토 묶음(data/ap/stock/structure-groups.json): 묶음 안 아키타입의 문항군 군집을 합친다.
    const groups = (JSON.parse(readFileSync("data/ap/stock/structure-groups.json", "utf-8")) as { groups: { archetypes: string[] }[] }).groups.map((g) => g.archetypes);
    const p = new Map<string, string>(); const find = (x: string): string => ((p.get(x) ?? x) === x ? x : (p.set(x, find(p.get(x)!)), p.get(x)!));
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) p.set(rb, ra); };
    for (const g of groups) { const fams = [...new Set(all.filter((c) => c.kind === "mc" && g.includes(c.archetype)).map((c) => c.fam))]; for (let i = 1; i < fams.length; i++) union(fams[0], fams[i]); }
    for (const c of all) if (c.kind === "mc") c.fam = find(c.fam);
  }
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool, clusters: cl.clusters };
}
export const published = () => (JSON.parse(readFileSync("data/ap/stock/ab-full-set-selection.json", "utf-8")) as { keys: Record<"mcA" | "mcB" | "frqA" | "frqB", string[]> }).keys;
