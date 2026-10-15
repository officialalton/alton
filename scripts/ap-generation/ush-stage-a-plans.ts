// AP U.S. History Practice Exam 1·2 (게시 v1) Stage A 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/ush-stage-a-plans.ts [--write]
// 입력: 게시 v1 슬롯 스냅샷 data/ap/stock/ush-us1-us2-published-v1-slots.json(SELECT 전용 조회), 재고(US History 풀, 신규 배치 ush-real-a 포함).
// 교체: US1 = u747(MC 세트 3칸 → 실제 Census 세트) + saq3_1(SAQ q3) + **균형 교체 u313 → u418**, US2 = u719(MC 세트) + saq3_3(SAQ q3). Stage A 교체는 같은 위치·같은 크기·같은 단원 순서·같은 스킬 범주·같은 시대(SAQ)로만 바꾼다.
// 2026-10-15 수정: 관리자 새 버전·초안은 단원을 문항별 토픽이 아니라 **후보 keyword_code 의 단원(세트 전 문항에 같은 값)** 으로 센다. 게시 US1 v1 은 그 기준으로 이미 단원 3 이 11(최대 10)·단원 4 가 4(최소 5)라 교체만으로는 막혔다 → 같은 크기의 단원 4 세트로 균형 교체. 계획 검증도 같은 단원(keyUnit)으로 한다.
import { readFileSync, writeFileSync } from "node:fs";
import { loadUshPool, type UshItem } from "./ush-pool";
import { ushUnitBounds } from "../../lib/ap-exam/ush-rules";
import { verifyUshAssignment, type UshResult } from "./ush-assign";

export type Slot = { section: string; position: number; candidateKey: string };
export type PlanSwap = { section: string; position: number; removeKey: string; addKey: string; remove: Meta; add: Meta };
type Meta = { kind: "mc_set" | "saq3"; units?: string[]; skills?: string[]; period: number; theme?: string; stim?: string; template?: string };
export type McSwapSpec = [remove: string, add: string, balance?: true];
export const STAGE_A: Record<"US1" | "US2", { mc: McSwapSpec[]; saq: [string, string] }> = {
  US1: { mc: [["ush-p2-a:ap_us_history-u747-k0", "ush-real-a:ap_us_history-real_a_gm-k0"], ["ush-p2-a:ap_us_history-u313-k0", "ush-p2-a:ap_us_history-u418-k0", true]], saq: ["ush-p1-b:ap_us_history-saq3_1-k0", "ush-real-a:ap_us_history-real_a_saq3_own-k0"] },
  US2: { mc: [["ush-p3-a:ap_us_history-u719-k0", "ush-real-a:ap_us_history-real_a_imm-k0"]], saq: ["ush-p1-b:ap_us_history-saq3_3-k0", "ush-real-a:ap_us_history-real_a_saq3_plains-k0"] },
};
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
export type Snap = Record<"US1" | "US2", { setId?: string; sourceSetName: string; sourceVersionNo: number; slots: Slot[] }> & { convertedKeys?: Record<string, number> };

