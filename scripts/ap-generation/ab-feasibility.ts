// AB 풀 모의고사 조립 가능성(무료·DB 없음): 사용 가능한 고유 재고(최신 게이트 + 생성기 결함 없음 + 렌더 게이트 통과/해당 없음)로
// 공식 AB 구조(MC 42 = A 29 계산기 불가 + B 13 계산기 필수, FRQ 6 = A 2 계산기 + B 4 계산기 불가, 단원 비중)를 채울 수 있는지 계산한다.
//   npx tsx scripts/ap-generation/ab-feasibility.ts [--subject ap_calculus_ab]
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planApSet, type AssembleCandidate } from "../../lib/ap-exam/assemble";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const SUBJECT = process.argv.includes("--subject") ? process.argv[process.argv.indexOf("--subject") + 1] : "ap_calculus_ab";
type It = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; difficultyProvisional: string | null; payload: Record<string, unknown>; skillPrimary: string };
const scan = new Map((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => [r.key, true]));
const all = [...(JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as It[]), ...(JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8")) as It[])].filter((i) => i.apSubjectCode === SUBJECT);
const status = (i: It) => gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }).status;
const reval = new Set((JSON.parse(readFileSync("data/ap/stock/revalidation-results.json", "utf-8")) as { stockKey: string; passed: boolean; generatorDefect: boolean }[]).filter((r) => r.passed && !r.generatorDefect).map((r) => r.stockKey));
const view = (validations: string[], onlyReval = false) => all.filter((i) => validations.includes(i.validation) && (!onlyReval || i.validation !== "needs_revalidation" || reval.has(i.stockKey)) && !scan.has(i.stockKey) && status(i) !== "fail");
const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const w = cur.weights.filter((x) => x.axis === "unit" && x.section === "mc"); const unitOf = (k: string) => k.split(".")[0];
const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
function analyze(label: string, pool: It[]) {
  const toC = (i: It): AssembleCandidate => ({ candidateKey: i.stockKey, problemId: i.stockKey, versionId: "v", kind: i.kind, purpose: "mock_exam", releaseTier: "review_env", calculator: i.calculator, keywordCode: i.keywordCode, itemFamilyId: i.itemFamilyId, difficulty: DIFF[i.difficultyProvisional ?? ""] ?? "medium", itemIndex: 0 });
  const plan = planApSet(SUBJECT, "full_practice", pool.map(toC));
  const mc = pool.filter((i) => i.kind === "mc"); const frq = pool.filter((i) => i.kind === "frq_bundle");
  const byCalc = (l: It[]) => l.reduce<Record<string, number>>((m, i) => ((m[i.calculator] = (m[i.calculator] ?? 0) + 1), m), {});
  const fam = (l: It[]) => new Set(l.map((i) => i.itemFamilyId)).size; const eff = (l: It[]) => { const m = new Map<string, number>(); l.forEach((i) => m.set(i.itemFamilyId, (m.get(i.itemFamilyId) ?? 0) + 1)); return [...m.values()].reduce((a, n) => a + Math.min(n, 2), 0); };
  const unitRows = w.map((x) => { const have = mc.filter((i) => unitOf(i.keywordCode) === x.code); const min = Math.ceil(((x.min ?? 0) / 100) * 42); const max = Math.floor(((x.max ?? 100) / 100) * 42); return { unit: x.code, weight: `${x.min}-${x.max}%`, needMin: min, needMax: max, have: have.length, families: fam(have), effective: eff(have), shortfallVsMin: Math.max(0, min - eff(have)) }; });
  // 같은 문항을 한 세트에만 쓰는 규칙(평소 조립 관행)에서 만들 수 있는 풀 세트 수와 첫 번째로 모자라는 칸
  const used = new Set<string>(); let sets = 0; let firstShort: unknown = null; for (let n = 0; n < 12; n++) { const pl = planApSet(SUBJECT, "full_practice", pool.map(toC), used); if (!pl.ok) { firstShort = pl.shortfall; break; } pl.items.forEach((x) => used.add(x.c.problemId)); sets++; }
  return { label, disjointFullSets: sets, firstShortAfter: firstShort, items: pool.length, mc: { n: mc.length, byCalc: byCalc(mc), families: fam(mc), effective: eff(mc) }, frq: { n: frq.length, byCalc: byCalc(frq), families: fam(frq) }, unitRows, plan: { ok: plan.ok, shortfall: plan.shortfall } };
}
const res = [analyze("usable_now(auto_passed)", view(["auto_passed"])), analyze("after_revalidation_pass(auto_passed+re-validated needs_revalidation)", view(["auto_passed", "needs_revalidation"], true)), analyze("potential_if_revalidated(auto_passed+needs_revalidation)", view(["auto_passed", "needs_revalidation"]))];
writeFileSync(`data/ap/stock/${SUBJECT}-set-feasibility.json`, JSON.stringify(res, null, 1));
for (const r of res) { console.log(`\n[${r.label}] 항목 ${r.items} / MC ${r.mc.n}(계산기 ${JSON.stringify(r.mc.byCalc)}, 문항군 ${r.mc.families}, 군당 2개 상한 유효 ${r.mc.effective}) / FRQ ${r.frq.n}(${JSON.stringify(r.frq.byCalc)}, 문항군 ${r.frq.families})`); console.log(`  서로 겹치지 않는 풀 세트 최대 ${r.disjointFullSets}개(다음 세트 부족: ${JSON.stringify(r.firstShortAfter)})`); console.log(`  풀 모의고사 조립: ${r.plan.ok ? "가능" : "불가"} 부족 ${JSON.stringify(r.plan.shortfall)}`); console.log("  단원별(MC):", r.unitRows.map((u) => `${u.unit}:${u.effective}/${u.needMin}${u.shortfallVsMin ? "(-" + u.shortfallVsMin + ")" : ""}`).join(" ")); }
