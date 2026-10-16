// AP Statistics Practice Exam 1(ST1) v1 → 목표 구성 새 버전 교체 계획(무료·읽기 전용·DB 없음). 게시본 v1 과 목표 배정 보고서(예: stats-st1-s3a-prefer-ep.json)의 차이만 위치 교체로 만든다.
//   npx tsx scripts/ap-generation/st1-new-version-plan.ts [--source data/ap/stock/assembled/stats-st1-s2b.json] [--target data/ap/stock/assembled/stats-st1-s3a-prefer-ep.json] [--write data/ap/stock/st1-v2-swap-plan.json]
// 위치 규칙: 섹션 키는 통계 단일 섹션 ap_mc(1..42, 공유 세트는 연속 3칸: 13–15, 31–33)·ap_frq(1..4). 공유 세트가 바뀌면 3칸 전체를 한 후보로 교체(계획 파일엔 세트의 첫 칸 하나만 적는다).
import { readFileSync, writeFileSync } from "node:fs";
import { verifyStatsFullComposition, type StatsSetItem } from "../../lib/ap-exam/full-set-rules";
import { STATS_FRQ_TEMPLATES } from "../../lib/ap-generation/stats-frq-checks";
import { buildStatsOrder, verifyStatsAssignment, type StatsResult } from "./stats-assign";
import { loadStatsPool, type StatsItem } from "./stats-pool";

export type StatsReport = { mcA: string[]; frqA: string[] };
export type StatsMeta = { unit: number | null; skill: number | null; shared: boolean; type: string };
export type StatsPlanSwap = { section: "ap_mc" | "ap_frq"; position: number; removeKey: string; addKey: string; remove: StatsMeta; add: StatsMeta };

const meta = (c: StatsItem): StatsMeta => ({ unit: c.members[0]?.unit ?? null, skill: c.members[0]?.skill ?? null, shared: c.shared, type: c.frqType });
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

export function resultOf(rep: StatsReport, by: Map<string, StatsItem>): StatsResult {
  const get = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
  const mc = rep.mcA.map(get);
  return { id: "ST1", singles: mc.filter((c) => !c.shared), sets: mc.filter((c) => c.shared), frq: rep.frqA.map(get), virtual: [], virtualSets: [], frqVirtual: [] };
}
/** 정규 MC 위치: 후보 키별 시작 위치와 칸 수(공유 세트 3). */
export function slotsOf(r: StatsResult): { key: string; start: number; size: number }[] {
  const out: { key: string; start: number; size: number }[] = [];
  for (const it of buildStatsOrder(r)) { const l = out[out.length - 1]; if (l && l.key === it.candidateKey) l.size++; else out.push({ key: it.candidateKey!, start: it.position, size: 1 }); }
  return out;
}

/** 같은 부류 안 짝짓기: 유사도 합 최대(비트마스크 DP). */
export function pairBySimilarity<T>(removed: T[], added: T[], score: (a: T, b: T) => number): [T, T][] {
  const n = removed.length; if (n !== added.length) throw new Error("교체 수 불일치");
  const memo = new Map<number, { v: number; pick: number[] }>();
  const go = (i: number, mask: number): { v: number; pick: number[] } => {
    if (i === n) return { v: 0, pick: [] };
    const k = i * (1 << n) + mask; const m = memo.get(k); if (m) return m;
    let best = { v: -1, pick: [] as number[] };
    for (let j = 0; j < n; j++) if (!(mask & (1 << j))) { const sub = go(i + 1, mask | (1 << j)); const v = sub.v + score(removed[i], added[j]); if (v > best.v) best = { v, pick: [j, ...sub.pick] }; }
    memo.set(k, best); return best;
  };
  return go(0, 0).pick.map((j, i) => [removed[i], added[j]] as [T, T]);
}

export type StatsPlan = { ok: boolean; swaps: StatsPlanSwap[]; verifierViolations: string[]; v2: StatsReport };

