// 부분 연습 세트(AB·BC: Non-Calculator / Calculator / Free-Response) 조립 가능성 — 무료·DB 없음.
// 입력 풀 = 렌더 보고서 통과 + 화면 검증 증거(해시 일치) + 결함 없음 + auto_passed 재고(data/ap/stock/items.json). s1a 보조 후보는 렌더 보고서·화면 증거가 있는 것만 들어온다.
//   npx tsx scripts/ap-generation/partial-feasibility.ts [--evidence <json>,<json>] [--overlap-max N]   # 기본: data/ap/screen-evidence/evidence-*.json 전부
// 결과: 콘솔 + data/ap/stock/partial-feasibility.json. 세트를 만들 수 없으면 무엇이 모자란지(문항 수·문항군·유형·단원)를 그대로 보고한다.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planFrqShortSet, planPartialSet, type AssembleCandidate } from "../../lib/ap-exam/assemble";
import { AP_PARTIALS, AP_PARTIAL_SUBJECTS, sectionsForPartial, type ApPartialId } from "../../lib/ap-exam/layouts";
import { itemContentHash, judgeScreenEntries, type ScreenEntry } from "../../lib/ap-generation/verify-guard";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
type It = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; difficultyProvisional: string | null; skillPrimary: string; archetype?: string | null; payload: Record<string, unknown> };
// s1a(보조 배치)도 렌더 보고서·화면 증거에 들어오면 풀에 포함된다(해시 일치 조건은 동일).
const items = [...(JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as It[]), ...(JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8")) as It[])];
const scan = new Map((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string; flags: unknown[] }[]).map((r) => [r.key, r.flags.length]));
const evFiles = arg("evidence", "") ? arg("evidence", "").split(",") : readdirSync("data/ap/screen-evidence").filter((f) => /^evidence-.*\.json$/.test(f)).map((f) => `data/ap/screen-evidence/${f}`);
const ev = { entries: evFiles.flatMap((f) => (JSON.parse(readFileSync(f, "utf-8")) as { entries: ScreenEntry[] }).entries) };
const evBy = new Map<string, ScreenEntry[]>(); for (const e of ev.entries) (evBy.get(e.candidate_key) ?? evBy.set(e.candidate_key, []).get(e.candidate_key)!).push(e);
const report = new Map((JSON.parse(readFileSync("data/ap/render-check/report.json", "utf-8")) as { results: { key: string; status: string; contentHash?: string }[] }).results.map((r) => [r.key, r]));
const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
const verified = items.filter((i) => {
  if (i.validation !== "auto_passed" || scan.get(i.stockKey)) return false;
  const r = report.get(i.stockKey); if (!r || (r.status !== "pass" && r.status !== "not_applicable") || r.contentHash !== itemContentHash(i.payload)) return false; // 렌더 검증(해시 일치)
  if (gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }).status === "fail") return false;
  const es = evBy.get(i.stockKey); return !!es && judgeScreenEntries(es, i.payload, process.cwd()).ok; // 화면 검증(해시 일치)
});
const toC = (i: It): AssembleCandidate => ({ candidateKey: i.stockKey, problemId: i.stockKey, versionId: "v", kind: i.kind, purpose: "mock_exam", releaseTier: "review_env", calculator: i.calculator, keywordCode: i.keywordCode, itemFamilyId: i.itemFamilyId, difficulty: DIFF[i.difficultyProvisional ?? ""] ?? "medium", itemIndex: 0, archetype: i.archetype ?? (i.payload as { template?: string }).template ?? null, skill: i.skillPrimary });
const overlapArg = arg("overlap-max", "");
const out: unknown[] = [];
for (const subject of AP_PARTIAL_SUBJECTS) {
  const pool = verified.filter((i) => i.apSubjectCode === subject);
  const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${subject}.json`, "utf-8")) as ApCurriculumFile;
  const unitWeights = cur.weights.filter((x) => x.axis === "unit" && x.section === "mc").map((x) => ({ code: x.code, min: x.min ?? 0, max: x.max ?? 100 }));
  console.log(`\n== ${subject}: 검증 완료 풀 ${pool.length}건 (MC ${pool.filter((i) => i.kind === "mc").length}, FRQ ${pool.filter((i) => i.kind === "frq_bundle").length}) ==`);
  for (const id of Object.keys(AP_PARTIALS) as ApPartialId[]) {
    const plan = planPartialSet(subject, id, pool.map(toC), { overlapMax: overlapArg ? Number(overlapArg) : 0, unitWeights });
    const need = sectionsForPartial(subject, id).map((s) => `${s.key} ${s.count}문항·${s.minutes}분`).join(" + ");
    console.log(`- ${plan.name}: ${plan.ok ? "조립 가능" : "불가"} (필요 ${need}) 채움 ${Object.entries(plan.composition).map(([k, v]) => `${k} ${v.count}`).join(", ")}`);
    for (const s of plan.shortage) console.log(`    모자람 ${s.sectionKey} ${s.have}/${s.need}: ${s.reasons.join("; ")}`);
    if (plan.coverageGaps.length) console.log(`    단원 비중 미달(보고): ${plan.coverageGaps.join(", ")}`);
    out.push({ subject, partial: id, name: plan.name, ok: plan.ok, labelAllowed: plan.labelAllowed, poolSize: pool.length, composition: plan.composition, shortage: plan.shortage, coverageGaps: plan.coverageGaps });
  }
}
// 짧은 Free-Response 연습(2~4 묶음, 서로 다른 문항군): 공식 6문항을 못 채워도 만들 수 있는지.
for (const subject of AP_PARTIAL_SUBJECTS) {
  const pool = verified.filter((i) => i.apSubjectCode === subject);
  const sp = planFrqShortSet(subject, pool.map(toC), { overlapMax: overlapArg ? Number(overlapArg) : 0 });
  const c = sp.composition;
  console.log(`- ${subject} 짧은 Free-Response 연습: ${sp.ok ? "조립 가능" : "불가"} · 묶음 ${c.bundles}개(문항군 ${c.families}, 유형 ${c.archetypes}) · 계산기 허용 ${c.calculatorAllowed}/불가 ${c.calculatorNotAllowed} · ${sp.totalMinutes}분 ${sp.shortage.join("; ")}`);
  out.push({ subject, partial: "frq_short", name: sp.name, ok: sp.ok, poolFrq: pool.filter((i) => i.kind === "frq_bundle").length, composition: c, totalMinutes: sp.totalMinutes, shortage: sp.shortage });
}
writeFileSync("data/ap/stock/partial-feasibility.json", JSON.stringify(out, null, 1));
