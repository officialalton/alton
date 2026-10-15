// AP U.S. History Practice Exam 1·2 (게시 v3) Stage C·D 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/ush-stage-cd-plans.ts [--write]
// 입력: 게시 v3 슬롯 스냅샷 data/ap/stock/ush-us1-us2-published-v3-slots.json(2026-10-15 `supabase db query --linked` SELECT 전용 조회: US1 v3·US2 v3 둘 다 published), 재고(US History 풀, 신규 배치 ush-real-c·ush-real-d 포함).
// 교체(MC 세트 통째, 같은 크기·같은 시대·같은 후보 단원(keyUnit)·문항별 토픽 단원·스킬 범주 순서): US1 u528·u531(Stage C) + u616(Stage D), US2 u526·u408(Stage C) + u527·u720(Stage D). Stage D 는 자료 유형이 secondary_text → visual 로 바뀐다(자료 유형 최소는 독립 검증기가 본다).
import { readFileSync, writeFileSync } from "node:fs";
import { loadUshPool, type UshItem } from "./ush-pool";
import { verifyUshAssignment } from "./ush-assign";
import { applySwaps, dbUnitViolations, resultOf, type PlanSwap, type Slot, type Snap } from "./ush-stage-a-plans";

export const STAGE_CD: Record<"US1" | "US2", [remove: string, add: string][]> = {
  US1: [["ush-p2-a:ap_us_history-u528-k0", "ush-real-c:ap_us_history-real_c_fsa-k0"], ["ush-p2-a:ap_us_history-u531-k0", "ush-real-c:ap_us_history-real_c_jones-k0"], ["ush-p3-a:ap_us_history-u616-k0", "ush-real-d:ap_us_history-real_d_reserv-k0"]],
  US2: [["ush-p2-a:ap_us_history-u526-k0", "ush-real-c:ap_us_history-real_c_emanc-k0"], ["ush-p3-a:ap_us_history-u408-k0", "ush-real-c:ap_us_history-real_c_monroe-k0"], ["ush-p2-a:ap_us_history-u527-k0", "ush-real-d:ap_us_history-real_d_reynolds-k0"], ["ush-p3-a:ap_us_history-u720-k0", "ush-real-d:ap_us_history-real_d_school-k0"]],
};
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const metaOf = (c: UshItem) => ({ kind: "mc_set" as const, units: c.members.map((m) => m.unit), skills: c.members.map((m) => m.skill), period: c.period, theme: c.fam.replace(/^theme:/, ""), stim: c.stim });
export const SNAPSHOT = "data/ap/stock/ush-us1-us2-published-v3-slots.json";
export function planFor(id: "US1" | "US2", slots: Slot[], by: Map<string, UshItem>, spec = STAGE_CD[id]): { swaps: PlanSwap[]; problems: string[] } {
  const problems: string[] = []; const swaps: PlanSwap[] = [];
  const get = (k: string) => { const c = by.get(k); if (!c) problems.push(`${id}: 재고(화면 증거 보유)에 없는 키 ${k}`); return c; };
  for (const [rk, ak] of spec) {
    const first = slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).sort((x, y) => x.position - y.position)[0]; const r = get(rk), n = get(ak);
    if (!first) { problems.push(`${id}: ${rk} 가 ap_mc 에 없음`); continue; }
    if (!r || !n) continue;
    if (r.members.length !== n.members.length) problems.push(`${id}: MC 세트 크기가 다름(${rk})`);
    if (JSON.stringify(r.members.map((m) => [m.unit, m.skill[0]])) !== JSON.stringify(n.members.map((m) => [m.unit, m.skill[0]]))) problems.push(`${id}: MC 세트의 단원·스킬 범주 순서가 다름(${rk})`);
    if (r.period !== n.period) problems.push(`${id}: MC 세트 시대가 다름(${rk})`);
    if (r.keyUnit !== n.keyUnit) problems.push(`${id}: 후보 단원(keyUnit)이 다름(${rk}: ${r.keyUnit} → ${n.keyUnit})`);
    const okStim = r.stim === n.stim || (r.stim === "secondary_text" && n.stim === "visual"); if (!okStim) problems.push(`${id}: 자료 유형 전환이 허용되지 않음(${r.stim} → ${n.stim})`);
    swaps.push({ section: "ap_mc", position: first.position, removeKey: rk, addKey: ak, remove: metaOf(r) as never, add: metaOf(n) as never });
  }
  return { swaps, problems };
}
function main() {
  const snap = rd<Snap>(SNAPSHOT); const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
  const files: Record<string, string> = {}; const outs: Record<string, unknown> = {};
  for (const id of ["US1", "US2"] as const) {
    const p = planFor(id, snap[id].slots, by); const final = applySwaps(snap[id].slots, p.swaps);
    const other = id === "US1" ? "US2" : "US1"; const bad = [...p.problems, ...dbUnitViolations(final, by), ...verifyUshAssignment([resultOf(id, final, by), resultOf(other, snap[other].slots, by)])];
    console.log(`${id} 교체 ${p.swaps.length}건, 위반: ${bad.length ? bad.join("; ") : "0"}`);
    outs[id] = { bad, plan: { kind: "ap_new_version_swap_plan", set: id, sourceSetName: snap[id].sourceSetName, sourceVersionNo: snap[id].sourceVersionNo, generatedBy: "scripts/ap-generation/ush-stage-cd-plans.ts",
      note: `Stage C·D: MC 자료 세트 ${p.swaps.length}개를 실제 자료 세트로 교체(같은 크기·시대·후보 단원·스킬 범주 순서). 순서: 배치 ush-real-c·ush-real-d 적재 → 이 계획으로 새 버전(v4) 초안 → 확인 → '새 버전 공개'. 두 계획(US1·US2)은 서로 독립이다.`, swapCount: p.swaps.length, verifierViolations: bad, swaps: p.swaps } };
    files[id] = `data/ap/stock/${id.toLowerCase()}-v4-real-cd-swap-plan.json`;
  }
  if (process.argv.includes("--write")) {
    for (const id of ["US1", "US2"]) { const o = outs[id] as { bad: string[]; plan: unknown }; if (o.bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); } writeFileSync(files[id], JSON.stringify(o.plan, null, 1)); }
    console.log("계획 파일을 썼습니다.");
  }
}
if (process.argv[1]?.endsWith("ush-stage-cd-plans.ts")) main();
