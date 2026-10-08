// AP 샘플 후보 → 비프로덕션 DB 적재(총괄 실행용). 기본 dry-run, --execute 때만 쓴다. 멱등(candidate_key upsert).
//   npx tsx scripts/ap-generation/import-candidates.ts --run run1               # 계획만
//   npx tsx scripts/ap-generation/import-candidates.ts --run run1 --execute     # 적재(마이그레이션 380·381·AP 커리큘럼 시드가 먼저 적용돼 있어야 함)
// 후보는 ap_candidate_items(학생 비노출)에만 들어가며 problems/problem_versions 는 건드리지 않는다. 전부 pending_expert_review/rejected/candidate 상태.
import { readFileSync } from "node:fs";
import path from "node:path";
import { connect } from "../keywords/db";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const run = arg("--run") ?? "run1";
const execute = process.argv.includes("--execute");
type Cand = { candidateKey: string; cellId: string; apSubjectCode: string; kind: string; keywordCode: string; unitCode: string; skillPrimary: string; structure: string; calculator: string; reviewState: string; reserve: boolean; rejectionReason: string | null; difficultyProvisional: string | null; difficultyRationale: string | null; payload: Record<string, unknown>; verification: unknown; review: unknown; difficulty: unknown };

async function main() {
  const file = path.resolve(process.cwd(), `data/ap/sample-2027/${run}/candidates.json`);
  const cands = JSON.parse(readFileSync(file, "utf-8")) as Cand[];
  const by = cands.reduce<Record<string, number>>((m, c) => ((m[c.reviewState] = (m[c.reviewState] ?? 0) + 1), m), {});
  console.log(`후보 ${cands.length}건`, by);
  const conn = await connect();
  if (!conn) { console.log("DB 환경변수가 없어 파일 요약만 출력합니다."); return; }
  const { db, target } = conn;
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);
  if (execute && !/^(local|worpsqwqgnspddnrtnvq\.supabase\.co)$/.test(target)) throw new Error(`허용되지 않은 대상 ${target}`);
  const { data: subs, error } = await db.from("subjects").select("id, ap_subject_code").not("ap_subject_code", "is", null);
  if (error) throw new Error(error.message);
  const sid = new Map((subs ?? []).map((s) => [s.ap_subject_code as string, s.id as string]));
  const missing = [...new Set(cands.map((c) => c.apSubjectCode))].filter((c) => !sid.has(c));
  if (missing.length) throw new Error(`AP 과목 행이 없습니다(커리큘럼 시드 먼저): ${missing.join(", ")}`);
  const rows = cands.map((c) => ({
    candidate_key: c.candidateKey, run_id: run, subject_id: sid.get(c.apSubjectCode), ap_subject_code: c.apSubjectCode, kind: c.kind === "mc" ? "mc" : "frq_bundle",
    keyword_code: c.keywordCode, skill_primary: c.skillPrimary, structure: c.structure,
    response_mode: c.kind === "mc" ? "select" : "explain", scoring_mode: c.kind === "mc" ? "exact" : "partial",
    difficulty_provisional: c.difficultyProvisional, difficulty_rationale: c.difficultyRationale,
    payload: { ...c.payload, cellId: c.cellId, reserve: c.reserve, calculator: c.calculator, unitCode: c.unitCode }, verification: c.verification ?? {}, review: { review: c.review, difficulty: c.difficulty },
    review_state: c.reviewState, rejection_reason: c.rejectionReason,
  }));
  if (!execute) { console.log("dry-run: upsert 예정", rows.length, "행(ap_candidate_items)"); return; }
  for (let i = 0; i < rows.length; i += 50) {
    const { error: e } = await db.from("ap_candidate_items").upsert(rows.slice(i, i + 50), { onConflict: "candidate_key" });
    if (e) throw new Error(e.message);
  }
  console.log("적재 완료", rows.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
