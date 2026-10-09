// 지금(오픈 전) 외부 검수자 계정에 표시를 붙인다: auth.users.raw_app_meta_data.external_reviewer = true.
// 스키마 변경 없음 — app_metadata 는 서비스 키/관리자 API 로만 쓸 수 있어 사용자가 직접 바꿀 수 없다.
// 기본 dry-run. 반영은 공유 비프로덕션에 쓰기이므로 총괄 승인 후 --apply.
//   SOURCE_SUPABASE_URL=... SOURCE_SUPABASE_SECRET_KEY=... npx tsx scripts/prod-launch/mark-reviewers.ts --emails reviewers.txt [--cohort 2026-10] [--apply]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const url = process.env.SOURCE_SUPABASE_URL, key = process.env.SOURCE_SUPABASE_SECRET_KEY;
const file = arg("--emails");
if (!url || !key || !file) { console.error("SOURCE_SUPABASE_URL / SOURCE_SUPABASE_SECRET_KEY / --emails 필요"); process.exit(2); }
const apply = process.argv.includes("--apply");
const cohort = arg("--cohort") ?? "2026-10";
const wanted = new Set(readFileSync(file, "utf-8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log(`${new URL(url!).host} / ${apply ? "APPLY" : "dry-run"} / 대상 이메일 ${wanted.size}개`);
  const found = new Map<string, any>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const usr of data.users) if (usr.email && wanted.has(usr.email.toLowerCase())) found.set(usr.email.toLowerCase(), usr);
    if (data.users.length < 200) break;
  }
  for (const e of wanted) if (!found.has(e)) console.warn(`  없음: ${e}`);
  let changed = 0;
  for (const [e, usr] of found) {
    const already = usr.app_metadata?.external_reviewer === true;
    console.log(`  ${already ? "이미 표시" : "표시 대상"}: ${e}`);
    if (already || !apply) continue;
    const { error } = await db.auth.admin.updateUserById(usr.id, { app_metadata: { ...usr.app_metadata, external_reviewer: true, reviewer_cohort: cohort } });
    if (error) throw error;
    changed++;
  }
  console.log(apply ? `반영 ${changed}명` : "dry-run — 변경 없음");
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
