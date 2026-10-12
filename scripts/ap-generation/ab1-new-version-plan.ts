// AB#1 새 버전(v2) 최소 교체 계획(무료·읽기 전용·DB 없음). 게시본 AB#1 의 문항을 최대한 유지하면서, 저장된 초안 5세트(AB2·AB3·BC1·BC2·BC3)의 문항을 전부 피하고
// 구조 문항군 상한 1·공식 단원·스킬 비중·계산기 29/13·그래프 필수 ≥ 9(AB#1 승인 예외)·FRQ 6 서로 다른 유형·Q9(mcA 9번째) 유지 조건을 만족하는 정수계획(ILP)을 푼다.
//   STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx scripts/ap-generation/ab1-new-version-plan.ts [--drafts a.json] [--write data/ap/stock/ab1-v2-swap-plan.json] [--db-ready-only]
// 후보 = 화면 증거 보유(또는 현재 AB#1 항목) + "DB 준비" 집합(비프로덕션 검증 대기 항목은 *-pass-keys.json 에 있는 것만). 교체 칸 짝짓기: 같은 섹션 안에서 단원·스킬·그래프 유사도가 높은 쌍.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { AB_B, SK, loadPool, published, type Item } from "./assign-pool";
import { verifyAssignment, type SetResult, type Spec } from "./exact-assign";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export const AB1_SPEC: Spec = { id: "AB1", subj: "ab", floor: 9 };
export const Q9_SECTION = "mcA"; export const Q9_INDEX = 8;

export type PlanSwap = { section: "ap_mc_a" | "ap_mc_b" | "ap_frq_a" | "ap_frq_b"; position: number; removeKey: string; addKey: string; remove: Meta; add: Meta };
export type Meta = { unit: number; skill: number; calculator: string; graph: boolean; family: string; type: string };
const SEC: Record<string, PlanSwap["section"]> = { mcA: "ap_mc_a", mcB: "ap_mc_b", frqA: "ap_frq_a", frqB: "ap_frq_b" };
const meta = (c: Item): Meta => ({ unit: c.unit, skill: c.skill, calculator: c.calc, graph: c.graph, family: c.fam, type: c.type });

export function dbReadyKeys(dir = "data/ap/stock"): Set<string> {
  const s = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => /pass-keys\.json$/.test(x))) for (const k of JSON.parse(readFileSync(`${dir}/${f}`, "utf-8")) as string[]) s.add(k);
  return s;
}

/** 문항 선택(ILP): 후보 중 정확히 count 개를 고르며 non-keep 사용 수 최소. 반환 = 선택 키 또는 null(불가능) + 최적 증명 여부. */
function solveKeep(items: Item[], spec: { kind: "mc" | "frq" }, keep: Set<string>, fixed: Set<string>, timeMs: number) {
  const cand = items.filter((c) => c.kind === spec.kind);
  const n = cand.length; const cons: Cons[] = []; const obj = cand.map((c) => (keep.has(c.key) ? 0 : 1000 + (c.pending ? 1 : 0)));
  const idx = (f: (c: Item) => boolean) => cand.map((c, i) => [i, f(c)] as const).filter(([, b]) => b).map(([i]) => [i, 1] as [number, number]);
  const drop = new Set((process.env.DROP ?? "").split(","));
  const eq = (f: (c: Item) => boolean, rhs: number) => cons.push({ coef: idx(f), sense: "=", rhs });
  const range = (f: (c: Item) => boolean, lo: number, hi: number) => { cons.push({ coef: idx(f), sense: ">=", rhs: lo }); cons.push({ coef: idx(f), sense: "<=", rhs: hi }); };
  if (spec.kind === "mc") {
    eq((c) => c.calc === "not_allowed", 29); eq((c) => c.calc === "required", 13);
    if (!drop.has("unit")) for (const [u, [lo, hi]] of Object.entries(AB_B)) range((c) => c.unit === Number(u), lo, hi);
    if (!drop.has("skill")) for (const [k, [lo, hi]] of Object.entries(SK)) range((c) => c.skill === Number(k), lo, hi);
    if (!drop.has("graph")) cons.push({ coef: idx((c) => c.graph), sense: ">=", rhs: AB1_SPEC.floor });
    const fam = new Map<string, [number, number][]>(); cand.forEach((c, i) => (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([i, 1]));
    if (!drop.has("fam")) for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  } else {
    eq((c) => c.calc === "required", 2); eq((c) => c.calc !== "required", 4);
    for (const key of ["type", "fam"] as const) { const g = new Map<string, [number, number][]>(); cand.forEach((c, i) => (g.get(c[key]) ?? g.set(c[key], []).get(c[key])!).push([i, 1])); for (const co of g.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); }
  }
  cand.forEach((_, i) => cons.push({ coef: [[i, 1]], sense: "<=", rhs: 1 })); // 이진 상한(솔버는 binary 표시 변수의 상한을 행으로 넣지 않는다)
  cand.forEach((c, i) => { if (fixed.has(c.key)) cons.push({ coef: [[i, 1]], sense: "=", rhs: 1 }); });
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary: new Array(n).fill(true) }, { timeMs });
  const chosen = r.x.length ? cand.filter((_, i) => r.x[i] > 0.5) : null;
  return { status: r.status, swaps: chosen ? Math.floor(r.obj / 1000) : null, chosen, bestBound: r.bestBound, candidates: n };
}

