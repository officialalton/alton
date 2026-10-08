// AP 모의고사 세트 조립(총괄·관리자용). 기본 dry-run, --execute 는 로컬 DB 에서만. 모의고사 용도(mock_exam)로 변환된 문항만 쓴다.
//   겹침: --max-overlap N (이전 세트에서 재사용할 문항 수; 기본 전체 모의고사 0 = OVERLAP_DEFAULTS). 단원 비중·문항군 다양성은 공식 구조에서 자동 적용(--no-composition 로 끔).
//   npx tsx scripts/ap-generation/assemble-ap-set.ts --subject ap_calculus_ab --label mc_practice --name "AP Calculus AB MC Practice 1" [--tier free|tutoring] [--execute]
import { connect } from "../keywords/db";
import { readFileSync } from "node:fs";
import { OVERLAP_DEFAULTS, planApSet, type AssembleCandidate, type AssembleOptions } from "../../lib/ap-exam/assemble";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { apSectionLayout, type ApSetLabel } from "../../lib/ap-exam/layouts";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
async function main() {
  const subject = arg("subject"), label = arg("label") as ApSetLabel | undefined, name = arg("name");
  if (!subject || !label || !name) throw new Error("--subject --label --name 은 필수입니다.");
  const tier = (arg("tier") ?? "tutoring") as "free" | "tutoring";
  const execute = process.argv.includes("--execute");
  const conn = await connect(); if (!conn) throw new Error("DB 환경변수가 없습니다.");
  if (execute && conn.target !== "local") throw new Error(`--execute 는 로컬 DB 에서만 허용됩니다(대상: ${conn.target}).`);
  const { db } = conn;
  const { data: rows, error } = await db.from("ap_candidate_items").select("candidate_key, kind, calculator, keyword_code, item_family_id, difficulty_provisional, purpose, release_tier, ap_candidate_problems(item_index, problem_id, problem_version_id)").eq("ap_subject_code", subject).eq("is_current", true).eq("purpose", "mock_exam");
  if (error) throw new Error(error.message);
  const { data: usedRows } = await db.from("mock_exam_set_items").select("problem_id, mock_exam_sets!inner(status, exam_program)").eq("mock_exam_sets.exam_program", "ap").neq("mock_exam_sets.status", "archived");
  const used = new Set((usedRows ?? []).map((r) => r.problem_id as string));
  const pool: AssembleCandidate[] = (rows ?? []).flatMap((r) => ((r.ap_candidate_problems as { item_index: number; problem_id: string; problem_version_id: string }[]) ?? []).map((p) => ({
    candidateKey: r.candidate_key, problemId: p.problem_id, versionId: p.problem_version_id, kind: r.kind as "mc" | "frq_bundle", purpose: r.purpose as "mock_exam", releaseTier: r.release_tier,
    calculator: r.calculator, keywordCode: r.keyword_code, itemFamilyId: r.item_family_id, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", itemIndex: p.item_index,
  })));
  const mcTotal = apSectionLayout(subject).filter((x) => x.kind === "mc").reduce((a, x) => a + x.count, 0);
  const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${subject}.json`, "utf-8")) as ApCurriculumFile;
  const unitBounds = Object.fromEntries(cur.weights.filter((w) => w.axis === "unit" && w.section === "mc").map((w) => [w.code, { min: Math.ceil(((w.min ?? 0) / 100) * mcTotal), max: Math.floor(((w.max ?? 100) / 100) * mcTotal) }]));
  const opts: AssembleOptions = { maxOverlap: arg("max-overlap") !== undefined ? Number(arg("max-overlap")) : OVERLAP_DEFAULTS[label], ...(process.argv.includes("--no-composition") ? {} : { unitBounds }) };
  const plan = planApSet(subject, label, pool, used, opts);
  if (plan.compositionIssues.length || plan.diversityIssues.length) console.log(`구성/다양성 미충족: ${[...plan.compositionIssues, ...plan.diversityIssues].join(", ")}`);
  console.log(`풀 ${pool.length}건 → 선택 ${plan.items.length}건, 부족: ${plan.shortfall.map((s) => `${s.sectionKey} ${s.have}/${s.need}`).join(", ") || "없음"}`);
  if (!plan.ok) { console.log("공식 구조를 채우지 못해 세트를 만들지 않습니다(라벨 규칙)."); return; }
  if (!execute) { console.log("dry-run 종료."); return; }
  const layout = { sections: apSectionLayout(subject).filter((s) => plan.items.some((i) => i.sectionKey === s.key)) };
  const { data: set, error: se } = await db.from("mock_exam_sets").insert({ name, difficulty_tier: "standard", status: "draft", format: "ap_fixed", readiness_status: "not_applicable", exam_program: "ap", ap_subject: subject, ap_label: label, section_layout: layout }).select("id").single();
  if (se || !set) throw new Error(se?.message);
  for (const it of plan.items) {
    const { error: ie } = await db.from("mock_exam_set_items").insert({ exam_set_id: set.id, section: it.sectionKey, position: it.position, problem_id: it.c.problemId, problem_version_id: it.c.versionId, sat_domain: `ap:${it.c.keywordCode}`, difficulty: it.c.difficulty });
    if (ie) throw new Error(ie.message);
  }
  const { error: pe } = await db.from("mock_exam_sets").update({ status: "published", published_at: new Date().toISOString(), access_tier: tier }).eq("id", set.id);
  if (pe) throw new Error(pe.message);
  console.log(`세트 ${set.id} 공개(${label}, ${tier})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
