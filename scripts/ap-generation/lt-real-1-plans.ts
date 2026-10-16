// AP English Literature Practice Exam 1·2 (게시 v1) Stage 1 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/lt-real-1-plans.ts [--write]
// 입력: 게시 v1 슬롯 스냅샷 data/ap/stock/lt1-lt2-published-v1-slots.json(SELECT 전용 조회), 재고(문학 풀, 신규 배치 lt-real-1 포함).
// 교체(같은 위치·같은 종류·같은 크기): LT1 = MC 시 세트 p03(8문항) → lt-real-1 rs1(Dickinson, 8문항) + FRQ Q1 fb1 → rf1(Hopkins), LT2 = FRQ Q2 fa2 → rf2(Chekhov).
import { readFileSync, writeFileSync } from "node:fs";
import { loadLtPool, type LtItem } from "./lt-pool";
import { categorySummary, groupSummary, verifyLtAssignment, type LtResult } from "./lt-assign";

export type Slot = { section: string; position: number; candidateKey: string };
export type Snap = Record<"LT1" | "LT2", { setId?: string; sourceSetName: string; sourceVersionNo: number; slots: Slot[] }> & { cands?: Record<string, unknown>[] };
export type McSpec = [remove: string, add: string];
export const STAGE_1: Record<"LT1" | "LT2", { mc: McSpec[]; frq: [string, string][] }> = {
  LT1: { mc: [["englit-p1-a:ap_english_literature-p03-k0", "lt-real-1:ap_english_literature-real-rs1-k0"]], frq: [["englit-p1-b:ap_english_literature-fb1-k0", "lt-real-1:ap_english_literature-real-rf1-k0"]] },
  LT2: { mc: [], frq: [["englit-p1-b:ap_english_literature-fa2-k0", "lt-real-1:ap_english_literature-real-rf2-k0"]] },
};
export type PlanSwap = { section: string; position: number; removeKey: string; addKey: string; remove: Meta; add: Meta };
type Meta = { kind: "mc_set" | "frq"; group?: string | null; skills?: string[]; topics?: string[]; frqType?: string };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const metaOf = (c: LtItem): Meta => (c.kind === "mc" ? { kind: "mc_set", group: c.group, skills: c.members.map((m) => m.skill) } : { kind: "frq", frqType: c.frqType });

export function planFor(id: "LT1" | "LT2", slots: Slot[], by: Map<string, LtItem>, spec = STAGE_1[id]): { swaps: PlanSwap[]; problems: string[] } {
  const problems: string[] = []; const swaps: PlanSwap[] = []; const get = (k: string) => { const c = by.get(k); if (!c) problems.push(`${id}: 재고에 없는 키 ${k}`); return c; };
  for (const [rk, ak] of spec.mc) {
    const first = slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).sort((a, b) => a.position - b.position)[0]; const r = get(rk), n = get(ak);
    if (!first) { problems.push(`${id}: ${rk} 가 ap_mc 에 없음`); continue; } if (!r || !n) continue;
    if (r.members.length !== n.members.length) problems.push(`${id}: MC 세트 크기가 다름(${r.members.length} → ${n.members.length})`); if (r.group !== n.group) problems.push(`${id}: 장르 묶음이 다름(${r.group} → ${n.group})`);
    swaps.push({ section: "ap_mc", position: first.position, removeKey: rk, addKey: ak, remove: metaOf(r), add: metaOf(n) });
  }
  for (const [rk, ak] of spec.frq) {
    const s = slots.find((x) => x.section === "ap_frq" && x.candidateKey === rk); const r = get(rk), n = get(ak);
    if (!s) { problems.push(`${id}: ${rk} 가 ap_frq 에 없음`); continue; } if (!r || !n) continue;
    if (r.frqType !== n.frqType) problems.push(`${id}: FRQ 유형이 다름(${r.frqType} → ${n.frqType})`);
    swaps.push({ section: "ap_frq", position: s.position, removeKey: rk, addKey: ak, remove: metaOf(r), add: metaOf(n) });
  }
  return { swaps, problems };
}
export const applySwaps = (slots: Slot[], swaps: { section: string; removeKey: string; addKey: string }[]): Slot[] => { const next = slots.map((s) => ({ ...s })); for (const sw of swaps) for (const s of next) if (s.section === sw.section && s.candidateKey === sw.removeKey) s.candidateKey = sw.addKey; return next; };
export function resultOf(id: string, slots: Slot[], by: Map<string, LtItem>): LtResult {
  const mcKeys = [...new Set(slots.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position).map((s) => s.candidateKey))];
  const g = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
  return { id, sets: mcKeys.map(g), frq: slots.filter((s) => s.section === "ap_frq").sort((a, b) => a.position - b.position).map((s) => g(s.candidateKey)) };
}

function main() {
  const snap = rd<Snap>("data/ap/stock/lt1-lt2-published-v1-slots.json"); const { all } = loadLtPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
  const out: Record<string, { swaps: PlanSwap[]; sum: unknown }> = {}; const finals: LtResult[] = []; const bad: string[] = [];
  for (const id of ["LT1", "LT2"] as const) {
    const p = planFor(id, snap[id].slots, by); const final = applySwaps(snap[id].slots, p.swaps); const before = resultOf(id, snap[id].slots, by), after = resultOf(id, final, by); bad.push(...p.problems); finals.push(after);
    out[id] = { swaps: p.swaps, sum: { categoriesBefore: categorySummary(before), categoriesAfter: categorySummary(after), groupsAfter: groupSummary(after) } };
  }
  bad.push(...verifyLtAssignment(finals)); console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { swaps: v.swaps.length, ...(v.sum as object) }])), null, 1)); console.log(`위반: ${bad.length ? bad.join("; ") : "0"}`);
  if (process.argv.includes("--write")) {
    if (bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); }
    const note = (id: "LT1" | "LT2") => id === "LT1" ? "Stage 1: ① MC 시 세트 p03(ALTON 작성 시, 8문항) → rs1(Dickinson 'The Chariot', 8문항, 같은 칸·같은 장르 묶음) ② FRQ Q1 fb1(ALTON 작성 시) → rf1(Hopkins \"God's Grandeur\"). 교체 뒤 구성(55 MC·3 FRQ·묶음 5·장르·범주 1–7·LT1/LT2 서로소)은 독립 검증기 위반 0." : "Stage 1: FRQ Q2 fa2(ALTON 작성 산문) → rf2(Chekhov 'The Lady with the Dog' 발췌, 689단어). MC 는 그대로. 교체 뒤 독립 검증기 위반 0.";
    for (const id of ["LT1", "LT2"] as const) writeFileSync(`data/ap/stock/${id.toLowerCase()}-v2-real-1-swap-plan.json`, JSON.stringify({ kind: "ap_new_version_swap_plan", set: id, sourceSetName: snap[id].sourceSetName, sourceVersionNo: snap[id].sourceVersionNo, generatedBy: "scripts/ap-generation/lt-real-1-plans.ts", note: note(id), swapCount: out[id].swaps.length, verifierViolations: [], swaps: out[id].swaps }, null, 1) + "\n");
    console.log("계획 파일을 썼습니다.");
  }
}
if (process.argv[1]?.endsWith("lt-real-1-plans.ts")) main();