const metaOf = (c: UshItem): Meta => (c.kind === "mc" ? { kind: "mc_set", units: c.members.map((m) => m.unit), skills: c.members.map((m) => m.skill), period: c.period, theme: c.fam.replace(/^theme:/, ""), stim: c.stim } : { kind: "saq3", period: c.period, template: c.template });
/** 관리자 새 버전·초안이 읽는 단원별 MC 문항 수(후보 keyword_code 단원, 세트의 모든 칸에 같은 값). */
export function dbUnitCounts(slots: Slot[], by: Map<string, UshItem>): Record<string, number> {
  const c: Record<string, number> = {};
  for (const s of slots.filter((x) => x.section === "ap_mc")) { const u = by.get(s.candidateKey)?.keyUnit; if (u) c[u] = (c[u] ?? 0) + 1; }
  return c;
}
export const dbUnitViolations = (slots: Slot[], by: Map<string, UshItem>): string[] => {
  const c = dbUnitCounts(slots, by); const out: string[] = [];
  for (const [u, b] of Object.entries(ushUnitBounds())) { const n = c[u] ?? 0; if (n < b.min || n > b.max) out.push(`db_unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  return out;
};

/** 한 시험의 교체 항목을 만들고(제거 문항이 그 칸에 있는지·구성 동일성 점검) 사유 목록을 돌려준다. 균형 교체(balance)는 같은 크기만 요구한다. */
export function planFor(id: "US1" | "US2", slots: Slot[], by: Map<string, UshItem>, spec = STAGE_A[id]): { swaps: PlanSwap[]; problems: string[] } {
  const problems: string[] = []; const swaps: PlanSwap[] = [];
  const get = (k: string) => { const c = by.get(k); if (!c) problems.push(`${id}: 재고(화면 증거 보유)에 없는 키 ${k}`); return c; };
  for (const [rk, ak, balance] of spec.mc) { // MC 세트: 가장 앞 칸 위치
    const first = slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).sort((x, y) => x.position - y.position)[0]; const r = get(rk), n = get(ak);
    if (!first) { problems.push(`${id}: ${rk} 가 ap_mc 에 없음`); continue; }
    if (!r || !n) continue;
    if (r.members.length !== n.members.length) problems.push(`${id}: MC 세트 크기가 다름`);
    if (!balance) {
      if (JSON.stringify(r.members.map((m) => [m.unit, m.skill[0]])) !== JSON.stringify(n.members.map((m) => [m.unit, m.skill[0]]))) problems.push(`${id}: MC 세트의 단원·스킬 범주 순서가 다름`);
      if (r.period !== n.period) problems.push(`${id}: MC 세트 시대가 다름`); if (r.stim !== n.stim) problems.push(`${id}: 자료 유형이 다름(${r.stim} → ${n.stim})`);
      if (r.keyUnit !== n.keyUnit) problems.push(`${id}: 후보 단원(keyUnit)이 다름(${r.keyUnit} → ${n.keyUnit})`);
    }
    swaps.push({ section: "ap_mc", position: first.position, removeKey: rk, addKey: ak, remove: metaOf(r), add: metaOf(n) });
  }
  { // SAQ q3: ap_saq 3번
    const [rk, ak] = spec.saq; const s = slots.find((x) => x.section === "ap_saq" && x.candidateKey === rk); const r = get(rk), n = get(ak);
    if (!s) problems.push(`${id}: ${rk} 가 ap_saq 에 없음`); else if (r && n) {
      if (r.template !== "saq3" || n.template !== "saq3") problems.push(`${id}: saq3 가 아님`); if (r.period !== n.period) problems.push(`${id}: SAQ 시대가 다름(${r.period} → ${n.period})`);
      swaps.push({ section: "ap_saq", position: s.position, removeKey: rk, addKey: ak, remove: metaOf(r), add: metaOf(n) });
    }
  }
  return { swaps, problems };
}

export function applySwaps(slots: Slot[], swaps: PlanSwap[]): Slot[] {
  const next = slots.map((s) => ({ ...s }));
  for (const sw of swaps) for (const s of next) if (s.section === sw.section && s.candidateKey === sw.removeKey) s.candidateKey = sw.addKey;
  return next;
}
export function resultOf(id: string, slots: Slot[], by: Map<string, UshItem>): UshResult {
  const mcKeys = [...new Set(slots.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position).map((s) => s.candidateKey))];
  const frqKeys = slots.filter((s) => s.section !== "ap_mc").map((s) => s.candidateKey);
  const g = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
  return { id, sets: mcKeys.map(g), frq: frqKeys.map(g) };
}

function main() {
  // US1 계획(게시 v1 → v2)만 쓴다. US2 계획은 이미 적용(US2 v2 게시)돼 기록용으로 그대로 둔다.
  const snap = rd<Snap>("data/ap/stock/ush-us1-us2-db-state-v2.json"); const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
  const conv = snap.convertedKeys ?? {}; const p = planFor("US1", snap.US1.slots, by); const final = applySwaps(snap.US1.slots, p.swaps);
  const bad = [...p.problems, ...p.swaps.map((s) => s.addKey).filter((k) => !conv[k]).map((k) => `변환 안 된 교체 문항 ${k}`), ...dbUnitViolations(final, by), ...verifyUshAssignment([resultOf("US1", final, by), resultOf("US2", snap.US2.slots, by)])];
  console.log(`US1 교체 ${p.swaps.length}건, DB 단원 수(전) ${JSON.stringify(dbUnitCounts(snap.US1.slots, by))} → (후) ${JSON.stringify(dbUnitCounts(final, by))}, 위반: ${bad.length ? bad.join("; ") : "0"}`);
  if (process.argv.includes("--write")) {
    if (bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); }
    writeFileSync("data/ap/stock/us1-v2-real-a-swap-plan.json", JSON.stringify({ kind: "ap_new_version_swap_plan", set: "US1", sourceSetName: snap.US1.sourceSetName, sourceVersionNo: snap.US1.sourceVersionNo, generatedBy: "scripts/ap-generation/ush-stage-a-plans.ts",
      note: "Stage A + 균형 교체: ① u747 → real_a_gm, ② saq3_1 → real_a_saq3_own(가공 표 → 실제 Census 자료), ③ u313 → u418(같은 크기 4문항, 단원 3 → 4). ③ 은 게시 US1 v1 이 후보 keyword_code 단원 기준으로 이미 단원 3 = 11(최대 10)·단원 4 = 4(최소 5)라 관리자 새 버전 검증이 막히기 때문에 필요하다. 교체 뒤 단원별 MC 수 = 3/3/7/8/8/8/7/7/4. 모든 교체 문항은 변환 완료(review_env_ready)이고 US2 v1·v2 와 겹치지 않는다.", swapCount: p.swaps.length, verifierViolations: [], swaps: p.swaps }, null, 1) + "\n");
    console.log("US1 계획 파일을 썼습니다.");
  }
}
if (process.argv[1]?.endsWith("ush-stage-a-plans.ts")) main();
