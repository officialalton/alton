// 이전 적재 행 표식(삭제 없음). 기본 dry-run. 키 접두어가 아니라 created_at 구간과 기대 건수로 판정한다.
//   npx tsx scripts/ap-generation/mark-batches.ts --histogram                       # created_at 군집(5분 단위)로 경계 확인
//   npx tsx scripts/ap-generation/mark-batches.ts --cutoff 2026-10-08T12:00:00Z     # dry-run: 이전/현재 건수가 767/783 인지 확인
//   npx tsx scripts/ap-generation/mark-batches.ts --cutoff <ts> --execute           # 표식 적용(건수 불일치면 아무것도 바꾸지 않는다)
// 같은 일을 SQL 로: select * from ap_mark_load_batches('<cutoff>', 767, 783, false);  -- true 로 바꾸면 적용
import { connect } from "../keywords/db";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const EXPECT_PREV = Number(arg("--expect-previous") ?? 767); const EXPECT_CUR = Number(arg("--expect-current") ?? 783);
async function main() {
  const conn = await connect(); if (!conn) throw new Error("SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 필요");
  const { db, target } = conn; const execute = process.argv.includes("--execute");
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);
  if (process.argv.includes("--histogram")) { const { data, error } = await db.from("ap_candidate_load_histogram_v").select("*"); if (error) throw new Error(error.message); console.table(data); return; }
  const cutoff = arg("--cutoff"); if (!cutoff) throw new Error("--cutoff <timestamptz> 필요(먼저 --histogram 으로 경계 확인)");
  const { data, error } = await db.rpc("ap_mark_load_batches", { p_cutoff: cutoff, p_expect_previous: EXPECT_PREV, p_expect_current: EXPECT_CUR, p_apply: execute });
  if (error) throw new Error(error.message); console.log(data);
  const r = (data as { previous_rows: number; current_rows: number; applied: boolean; note: string }[])[0];
  if (r.previous_rows !== EXPECT_PREV || r.current_rows !== EXPECT_CUR) { console.error(`기대(${EXPECT_PREV}/${EXPECT_CUR})와 다름 — 경계를 다시 확인하세요(변경 없음).`); process.exit(2); }
}
main().catch((e) => { console.error(e); process.exit(1); });
