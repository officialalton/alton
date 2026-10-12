// 읽기 전용 적재 점검 — 비프로덕션(worpsqwqgnspddnrtnvq)에서 통과 키 파일별로 DB 적재·검증 상태를 센다. 아무것도 쓰지 않는다.
//   npx tsx scripts/ap-generation/check-load.ts [--write-verified <경로>]
// 환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 만 사용(값은 출력하지 않는다). 대상이 비프로덕션이 아니면 중단.
// --write-verified: review_env_ready 인 현재(is_current) 후보 키를 JSON 배열 파일로 저장(조립 입력, 스크래치 경로 권장).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const EXPECT = "worpsqwqgnspddnrtnvq";
const SD = "data/ap/stock";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수가 필요합니다.");
  if (!url.includes(EXPECT)) throw new Error(`대상이 비프로덕션(${EXPECT})이 아닙니다. 중단.`);
  console.log(`대상: ${EXPECT}.supabase.co / READ-ONLY`);
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const rows: { candidate_key: string; review_state: string; render_verified: boolean; screen_verified: boolean; review_env_ready: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("ap_item_review_status_v").select("candidate_key, review_state, render_verified, screen_verified, review_env_ready").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const byKey = new Map(rows.map((r) => [r.candidate_key, r]));
  console.log(`DB 후보 행(뷰) ${rows.length}건`);

  const files = readdirSync(SD).filter((f) => /^(graph-s.*|supp-b.*)-pass-keys\.json$/.test(f) || f === "v1v45-siblings-keys.json").sort();
  let totalKeys = 0, totalReady = 0, bad = 0;
  console.log("\n파일 | 통과 키 | DB 적재 | 렌더 | 화면 | review_env_ready");
  for (const f of files) {
    const raw = JSON.parse(readFileSync(path.join(SD, f), "utf-8"));
    const keys: string[] = Array.isArray(raw) ? raw : raw.keys ?? [];
    const got = keys.map((k) => byKey.get(k)).filter(Boolean) as typeof rows;
    const n = (p: (r: (typeof rows)[number]) => boolean) => got.filter(p).length;
    const ready = n((r) => r.review_env_ready);
    totalKeys += keys.length; totalReady += ready; if (ready !== keys.length) bad++;
    console.log(`${f.padEnd(34)} | ${String(keys.length).padStart(3)} | ${String(got.length).padStart(3)} | ${String(n((r) => r.render_verified)).padStart(3)} | ${String(n((r) => r.screen_verified)).padStart(3)} | ${String(ready).padStart(3)}${ready === keys.length ? "" : "  ← 부족"}`);
  }
  console.log(`\n합계: 통과 키 ${totalKeys} 중 review_env_ready ${totalReady} (기대 140 + 보강 중 겹침 없음). 부족한 파일 ${bad}개.`);
  const out = arg("write-verified");
  if (out) {
    const ready = rows.filter((r) => r.review_env_ready).map((r) => r.candidate_key).sort();
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(path.resolve(out), JSON.stringify(ready, null, 1));
    console.log(`review_env_ready ${ready.length}건을 ${out} 에 저장했습니다.`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
