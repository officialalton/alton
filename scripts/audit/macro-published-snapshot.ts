// AP Macroeconomics Practice Exam 1·2 게시본 스냅샷(SELECT 전용 — 연결된 비프로덕션 프로젝트에 `supabase db query --linked` 로 SELECT 만 보낸다). 새 버전 교체 계획(macro-new-version-plans.ts)과 그 검증 테스트의 입력.
//   npx tsx scripts/audit/macro-published-snapshot.ts [--out data/ap/stock/macro-ma1-ma2-published-slots.json]
// 기록: 시험별 게시본(이름·버전·상태)과 칸(섹션·위치·후보 키), 모든 매크로 후보의 DB keyword_code(관리자 새 버전 검사의 단원 출처)와 변환 완료 여부(미리보기 조건과 같다), 다른 시험 계열에서 쓰이는 문항.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
function q<T>(sql: string): T[] {
  if (!/^\s*select\b/i.test(sql)) throw new Error("SELECT 만 허용");
  const r = spawnSync("npx", ["supabase", "db", "query", "--linked", sql], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`쿼리 실패: ${(r.stderr || "").slice(-300)}`);
  return (JSON.parse(r.stdout) as { rows: T[] }).rows;
}
const main = () => {
  const sets = q<{ id: string; name: string; set_group_id: string; version_no: number; status: string; access_tier: string; ap_label: string }>("select id, name, set_group_id, version_no, status, access_tier, ap_label from mock_exam_sets where exam_program = 'ap' and ap_subject = 'ap_macroeconomics' order by name, version_no");
  const out: Record<string, unknown> = { generatedAt: new Date().toISOString(), note: "SELECT 전용 조회(supabase db query --linked)", sets };
  const pub = sets.filter((s) => s.status === "published" && s.ap_label === "full_practice");
  const keys = new Set<string>();
  for (const s of pub) {
    const tag = /Practice Exam 1\b/.test(s.name) ? "MA1" : /Practice Exam 2\b/.test(s.name) ? "MA2" : s.name;
    const slots = q<{ section: string; position: number; candidate_key: string | null }>(`select i.section, i.position, p.ap_candidate_key as candidate_key from mock_exam_set_items i join problems p on p.id = i.problem_id where i.exam_set_id = '${s.id}' order by i.section, i.position`).map((x) => ({ section: x.section, position: x.position, candidateKey: x.candidate_key }));
    slots.forEach((x) => x.candidateKey && keys.add(x.candidateKey));
    out[tag] = { sourceSetId: s.id, sourceSetName: s.name, sourceVersionNo: s.version_no, accessTier: s.access_tier, setGroupId: s.set_group_id, slots };
  }
  const cand = q<{ candidate_key: string; keyword_code: string | null; purpose: string | null; release_tier: string | null; review_env_ready: boolean | null; is_current: boolean | null; kind: string | null }>("select candidate_key, keyword_code, purpose, release_tier, review_env_ready, is_current, kind from ap_candidate_items where ap_subject_code = 'ap_macroeconomics' order by candidate_key");
  const probs = q<{ ap_candidate_key: string; ok: boolean }>("select ap_candidate_key, (status = 'confirmed' and archived_at is null and published_version_id is not null and usage_scope in ('mock_exam', 'both')) as ok from problems where ap_candidate_key like 'macro%'");
  const okProb = new Map<string, boolean>(); for (const p of probs) okProb.set(p.ap_candidate_key, (okProb.get(p.ap_candidate_key) ?? true) && p.ok);
  out.convertedKeys = cand.filter((x) => x.purpose === "mock_exam" && ["review_env", "launch"].includes(x.release_tier ?? "") && x.review_env_ready === true && x.is_current !== false && okProb.get(x.candidate_key) === true).map((x) => x.candidate_key);
  out.dbKeywordCodes = Object.fromEntries(cand.map((x) => [x.candidate_key, x.keyword_code]));
  const used = q<{ set_group_id: string; candidate_key: string }>("select distinct s.set_group_id, p.ap_candidate_key as candidate_key from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id join problems p on p.id = i.problem_id where s.ap_subject = 'ap_macroeconomics' and s.status in ('draft', 'published') and p.ap_candidate_key is not null");
  const g: Record<string, string[]> = {}; for (const u of used) (g[u.set_group_id] ??= []).push(u.candidate_key);
  out.usedByGroup = g;
  writeFileSync(arg("--out", "data/ap/stock/macro-ma1-ma2-published-slots.json"), JSON.stringify(out, null, 1));
  console.log(`sets ${sets.length} (published full_practice: ${pub.map((s) => `${s.name} v${s.version_no}`).join("; ")}), 후보 ${cand.length}, 변환 완료 ${(out.convertedKeys as string[]).length}, 게시 키 ${keys.size}`);
};
main();
