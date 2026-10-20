// 에세이 참고답 점수·설명 충돌 교체 후보(2026-10-19, 오너 승인: 설명에 맞춰 점수 조정). 점검기(lib/ap-generation/essay-reference-check.ts)가 찾은
// 공개 세트 충돌 5문항 중 USH leq_1·leq_3, WH2 leq, EngLit fa3 는 이미 audit-wuel 배치의 수정본으로 교체됐고(점검기 재실행 위반 0),
// 남은 것은 EngLit fa2(LT2)뿐이다: low 샘플이 3/6(thesis 1)인데 설명은 "does not earn the thesis point" → 헤딩을 2/6(thesis 0)으로.
//   npx tsx scripts/ap-generation/audit-score1019-build.ts   → data/ap/stock/audit-score1019-{items,pass-keys}.json, lt2-v5-audit-score1019-swap-plan.json
import fs from "node:fs";
import path from "node:path";
import { checkEssayReference } from "../../lib/ap-generation/essay-reference-check";

const S = path.resolve(__dirname, "../../data/ap/stock");
const src = JSON.parse(fs.readFileSync(path.join(S, "lt-p1b-items.json"), "utf8")) as Record<string, any>[];
const orig = src.find((x) => x.candidateKey === "ap_english_literature-fa2-k0")!;
const it = JSON.parse(JSON.stringify(orig));
const FROM = "Sample essay (low; scored 3/6: thesis 1, evidence 2, sophistication 0)", TO = "Sample essay (low; scored 2/6: thesis 0, evidence 2, sophistication 0)";
if (it.payload.reference_text.split(FROM).length !== 2) throw new Error("heading not found once");
it.payload.reference_text = it.payload.reference_text.replace(FROM, TO);
const viol = checkEssayReference(it.payload.reference_text, { expectedMax: 6 });
if (viol.length) throw new Error(`still violating: ${JSON.stringify(viol)}`);
const NEWRUN = "audit-score1019";
Object.assign(it, { run: NEWRUN, stockKey: `${NEWRUN}:${it.candidateKey}`, legacyReserve: false, selectedForSample: false, history: [{ at: "2026-10-19", note: `copy of ${orig.run}:${orig.candidateKey}; reference heading low 3/6 (thesis 1) -> 2/6 (thesis 0) to match the thesis explanation` }] });
fs.writeFileSync(path.join(S, `${NEWRUN}-items.json`), JSON.stringify([it], null, 1) + "\n");
fs.writeFileSync(path.join(S, `${NEWRUN}-pass-keys.json`), JSON.stringify([`${NEWRUN}:${it.candidateKey}`], null, 1) + "\n");
const plan = { kind: "ap_new_version_swap_plan", set: "LT2", sourceSetName: "AP English Literature — Practice Exam 2", sourceVersionNo: 4, generatedBy: "scripts/ap-generation/audit-score1019-build.ts (essay reference checker 2026-10-19)",
  note: "Batch 'audit-score1019' must be loaded first. Heading-only correction; sample essays and rubric unchanged. sourceVersionNo is the version after lt2-v4-audit-wuel; the admin new-version flow copies whatever is published and the removeKey slot must still match.", swapCount: 1, verifierViolations: [],
  swaps: [{ section: "ap_frq", removeKey: `englit-p1-b:${orig.candidateKey}`, addKey: `${NEWRUN}:${it.candidateKey}`, tier: "required", reason: "Reference low sample scored 3/6 with thesis 1 while its explanation says the thesis point is not earned; heading now 2/6 (thesis 0, evidence 2, sophistication 0)", remove: { type: "q2" }, add: { type: "q2", sameCell: true } }] };
fs.writeFileSync(path.join(S, "lt2-v5-audit-score1019-swap-plan.json"), JSON.stringify(plan, null, 1) + "\n");
console.log("ok", it.stockKey, orig.run);
