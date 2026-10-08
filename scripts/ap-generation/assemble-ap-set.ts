// AP 모의고사 세트 조립(총괄·관리자용). 기본 dry-run(조립 계획·부족 보고만). --execute 는 대상이 허용 목록(로컬 | 비프로덕션 ref + 확인 플래그)일 때만.
// 모의고사 용도(purpose=mock_exam)로 변환된 문항만 쓴다. 공식 문항 수·시간을 못 채우면 세트를 만들지 않고 무엇이 모자란지 보고한다(패딩·라벨 변경 없음).
//   부분 연습(첫 제품 형태, AB·BC):
//     npx tsx scripts/ap-generation/assemble-ap-set.ts --subject ap_calculus_ab --partial noncalc_mc|calc_mc|frq [--seq 2] [--overlap-max N] [--tier free|tutoring] [--execute]
//       세트 이름은 고정: "AP Calculus AB — Non-Calculator Practice" / "— Calculator Practice" / "— Free-Response Practice"(--seq 2 이상이면 뒤에 번호)
//   기존 방식(MC/FRQ/풀 라벨):
//     npx tsx scripts/ap-generation/assemble-ap-set.ts --subject ap_calculus_ab --label mc_practice --name "..." [--tier ...] [--execute]
//   비프로덕션: 위 명령에 --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq 를 붙인다(프로덕션·그 외 거부).
import { readFileSync } from "node:fs";
import { connectAllowlisted } from "./target";
import { planApSet, planPartialSet, type AssembleCandidate, type UnitWeight } from "../../lib/ap-exam/assemble";
import { AP_PARTIALS, apSectionLayout, partialSetName, sectionsForPartial, type ApPartialId, type ApSetLabel } from "../../lib/ap-exam/layouts";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
async function main() {
  const subject = arg("subject"), partial = arg("partial") as ApPartialId | undefined;
  if (!subject) throw new Error("--subject 는 필수입니다.");
  if (partial && !(partial in AP_PARTIALS)) throw new Error("--partial noncalc_mc|calc_mc|frq");
  let label = arg("label") as ApSetLabel | undefined, name = arg("name");
  if (partial) { label = AP_PARTIALS[partial].label; name = partialSetName(subject, partial, arg("seq") ? Number(arg("seq")) : undefined); }
  if (!label || !name) throw new Error("--partial 또는 (--label 과 --name) 이 필요합니다.");
  const tier = (arg("tier") ?? "tutoring") as "free" | "tutoring";
  const execute = process.argv.includes("--execute");
  const conn = await connectAllowlisted(); const { db } = conn;
  console.log(`대상: ${conn.label} / ${execute ? "EXECUTE" : "dry-run"} / ${name}`);
  const { data: rows, error } = await db.from("ap_candidate_items").select("candidate_key, kind, calculator, keyword_code, skill_primary, item_family_id, difficulty_provisional, purpose, release_tier, payload, ap_candidate_problems(item_index, problem_id, problem_version_id)").eq("ap_subject_code", subject).eq("is_current", true).eq("purpose", "mock_exam");
  if (error) throw new Error(error.message);
  const { data: usedRows } = await db.from("mock_exam_set_items").select("problem_id, mock_exam_sets!inner(status, exam_program)").eq("mock_exam_sets.exam_program", "ap").neq("mock_exam_sets.status", "archived");
  const used = new Set((usedRows ?? []).map((r) => r.problem_id as string));
  const pool: AssembleCandidate[] = (rows ?? []).flatMap((r) => ((r.ap_candidate_problems as { item_index: number; problem_id: string; problem_version_id: string }[]) ?? []).map((p) => ({
    candidateKey: r.candidate_key, problemId: p.problem_id, versionId: p.problem_version_id, kind: r.kind as "mc" | "frq_bundle", purpose: r.purpose as "mock_exam", releaseTier: r.release_tier,
    calculator: r.calculator, keywordCode: r.keyword_code, itemFamilyId: r.item_family_id, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", itemIndex: p.item_index,
    archetype: ((r.payload as { archetype?: string; template?: string } | null)?.archetype ?? (r.payload as { template?: string } | null)?.template) ?? null, skill: r.skill_primary,
  })));
  let items: { sectionKey: string; position: number; c: AssembleCandidate }[]; let sectionKeys: string[];
  if (partial) {
    let unitWeights: UnitWeight[] | undefined;
    try { const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${subject}.json`, "utf-8")) as { weights: { axis: string; section: string; code: string; min?: number; max?: number }[] }; unitWeights = cur.weights.filter((x) => x.axis === "unit" && x.section === "mc").map((x) => ({ code: x.code, min: x.min ?? 0, max: x.max ?? 100 })); } catch { /* 가중치 파일 없음 */ }
    const plan = planPartialSet(subject, partial, pool, { used, overlapMax: arg("overlap-max") ? Number(arg("overlap-max")) : undefined, unitWeights });
    console.log(`풀 ${pool.length}건 → 선택 ${plan.items.length}건 (필요 ${sectionsForPartial(subject, partial).map((s) => `${s.key} ${s.count}문항·${s.minutes}분`).join(" + ")})`);
    for (const [k, v] of Object.entries(plan.composition)) console.log(`  ${k}: ${v.count}문항, 문항군 ${v.families}, 유형 ${v.archetypes}, 겹침 ${v.overlapUsed}, 단원 ${JSON.stringify(v.units)}`);
    if (plan.coverageGaps.length) console.log(`  단원 비중 미달(보고, 차단 아님): ${plan.coverageGaps.join(", ")}`);
    if (!plan.ok) { for (const s of plan.shortage) console.log(`  모자람 ${s.sectionKey} ${s.have}/${s.need}: ${s.reasons.join("; ")}`); console.log("공식 파트의 문항 수·다양성 하한을 채우지 못해 세트를 만들지 않습니다(패딩 없음)."); return; }
    items = plan.items; sectionKeys = sectionsForPartial(subject, partial).map((s) => s.key);
  } else {
    const plan = planApSet(subject, label, pool, used);
    console.log(`풀 ${pool.length}건 → 선택 ${plan.items.length}건, 부족: ${plan.shortfall.map((s) => `${s.sectionKey} ${s.have}/${s.need}`).join(", ") || "없음"}`);
    if (!plan.ok) { console.log("공식 구조를 채우지 못해 세트를 만들지 않습니다(라벨 규칙)."); return; }
    items = plan.items; sectionKeys = [...new Set(plan.items.map((i) => i.sectionKey))];
  }
  if (!execute) { console.log("dry-run 종료."); return; }
  const { data: dup } = await db.from("mock_exam_sets").select("id").eq("name", name).eq("exam_program", "ap").neq("status", "archived").limit(1);
  if (dup?.length) throw new Error(`같은 이름의 세트가 이미 있습니다(${name}). 새 번호는 --seq 로.`);
  const layout = { sections: apSectionLayout(subject).filter((s) => sectionKeys.includes(s.key)) };
  const { data: set, error: se } = await db.from("mock_exam_sets").insert({ name, difficulty_tier: "standard", status: "draft", format: "ap_fixed", readiness_status: "not_applicable", exam_program: "ap", ap_subject: subject, ap_label: label, section_layout: layout }).select("id").single();
  if (se || !set) throw new Error(se?.message);
  for (const it of items) {
    const { error: ie } = await db.from("mock_exam_set_items").insert({ exam_set_id: set.id, section: it.sectionKey, position: it.position, problem_id: it.c.problemId, problem_version_id: it.c.versionId, sat_domain: `ap:${it.c.keywordCode}`, difficulty: it.c.difficulty });
    if (ie) throw new Error(ie.message);
  }
  const { error: pe } = await db.from("mock_exam_sets").update({ status: "published", published_at: new Date().toISOString(), access_tier: tier }).eq("id", set.id);
  if (pe) throw new Error(pe.message);
  console.log(`세트 ${set.id} 공개(${label}, ${tier})`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
