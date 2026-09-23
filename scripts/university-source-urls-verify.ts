// 2026-09-23 — 200개교 확대 세션 Part 2: pending 상태 출처 URL을 실제로 safeFetch로
// 방문해 (a) 200 응답 (b) 본문/타이틀이 그 학교 이름·도메인과 일치하는지 확인한다.
// 성공한 것만 status='approved', is_official=true로 승격한다(무단 승인 절대 금지).
// 실패/불일치는 status를 'rejected'(영구 실패류)로 바꾸거나 'pending'으로 남기고
// review_note에 사유를 기록한다(재시도 여지가 있는 실패는 pending 유지).
//
// robots.txt 준수, 도메인당 polite delay는 lib/universities/crawler.ts의 safeFetch가
// 이미 보장한다(재사용, 새 fetch 로직 작성 안 함).
//
// 실행: npx tsx scripts/university-source-urls-verify.ts [--limit N]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const LOG_PATH = path.resolve(process.cwd(), "scripts/.university-source-urls-verify.log.json");

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** 학교 이름의 핵심 단어(3글자 이상, 불용어 제외)가 본문에 등장하는지로 "같은 학교" 여부를 추정한다.
 * 완벽한 검증은 아니다(사람의 최종 확인을 대체하지 않음) — 명백한 오류(전혀 다른 학교로 연결)만 걸러낸다. */
function looksLikeSameSchool(schoolName: string, bodyText: string, url: string): boolean {
  const stop = new Set(["university", "college", "of", "the", "at", "institute", "technology", "state"]);
  const words = schoolName
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter((w) => w.length >= 3 && !stop.has(w.toLowerCase()));
  if (words.length === 0) return true; // 이름이 전부 불용어인 극단적 경우는 통과(사람이 재검토)
  const normBody = normalizeForMatch(bodyText.slice(0, 20000));
  const normUrl = normalizeForMatch(url);
  const hitInBody = words.some((w) => normBody.includes(normalizeForMatch(w)));
  const hitInUrl = words.some((w) => normUrl.includes(normalizeForMatch(w)));
  return hitInBody || hitInUrl;
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { safeFetch, extractHtmlText } = await import("../lib/universities/crawler");

  const { data: pending, error } = await db
    .from("university_source_urls")
    .select("id, university_id, url, source_type, universities(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`pending 조회 실패: ${error.message}`);

  const todo = (pending ?? []).slice(0, Number.isFinite(limit) ? limit : undefined);
  console.log(`검증 대상: ${todo.length}건 (전체 pending ${pending?.length ?? 0}건 중)`);

  let approved = 0;
  let rejected = 0;
  let stillPending = 0;
  const results: { school: string; url: string; outcome: string; reason?: string }[] = [];

  for (const [i, row] of todo.entries()) {
    const schoolName = (row as unknown as { universities: { name: string } }).universities?.name ?? "?";
    process.stdout.write(`[${i + 1}/${todo.length}] ${schoolName} — ${row.url} ... `);
    try {
      const outcome = await safeFetch(row.url);
      if (!outcome.ok) {
        // SSRF/robots/스킴 차단, 파싱 실패 등은 영구적 실패로 보고 rejected.
        // 일시적일 수 있는 네트워크 오류(타임아웃 등)는 재시도 여지를 남겨 pending 유지.
        const isTransient = /타임아웃|요청 실패/.test(outcome.reason);
        const nextStatus = isTransient ? "pending" : "rejected";
        await db.from("university_source_urls").update({
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          review_note: `자동 검증 실패(2026-09-23): ${outcome.reason}`,
        }).eq("id", row.id);
        if (nextStatus === "rejected") rejected++; else stillPending++;
        console.log(`실패 — ${outcome.reason}`);
        results.push({ school: schoolName, url: row.url, outcome: nextStatus, reason: outcome.reason });
        continue;
      }
      const text = outcome.isPdf ? outcome.body : extractHtmlText(outcome.body);
      const match = looksLikeSameSchool(schoolName, text, row.url);
      if (!match) {
        await db.from("university_source_urls").update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          review_note: `자동 검증(2026-09-23): 200 응답이나 본문/URL에서 학교명 불일치 — 오배정 의심.`,
        }).eq("id", row.id);
        rejected++;
        console.log(`거절 — 200이나 학교명 불일치`);
        results.push({ school: schoolName, url: row.url, outcome: "rejected", reason: "학교명 불일치" });
        continue;
      }
      await db.from("university_source_urls").update({
        status: "approved",
        is_official: true,
        reviewed_at: new Date().toISOString(),
        review_note: `자동 검증 통과(2026-09-23): 200 응답 + 본문/URL에서 학교명 일치 확인.`,
      }).eq("id", row.id);
      approved++;
      console.log(`승인`);
      results.push({ school: schoolName, url: row.url, outcome: "approved" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`예외 — ${message}`);
      results.push({ school: schoolName, url: row.url, outcome: "error", reason: message });
      stillPending++;
    }
  }

  console.log(`\n완료: approved=${approved}, rejected=${rejected}, pending 유지=${stillPending}`);
  writeFileSync(LOG_PATH, JSON.stringify(results, null, 2));
  console.log(`상세 로그: ${LOG_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
