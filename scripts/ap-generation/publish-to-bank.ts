// AP 후보 → 문제은행(검수 환경) 변환 실행. 기본 dry-run, --execute 는 **로컬 DB 에서만**(비프로덕션 원격·프로덕션은 총괄이 따로).
//   npx tsx scripts/ap-generation/publish-to-bank.ts --purpose mock_exam --limit 5            # 계획만
//   npx tsx scripts/ap-generation/publish-to-bank.ts --purpose lesson --keys a,b --execute    # 로컬 변환
// 변환 대상 = is_current AND review_env_ready(자동 게이트 통과 + 렌더 검증 + 학생 화면 검증) AND 미변환. 용도는 후보당 하나, 변환 때 고정.
import { connect } from "../keywords/db";
import { convertCandidate, type CandidateRow } from "../../lib/ap-exam/convert-run";
import { planConversion } from "../../lib/ap-exam/convert";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
async function main() {
  const purpose = arg("purpose");
  if (purpose !== "mock_exam" && purpose !== "lesson") throw new Error("--purpose mock_exam|lesson 은 필수입니다(후보당 용도는 하나, 공유 없음).");
  const execute = process.argv.includes("--execute");
  const conn = await connect();
  if (!conn) throw new Error("DB 환경변수가 없습니다.");
  if (execute && conn.target !== "local") throw new Error(`--execute 는 로컬 DB 에서만 허용됩니다(대상: ${conn.target}). 원격 비프로덕션 적용은 총괄 세션이 한다.`);
  const keys = arg("keys")?.split(",");
  let q = conn.db.from("ap_candidate_items").select("candidate_key, ap_subject_code, kind, keyword_code, difficulty_provisional, payload, review_state").eq("is_current", true).eq("review_env_ready", true).is("purpose", null).is("problem_id", null);
  if (keys) q = q.in("candidate_key", keys);
  const { data, error } = await q.limit(Number(arg("limit") ?? 50));
  if (error) throw new Error(error.message);
  const { data: admin } = await conn.db.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  console.log(`대상 ${data?.length ?? 0}건 · 용도 ${purpose} · ${execute ? "EXECUTE(local)" : "dry-run"} · DB ${conn.target}`);
  for (const r of data ?? []) {
    const cand: CandidateRow = { candidateKey: r.candidate_key, apSubjectCode: r.ap_subject_code, kind: r.kind, payload: r.payload, keywordCode: r.keyword_code, difficultyProvisional: r.difficulty_provisional };
    const plan = planConversion(cand);
    if (!plan.ok) { console.log(`- ${r.candidate_key}: 건너뜀 (${plan.reason})`); continue; }
    if (!execute) { console.log(`- ${r.candidate_key}: 변환 가능 (${plan.items.length}문항, ${plan.items[0].format})`); continue; }
    if (!admin) throw new Error("관리자 프로필이 없습니다.");
    const res = await convertCandidate(conn.db as never, cand, purpose, admin.id);
    console.log(`- ${r.candidate_key}: ${res.status}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