/** 같은 섹션 안 교체 짝짓기(비트마스크 DP 로 유사도 합 최대). 유사도 = 같은 단원·스킬·그래프 여부. */
export function pairSwaps(removed: Item[], added: Item[]): [Item, Item][] {
  const n = removed.length; if (n !== added.length) throw new Error("교체 수 불일치");
  const score = (a: Item, b: Item) => (a.unit === b.unit ? 4 : 0) + (a.skill === b.skill ? 2 : 0) + (a.graph === b.graph ? 1 : 0);
  const memo = new Map<number, { v: number; pick: number[] }>();
  const go = (i: number, mask: number): { v: number; pick: number[] } => {
    if (i === n) return { v: 0, pick: [] };
    const k = i * (1 << n) + mask; const m = memo.get(k); if (m) return m;
    let best = { v: -1, pick: [] as number[] };
    for (let j = 0; j < n; j++) if (!(mask & (1 << j))) { const sub = go(i + 1, mask | (1 << j)); const v = sub.v + score(removed[i], added[j]); if (v > best.v) best = { v, pick: [j, ...sub.pick] }; }
    memo.set(k, best); return best;
  };
  return go(0, 0).pick.map((j, i) => [removed[i], added[j]] as [Item, Item]);
}

export type PlanOutput = {
  ok: boolean; reason?: string; sourceSet: string; swapCount: number; swaps: PlanSwap[];
  mc: { status: string; swaps: number | null; bestBound: number; candidates: number }; frq: { status: string; swaps: number | null; bestBound: number; candidates: number };
  verifierViolations: string[]; excludedDraftKeys: number;
};

