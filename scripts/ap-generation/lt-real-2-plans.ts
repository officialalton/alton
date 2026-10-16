// AP English Literature Practice Exam 1·2 Stage 2 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/lt-real-2-plans.ts [--write]
// 원본 = 게시 v1 슬롯 스냅샷(data/ap/stock/lt1-lt2-published-v1-slots.json, SELECT 전용) + Stage 1 계획(lt-real-1) 적용 = Stage 1 공개 뒤의 v2. 계획의 sourceVersionNo 는 2 다.
// 교체(같은 위치·같은 종류·같은 크기·같은 장르 묶음): LT1 = MC 단편 s05(13) → ls3(Chopin) · MC 장편 l04(10) → ll4(Austen) · FRQ Q2 fb2 → rf3(Crane). LT2 = MC 시 p05(13) → ls5(Arnold) · MC 희곡 l01(8) → ll1(Ibsen).
import { readFileSync, writeFileSync } from "node:fs";
import { loadLtPool } from "./lt-pool";
import { categorySummary, groupSummary, verifyLtAssignment, type LtResult } from "./lt-assign";
import { applySwaps, planFor, resultOf, STAGE_1, type PlanSwap, type Snap } from "./lt-real-1-plans";

const K = (b: string, c: string) => `${b}:ap_english_literature-${c}-k0`;
export const STAGE_2: Record<"LT1" | "LT2", { mc: [string, string][]; frq: [string, string][] }> = {
  LT1: { mc: [[K("englit-p1-a", "s05"), K("lt-real-2", "real-ls3")], [K("englit-p1-c", "l04"), K("lt-real-2", "real-ll4")]], frq: [[K("englit-p1-b", "fb2"), K("lt-real-2", "real-rf3")]] },
  LT2: { mc: [[K("englit-p1-a", "p05"), K("lt-real-2", "real-ls5")], [K("englit-p1-a", "l01"), K("lt-real-2", "real-ll1")]], frq: [] },
};
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
/** Stage 1 적용 뒤(게시 v2) 슬롯. */
export function stage1Slots(id: "LT1" | "LT2", snap: Snap, by: Parameters<typeof planFor>[2]) { const p = planFor(id, snap[id].slots, by, STAGE_1[id]); if (p.problems.length) throw new Error(p.problems.join("; ")); return applySwaps(snap[id].slots, p.swaps); }

function main() {
  const snap = rd<Snap>("data/ap/stock/lt1-lt2-published-v1-slots.json"); const { all } = loadLtPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
  const out: Record<string, { swaps: PlanSwap[]; sum: unknown }> = {}; const finals: LtResult[] = []; const bad: string[] = [];
  for (const id of ["LT1", "LT2"] as const) {
    const src = stage1Slots(id, snap, by); const p = planFor(id, src, by, STAGE_2[id]); const final = applySwaps(src, p.swaps); const before = resultOf(id, src, by), after = resultOf(id, final, by); bad.push(...p.problems); finals.push(after);
    out[id] = { swaps: p.swaps, sum: { categoriesBefore: categorySummary(before), categoriesAfter: categorySummary(after), groupsAfter: groupSummary(after) } };
  }
  bad.push(...verifyLtAssignment(finals)); console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { swaps: v.swaps.length, ...(v.sum as object) }])), null, 1)); console.log(`위반: ${bad.length ? bad.join("; ") : "0"}`);
  if (process.argv.includes("--write")) {
    if (bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); }
    const note = (id: "LT1" | "LT2") => id === "LT1" ? "Stage 2 (source = Stage 1 published v2): ① MC 단편 세트 s05(ALTON 작성, 13문항) → ls3(Chopin 'A Pair of Silk Stockings' 문단 1–13, 13문항) ② MC 장편 세트 l04(ALTON 작성, 10문항) → ll4(Austen Persuasion 1장 문단 1–10, 10문항) ③ FRQ Q2 fb2(ALTON 작성 산문) → rf3(Crane 'The Open Boat' I장 문단 1–10, 677단어). 같은 칸·같은 크기·같은 장르 묶음. 교체 뒤 구성은 독립 검증기 위반 0." : "Stage 2 (source = Stage 1 published v2): ① MC 시 세트 p05(ALTON 작성, 13문항) → ls5(Arnold 'Dover Beach' 37줄, 13문항) ② MC 희곡 세트 l01(ALTON 작성, 8문항) → ll1(Ibsen A Doll's House 3막 대화 발췌, 8문항). FRQ·나머지 MC 는 그대로. 교체 뒤 구성은 독립 검증기 위반 0.";
    for (const id of ["LT1", "LT2"] as const) writeFileSync(`data/ap/stock/${id.toLowerCase()}-v3-real-2-swap-plan.json`, JSON.stringify({ kind: "ap_new_version_swap_plan", set: id, sourceSetName: snap[id].sourceSetName, sourceVersionNo: 2, generatedBy: "scripts/ap-generation/lt-real-2-plans.ts", note: note(id), swapCount: out[id].swaps.length, verifierViolations: [], swaps: out[id].swaps }, null, 1) + "\n");
    console.log("계획 파일을 썼습니다.");
  }
}
if (process.argv[1]?.endsWith("lt-real-2-plans.ts")) main();