export function planStatsNewVersion(source: StatsReport, target: StatsReport, pool: StatsItem[]): StatsPlan {
  const by = new Map(pool.map((c) => [c.key, c])); const src = resultOf(source, by); resultOf(target, by);
  const slots = slotsOf(src); const swaps: StatsPlanSwap[] = [];
  const tgtKeys = new Set([...target.mcA, ...target.frqA]); const srcKeys = new Set([...source.mcA, ...source.frqA]);
  const replace = new Map<string, string>(); // 제거 키 → 추가 키
  const simSingle = (a: StatsItem, b: StatsItem) => (a.members[0].unit === b.members[0].unit ? 4 : 0) + (a.members[0].skill === b.members[0].skill ? 2 : 0);
  const simSet = (a: StatsItem, b: StatsItem) => (a.members[0].unit === b.members[0].unit ? 1 : 0);
  for (const shared of [false, true]) {
    const rem = source.mcA.filter((k) => !tgtKeys.has(k) && by.get(k)!.shared === shared).map((k) => by.get(k)!);
    const add = target.mcA.filter((k) => !srcKeys.has(k) && by.get(k)!.shared === shared).map((k) => by.get(k)!);
    for (const [r, a] of pairBySimilarity(rem, add, shared ? simSet : simSingle)) replace.set(r.key, a.key);
  }
  for (const s of slots) { const a = replace.get(s.key); if (a) swaps.push({ section: "ap_mc", position: s.start, removeKey: s.key, addKey: a, remove: meta(by.get(s.key)!), add: meta(by.get(a)!) }); }
  const frqRem = source.frqA.filter((k) => !tgtKeys.has(k)).map((k) => by.get(k)!); const frqAdd = target.frqA.filter((k) => !srcKeys.has(k)).map((k) => by.get(k)!);
  for (const [r, a] of pairBySimilarity(frqRem, frqAdd, (x, y) => (x.frqType === y.frqType ? 1 : 0))) swaps.push({ section: "ap_frq", position: source.frqA.indexOf(r.key) + 1, removeKey: r.key, addKey: a.key, remove: meta(r), add: meta(a) });
  swaps.sort((a, b) => a.section.localeCompare(b.section) || a.position - b.position);

  // v2 = v1 위치 그대로 교체한 결과를 슬롯 단위(공유 세트 3칸 포함)로 만들어 독립 검증기로 점검
  const v2Keys = source.mcA.map((k) => replace.get(k) ?? k); const v2Frq = [...source.frqA]; for (const s of swaps.filter((x) => x.section === "ap_frq")) v2Frq[s.position - 1] = s.addKey;
  const comp: StatsSetItem[] = [];
  for (const s of slots) { const key = replace.get(s.key) ?? s.key; const c = by.get(key)!; for (let j = 0; j < s.size; j++) comp.push({ kind: "mc", unit: String(c.members[j].unit), skillCat: String(c.members[j].skill), candidateKey: c.shared ? key : null, position: s.start + j }); }
  v2Frq.forEach((k, i) => comp.push({ kind: "frq", unit: null, skillCat: null, candidateKey: k, position: i + 1 }));
  const bad = verifyStatsFullComposition(comp);
  bad.push(...verifyStatsAssignment([resultOf({ mcA: v2Keys, frqA: v2Frq }, by)]));
  for (const k of [...v2Keys, ...v2Frq]) if (!tgtKeys.has(k)) bad.push(`목표에 없는 문항 ${k}`);
  if (v2Keys.length !== target.mcA.length || new Set([...v2Keys, ...v2Frq]).size !== v2Keys.length + v2Frq.length) bad.push("교체 후 문항 수·중복 이상");
  if (new Set(v2Frq.map((k) => by.get(k)!.frqType)).size !== STATS_FRQ_TEMPLATES.length) bad.push("FRQ 유형 이상");
  return { ok: bad.length === 0, swaps, verifierViolations: bad, v2: { mcA: v2Keys, frqA: v2Frq } };
}

function main() {
  const rd = (f: string) => (JSON.parse(readFileSync(f, "utf-8")) as { sets: StatsReport[] }).sets[0];
  const p = planStatsNewVersion(rd(arg("--source", "data/ap/stock/assembled/stats-st1-s2b.json")), rd(arg("--target", "data/ap/stock/assembled/stats-st1-s3a-prefer-ep.json")), loadStatsPool({}).pool);
  console.log(`# ST1 v2 최소 교체 계획 — 교체 ${p.swaps.length}건, 독립 검증기 위반: ${p.verifierViolations.length ? p.verifierViolations.join("; ") : "0"}`);
  for (const s of p.swaps) console.log(`${s.section} #${s.position}: ${s.removeKey} (단원 ${s.remove.unit}·스킬 ${s.remove.skill}) -> ${s.addKey} (단원 ${s.add.unit}·스킬 ${s.add.skill})`);
  const w = arg("--write");
  if (w && !p.ok) console.log("검증 실패 — 계획 파일을 쓰지 않습니다.");
  else if (w) { writeFileSync(w, JSON.stringify({ kind: "ap_new_version_swap_plan", set: "ST1", sourceSetName: "AP Statistics — Practice Exam 1", sourceVersionNo: 1, generatedBy: "scripts/ap-generation/st1-new-version-plan.ts", swapCount: p.swaps.length, verifierViolations: p.verifierViolations, swaps: p.swaps }, null, 1) + "\n"); console.log(`계획 저장: ${w}`); }
}
if (process.argv[1]?.endsWith("st1-new-version-plan.ts")) main();