export function planAb1NewVersion(o: { draftFiles: string[]; dbReadyOnly: boolean; timeMs: number }): PlanOutput & { v2: { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] } } {
  const pub = published(); const drafts = new Set<string>();
  for (const f of o.draftFiles) for (const s of (JSON.parse(readFileSync(f, "utf-8")) as { sets: Record<string, unknown>[] }).sets) for (const g of ["mcA", "mcB", "frqA", "frqB"]) for (const k of (s[g] as string[]) ?? []) drafts.add(k);
  const pubKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
  const ready = dbReadyKeys(); const { all } = loadPool({ strictFamilies: true });
  const pool = all.filter((c) => !drafts.has(c.key) && (c.subj === "ab") && !c.bcOnly && (pubKeys.has(c.key) || (c.screen && (!(o.dbReadyOnly && !process.env.ALLREADY) || !c.pending || c.pending === "sib21" || ready.has(c.key)))));
  const fixed = new Set([pub[Q9_SECTION][Q9_INDEX]]);
  const mc = solveKeep(pool, { kind: "mc" }, pubKeys, fixed, o.timeMs); const frq = solveKeep(pool.filter((c) => !c.native), { kind: "frq" }, pubKeys, new Set(), o.timeMs);
  const base = { sourceSet: "AP Calculus AB — Practice Exam v1", excludedDraftKeys: drafts.size, mc: { status: mc.status, swaps: mc.swaps, bestBound: mc.bestBound, candidates: mc.candidates }, frq: { status: frq.status, swaps: frq.swaps, bestBound: frq.bestBound, candidates: frq.candidates } };
  const empty = { mcA: [], mcB: [], frqA: [], frqB: [] };
  if (!mc.chosen || !frq.chosen) return { ok: false, reason: `불가능: MC ${mc.status} FRQ ${frq.status}`, swapCount: 0, swaps: [], verifierViolations: [], v2: empty, ...base };
  const chosen = new Set([...mc.chosen, ...frq.chosen].map((c) => c.key)); const byKey = new Map(all.map((c) => [c.key, c])); const swaps: PlanSwap[] = [];
  const v2 = { mcA: [...pub.mcA], mcB: [...pub.mcB], frqA: [...pub.frqA], frqB: [...pub.frqB] };
  for (const g of ["mcA", "mcB", "frqA", "frqB"] as const) {
    const cur = pub[g]; const removed = cur.filter((k) => !chosen.has(k)).map((k) => byKey.get(k)!);
    const sec = g.startsWith("mc") ? (g === "mcA" ? "not_allowed" : "required") : g === "frqA" ? "required" : "not_required";
    const inSec = (c: Item) => (g.startsWith("mc") ? c.calc === sec : sec === "required" ? c.calc === "required" : c.calc !== "required");
    const added = [...chosen].map((k) => byKey.get(k)!).filter((c) => !pubKeys.has(c.key) && c.kind === (g.startsWith("mc") ? "mc" : "frq") && inSec(c));
    if (removed.length !== added.length) throw new Error(`${g}: 제거 ${removed.length} ≠ 추가 ${added.length}`);
    for (const [r, a] of pairSwaps(removed, added)) { const i = cur.indexOf(r.key); v2[g][i] = a.key; swaps.push({ section: SEC[g], position: i + 1, removeKey: r.key, addKey: a.key, remove: meta(r), add: meta(a) }); }
  }
  swaps.sort((a, b) => a.section.localeCompare(b.section) || a.position - b.position);
  const mk = (keys: string[]) => keys.map((k) => byKey.get(k)!);
  const res: SetResult = { id: "AB1", mcA: mk(v2.mcA), mcB: mk(v2.mcB), virtual: [], frqA: mk(v2.frqA), frqB: mk(v2.frqB), frqVirtual: [] };
  const bad = verifyAssignment([AB1_SPEC], [res], drafts);
  for (const k of [...v2.mcA, ...v2.mcB, ...v2.frqA, ...v2.frqB]) if (drafts.has(k)) bad.push(`초안 세트 문항 포함 ${k}`);
  if (v2.mcA[Q9_INDEX] !== pub.mcA[Q9_INDEX]) bad.push("Q9 변경됨");
  return { ok: bad.length === 0, swapCount: swaps.length, swaps, verifierViolations: bad, v2, ...base };
}

function main() {
  const draftFiles = (arg("--drafts", "data/ap/stock/exact-assign-5sets-cons.json")).split(",");
  const p = planAb1NewVersion({ draftFiles, dbReadyOnly: true, timeMs: Number(arg("--time-ms", "300000")) });
  console.log(`# AB#1 v2 최소 교체 계획 — 초안 5세트 문항 ${p.excludedDraftKeys}건 제외, DB 준비 재고만`);
  console.log(`MC: ${p.mc.status} 교체 ${p.mc.swaps} (증명 하한 ${Math.ceil(p.mc.bestBound / 1000)}, 후보 ${p.mc.candidates}) / FRQ: ${p.frq.status} 교체 ${p.frq.swaps} (후보 ${p.frq.candidates})`);
  console.log(`독립 검증기 위반: ${p.verifierViolations.length ? p.verifierViolations.join("; ") : "0"}`);
  if (!p.ok && p.reason) console.log(p.reason);
  for (const s of p.swaps) console.log(`${s.section} #${s.position}: ${s.removeKey} (단원 ${s.remove.unit}·스킬 ${s.remove.skill}·${s.remove.calculator}${s.remove.graph ? "·그래프" : ""}) -> ${s.addKey} (단원 ${s.add.unit}·스킬 ${s.add.skill}·${s.add.calculator}${s.add.graph ? "·그래프" : ""})`);
  const w = arg("--write");
  if (w && !p.ok) console.log("불가능하거나 검증 실패 — 계획 파일을 쓰지 않습니다.");
  else if (w) { if (/ab-full-set-selection/.test(w)) throw new Error("게시본 경로에는 쓰지 않습니다."); writeFileSync(w, JSON.stringify({ kind: "ap_new_version_swap_plan", set: "AB1", sourceSetName: "AP Calculus AB — Practice Exam", sourceVersionNo: 1, generatedBy: "scripts/ap-generation/ab1-new-version-plan.ts", swapCount: p.swapCount, verifierViolations: p.verifierViolations, swaps: p.swaps }, null, 1) + "\n"); console.log(`계획 저장: ${w}`); }
}
if (process.argv[1]?.endsWith("ab1-new-version-plan.ts")) main();
