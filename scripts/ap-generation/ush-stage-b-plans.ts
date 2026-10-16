// AP U.S. History Practice Exam 1·2 (게시 v2) Stage B 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/ush-stage-b-plans.ts [--write]
// 입력: 게시 v2 슬롯 스냅샷 data/ap/stock/ush-us1-us2-published-v2-slots.json(2026-10-15 `supabase db query --linked` SELECT 전용 조회: US1 v2·US2 v2 둘 다 published), 재고(US History 풀, 신규 배치 ush-real-b 포함).
// 교체: US2 ap_frq #1 dbq_1(가공 문서 7개 · 시장 혁명) → 실제 자료 DBQ(시장 혁명), US1 ap_frq #1 dbq_2(가공 문서 7개 · 노동 1877-1900) → 실제 자료 DBQ(대기업과 연방 규제). 같은 위치·같은 시험 구간(DBQ)·같은 시대.
import { readFileSync, writeFileSync } from "node:fs";
import { loadUshPool, type UshItem } from "./ush-pool";
import { verifyUshAssignment } from "./ush-assign";
import { applySwaps, resultOf, type PlanSwap, type Slot, type Snap } from "./ush-stage-a-plans";

export const STAGE_B: Record<"US1" | "US2", { remove: string; add: string; label: string }> = {
  US1: { remove: "ush-p1-b:ap_us_history-dbq_2-k0", add: "ush-real-b:ap_us_history-real_b_dbq_regulation-k0", label: "dbq_2 (Growth and Limits of the Labor Movement, ALTON-composed) -> real-source DBQ on large corporations and federal regulation" },
  US2: { remove: "ush-p1-b:ap_us_history-dbq_1-k0", add: "ush-real-b:ap_us_history-real_b_dbq_market-k0", label: "dbq_1 (The Market Revolution and American Lives, ALTON-composed) -> real-source DBQ on the market revolution" },
};
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const metaOf = (c: UshItem) => ({ kind: "dbq" as const, period: c.period, template: c.template });
export function planFor(id: "US1" | "US2", slots: Slot[], by: Map<string, UshItem>): { swaps: PlanSwap[]; problems: string[] } {
  const { remove, add } = STAGE_B[id]; const problems: string[] = []; const r = by.get(remove), n = by.get(add);
  const s = slots.find((x) => x.section === "ap_frq" && x.candidateKey === remove);
  if (!s) problems.push(`${id}: ${remove} 가 ap_frq 에 없음`); if (!r) problems.push(`${id}: 재고에 없는 키 ${remove}`); if (!n) problems.push(`${id}: 재고(화면 증거 보유)에 없는 키 ${add}`);
  if (r && n) { if (r.template !== "dbq" || n.template !== "dbq") problems.push(`${id}: dbq 가 아님`); if (r.period !== n.period) problems.push(`${id}: DBQ 시대가 다름(${r.period} → ${n.period})`); }
  return { swaps: s && r && n ? [{ section: "ap_frq", position: s.position, removeKey: remove, addKey: add, remove: metaOf(r) as never, add: metaOf(n) as never }] : [], problems };
}
function main() {
  const snap = rd<Snap>("data/ap/stock/ush-us1-us2-published-v2-slots.json"); const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
  const files: Record<string, string> = {}; const outs: Record<string, unknown> = {};
  for (const id of ["US1", "US2"] as const) {
    const p = planFor(id, snap[id].slots, by); const final = applySwaps(snap[id].slots, p.swaps);
    const other = id === "US1" ? "US2" : "US1"; const bad = [...p.problems, ...verifyUshAssignment([resultOf(id, final, by), resultOf(other, snap[other].slots, by)])];
    console.log(`${id} 교체 ${p.swaps.length}건, 위반: ${bad.length ? bad.join("; ") : "0"}`);
    outs[id] = { bad, plan: { kind: "ap_new_version_swap_plan", set: id, sourceSetName: snap[id].sourceSetName, sourceVersionNo: snap[id].sourceVersionNo, generatedBy: "scripts/ap-generation/ush-stage-b-plans.ts",
      note: `Stage B: ${STAGE_B[id].label}. 같은 위치(ap_frq #1)·같은 시험 구간(DBQ)·같은 시대. 순서: 배치 ush-real-b 적재 → 이 계획으로 새 버전(v3) 초안 → 확인 → '새 버전 공개'. 두 계획(US1·US2)은 서로 독립이다.`, swapCount: p.swaps.length, verifierViolations: bad, swaps: p.swaps } };
    files[id] = `data/ap/stock/${id.toLowerCase()}-v3-real-b-swap-plan.json`;
  }
  if (process.argv.includes("--write")) {
    for (const id of ["US1", "US2"]) { const o = outs[id] as { bad: string[]; plan: unknown }; if (o.bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); } writeFileSync(files[id], JSON.stringify(o.plan, null, 1)); }
    console.log("계획 파일을 썼습니다.");
  }
}
if (process.argv[1]?.endsWith("ush-stage-b-plans.ts")) main();
