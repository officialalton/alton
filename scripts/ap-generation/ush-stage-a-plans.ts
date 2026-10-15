// AP U.S. History Practice Exam 1·2 (게시 v1) Stage A 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/ush-stage-a-plans.ts [--write]
// 입력: 게시 v1 슬롯 스냅샷 data/ap/stock/ush-us1-us2-published-v1-slots.json(SELECT 전용 조회), 재고(US History 풀, 신규 배치 ush-real-a 포함).
// 교체: US1 = u747(MC 세트 3칸 → 실제 Census 세트) + saq3_1(SAQ q3), US2 = u719(MC 세트) + saq3_3(SAQ q3). 같은 위치·같은 크기·같은 단원 순서·같은 스킬 범주·같은 시대(SAQ)로만 바꾼다.
import { readFileSync, writeFileSync } from "node:fs";
import { loadUshPool, type UshItem } from "./ush-pool";
import { verifyUshAssignment, type UshResult } from "./ush-assign";

export type Slot = { section: string; position: number; candidateKey: string };
export type PlanSwap = { section: string; position: number; removeKey: string; addKey: string; remove: Meta; add: Meta };
type Meta = { kind: "mc_set" | "saq3"; units?: string[]; skills?: string[]; period: number; theme?: string; stim?: string; template?: string };
export const STAGE_A: Record<"US1" | "US2", { mc: [string, string]; saq: [string, string] }> = {
  US1: { mc: ["ush-p2-a:ap_us_history-u747-k0", "ush-real-a:ap_us_history-real_a_gm-k0"], saq: ["ush-p1-b:ap_us_history-saq3_1-k0", "ush-real-a:ap_us_history-real_a_saq3_own-k0"] },
  US2: { mc: ["ush-p3-a:ap_us_history-u719-k0", "ush-real-a:ap_us_history-real_a_imm-k0"], saq: ["ush-p1-b:ap_us_history-saq3_3-k0", "ush-real-a:ap_us_history-real_a_saq3_plains-k0"] },
};
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
export type Snap = Record<"US1" | "US2", { setId: string; sourceSetName: string; sourceVersionNo: number; slots: Slot[] }>;

const metaOf = (c: UshItem): Meta => (c.kind === "mc" ? { kind: "mc_set", units: c.members.map((m) => m.unit), skills: c.members.map((m) => m.skill), period: c.period, theme: c.fam.replace(/^theme:/, ""), stim: c.stim } : { kind: "saq3", period: c.period, template: c.template });

/** 한 시험의 교체 항목을 만들고(제거 문항이 그 칸에 있는지·구성 동일성 점검) 사유 목록을 돌려준다. */
export function planFor(id: "US1" | "US2", slots: Slot[], by: Map<string, UshItem>): { swaps: PlanSwap[]; problems: string[] } {
  const problems: string[] = []; const swaps: PlanSwap[] = []; const a = STAGE_A[id];
  const get = (k: string) => { const c = by.get(k); if (!c) problems.push(`${id}: 재고(화면 증거 보유)에 없는 키 ${k}`); return c; };
  { // MC 세트: 가장 앞 칸 위치
    const [rk, ak] = a.mc; const first = slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).sort((x, y) => x.position - y.position)[0]; const r = get(rk), n = get(ak);
    if (!first) problems.push(`${id}: ${rk} 가 ap_mc 에 없음`); else if (r && n) {
      if (JSON.stringify(r.members.map((m) => [m.unit, m.skill[0]])) !== JSON.stringify(n.members.map((m) => [m.unit, m.skill[0]]))) problems.push(`${id}: MC 세트의 단원·스킬 범주 순서가 다름`);
      if (r.members.length !== n.members.length) problems.push(`${id}: MC 세트 크기가 다름`); if (r.period !== n.period) problems.push(`${id}: MC 세트 시대가 다름`); if (r.stim !== n.stim) problems.push(`${id}: 자료 유형이 다름(${r.stim} → ${n.stim})`);
      swaps.push({ section: "ap_mc", position: first.position, removeKey: rk, addKey: ak, remove: metaOf(r), add: metaOf(n) });
    }
  }
  { // SAQ q3: ap_saq 3번
    const [rk, ak] = a.saq; const s = slots.find((x) => x.section === "ap_saq" && x.candidateKey === rk); const r = get(rk), n = get(ak);
    if (!s) problems.push(`${id}: ${rk} 가 ap_saq 에 없음`); else if (r && n) {
      if (r.template !== "saq3" || n.template !== "saq3") problems.push(`${id}: saq3 가 아님`); if (r.period !== n.period) problems.push(`${id}: SAQ 시대가 다름(${r.period} → ${n.period})`);
      swaps.push({ section: "ap_saq", position: s.position, removeKey: rk, addKey: ak, remove: metaOf(r), add: metaOf(n) });
    }
  }
  return { swaps, problems };
}

export function applySwaps(slots: Slot[], swaps: PlanSwap[], by: Map<string, UshItem>): Slot[] {
  const next = slots.map((s) => ({ ...s }));
  for (const sw of swaps) for (const s of next) if (s.section === sw.section && s.candidateKey === sw.removeKey) s.candidateKey = sw.addKey;
  void by; return next;
}
export function resultOf(id: string, slots: Slot[], by: Map<string, UshItem>): UshResult {
  const mcKeys = [...new Set(slots.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position).map((s) => s.candidateKey))];
  const frqKeys = slots.filter((s) => s.section !== "ap_mc").map((s) => s.candidateKey);
  const g = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
  return { id, sets: mcKeys.map(g), frq: frqKeys.map(g) };
}

function main() {
  const snap = rd<Snap & { _note: string }>("data/ap/stock/ush-us1-us2-published-v1-slots.json"); const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
  const plans = (["US1", "US2"] as const).map((id) => { const p = planFor(id, snap[id].slots, by); return { id, ...p, final: applySwaps(snap[id].slots, p.swaps, by) }; });
  const bad = [...plans.flatMap((p) => p.problems), ...verifyUshAssignment(plans.map((p) => resultOf(p.id, p.final, by)))];
  console.log(`US1 교체 ${plans[0].swaps.length}건, US2 교체 ${plans[1].swaps.length}건, 독립 검증기·구성 위반: ${bad.length ? bad.join("; ") : "0"}`);
  if (process.argv.includes("--write")) {
    if (bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); }
    for (const p of plans) writeFileSync(`data/ap/stock/${p.id.toLowerCase()}-v2-real-a-swap-plan.json`, JSON.stringify({ kind: "ap_new_version_swap_plan", set: p.id, sourceSetName: snap[p.id].sourceSetName, sourceVersionNo: snap[p.id].sourceVersionNo, generatedBy: "scripts/ap-generation/ush-stage-a-plans.ts",
      note: "Stage A: 가공(합성) 표 자료를 실제 Census Bureau 자료로 교체. 같은 위치·같은 크기·같은 단원 순서·같은 스킬 범주·같은 시대. 순서: 배치 ush-real-a 적재 → US1 새 버전(이 계획) → US2 새 버전 → 각각 '새 버전 공개'. 두 계획은 서로 독립이다(교체해 넣는 문항이 서로 다르다).", swapCount: p.swaps.length, verifierViolations: [], swaps: p.swaps }, null, 1) + "\n");
    console.log("계획 파일 2개를 썼습니다.");
  }
}
if (process.argv[1]?.endsWith("ush-stage-a-plans.ts")) main();
