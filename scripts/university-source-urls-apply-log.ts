// 2026-09-23 — 로컬 supabase DB가 이 세션 도중 다른 프로세스(같은 docker 프로젝트를
// 공유하는 별도 작업 디렉터리)에 의해 여러 차례 재기동/리셋되어 university-source-urls-verify.ts
// 실행 결과(실제 safeFetch 검증, scripts/.university-source-urls-verify.log.json)가 DB에서
// 유실되는 일이 반복됐다. 이 스크립트는 그 로그(이미 실제로 일어난 검증 이벤트의 기록)를
// 다시 fetch하지 않고 그대로 university_source_urls에 재적용한다 — 중복 실제 HTTP 요청을
// 피하면서(외부 사이트에 불필요하게 재요청하지 않음, robots/polite delay 정책 존중) 검증
// 결과만 영속화한다. 재검증을 대체하는 것이 아니라 "이미 검증된 결과의 재기록"이다.
//
// 실행: npx tsx scripts/university-source-urls-apply-log.ts
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type LogEntry = { school: string; url: string; outcome: string; reason?: string };

async function main() {
  const logPath = path.resolve(process.cwd(), "scripts/.university-source-urls-verify.log.json");
  const entries: LogEntry[] = JSON.parse(readFileSync(logPath, "utf-8"));

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: universities } = await db.from("universities").select("id, name, data_collection_status");
  const byName = new Map(universities!.map((u) => [u.name, u]));

  let approved = 0;
  let rejected = 0;
  let stillPending = 0;
  let missing = 0;

  for (const e of entries) {
    const uni = byName.get(e.school);
    if (!uni) {
      missing++;
      continue;
    }
    const { data: row } = await db
      .from("university_source_urls")
      .select("id")
      .eq("university_id", uni.id)
      .eq("url", e.url)
      .maybeSingle();
    if (!row) {
      missing++;
      continue;
    }
    if (e.outcome === "approved") {
      await db.from("university_source_urls").update({
        status: "approved",
        is_official: true,
        reviewed_at: new Date().toISOString(),
        review_note: "자동 검증 통과(2026-09-23, 로그 재적용 — 원 검증은 실제 safeFetch로 수행됨).",
      }).eq("id", row.id);
      approved++;
    } else if (e.outcome === "rejected") {
      await db.from("university_source_urls").update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        review_note: `자동 검증 실패(2026-09-23, 로그 재적용): ${e.reason ?? ""}`,
      }).eq("id", row.id);
      rejected++;
    } else {
      stillPending++;
    }
  }

  console.log(`재적용 완료: approved=${approved}, rejected=${rejected}, pending 유지=${stillPending}, 매칭실패=${missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
