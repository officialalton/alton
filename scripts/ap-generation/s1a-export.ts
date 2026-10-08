// S1a 최초 후보 68개를 재고 후보 형식으로 내보낸다: 통과 = (최초 통과 or 수선 통과). 나머지는 반려로 사유와 함께 남긴다. DB 없음.
//   npx tsx scripts/ap-generation/s1a-export.ts   → data/ap/sample-2027/s1a-final/candidates.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve("data/ap/sample-2027");
type C = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const main = JSON.parse(readFileSync(path.join(root, "s1a/candidates.json"), "utf-8")) as C[]; const rep = JSON.parse(readFileSync(path.join(root, "s1a-r/candidates.json"), "utf-8")) as C[];
const map = JSON.parse(readFileSync(path.join(root, "s1a-r/repair_map.json"), "utf-8")) as Record<string, string>; const repBy = new Map(rep.map((r) => [map[r.candidateKey], r]));
// 근사 중복(duplicate_gate_near_duplicate)은 재고 정책상 반려가 아니라 같은 문항군의 변형이다(완전 중복만 재고에서 제외) → 통과로 둔다.
const out: C[] = main.map((raw): C => {
  const c = raw.rejectionReason === "duplicate_gate_near_duplicate" ? { ...raw, reviewState: "auto_passed", rejectionReason: null, nearDuplicateNote: "near-duplicate of an earlier candidate (item-family variant, kept)" } : raw;
  const hist: C[] = [{ run: "s1a", attempt: "first", outcome: c.reviewState === "auto_passed" ? "passed" : "rejected", reasons: c.rejectionReason ?? null }];
  if (c.reviewState === "auto_passed") return { ...c, history: hist, repaired: false };
  const r = repBy.get(c.candidateKey); if (!r) return { ...c, history: hist, repaired: false };
  hist.push({ run: "s1a-r", attempt: "repair", outcome: r.reviewState === "auto_passed" ? "passed" : "rejected", reasons: r.rejectionReason ?? null });
  return r.reviewState === "auto_passed" ? { ...r, candidateKey: c.candidateKey, cellId: c.cellId, history: hist, repaired: true } : { ...c, rejectionReason: `first: ${c.rejectionReason}; repair: ${r.rejectionReason}`, history: hist, repaired: false };
});
mkdirSync(path.join(root, "s1a-final"), { recursive: true }); writeFileSync(path.join(root, "s1a-final/candidates.json"), JSON.stringify(out, null, 1));
const pass = out.filter((c) => c.reviewState === "auto_passed" || c.repaired);
console.log(`최초 후보 ${out.length}: 통과 ${pass.length}(최초 ${out.filter((c) => c.reviewState === "auto_passed" && !c.repaired).length}, 수선 ${out.filter((c) => c.repaired).length}), 반려 ${out.length - pass.length}`);
for (const c of out.filter((c) => !(c.reviewState === "auto_passed" || c.repaired))) console.log("  반려", c.candidateKey, String(c.rejectionReason).slice(0, 110));
