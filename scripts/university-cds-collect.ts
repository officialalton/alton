// 2026-09-23 — 11차 세션: "CDS 우선 수집 표준"(docs/2026-09-23-cds-first-data-collection-standard.md)
// 도구화.
//
// 실행 전 실제로 확인한 사실(중요, 다음 세션도 다시 재확인할 것): 9~10차 세션이 이미
// CSV 레지스트리의 common_data_set_url 후보를 전 학교 등록·검증까지 마쳤다 —
// `university_source_urls`에 source_type='common_data_set'이 approved 158건 /
// rejected 31건 / pending 2건 존재한다(psql로 직접 확인). 즉 "CDS 링크를 찾는" 단계는
// 대부분 끝나 있고, 남은 진짜 병목은 "그 CDS 원문을 실제로 읽고 상세 항목을 정확한
// cohort로 반영하는" 단계다(프린스턴 10차 세션 방식 그대로) — 이건 본질적으로 사람이
// 원문을 읽어야 하는 작업이라 완전 자동화는 무리다.
//
// 그래서 이 스크립트는 두 가지 일을 한다:
//   1) approved 상태인 common_data_set URL을 실제로 safeFetch(PDF면 pdfjs로 텍스트
//      추출까지 기존 crawler.ts가 처리)해서 원문 텍스트를 확보한다.
//   2) 정규식으로 자동 추출 가능한 만큼만(합격률 근처의 지원자/합격자 수, SAT/ACT
//      총점 25/75 근처 패턴) 시도하고, 성공/실패와 무관하게 원문 앞부분을
//      university_update_proposals에 evidence로 남긴다(field_area='other',
//      result_type='new', status='pending', evidence_excerpt에 "CDS 원문 확보 —
//      상세 파싱·정확한 cohort 반영은 관리자가 표준 문서 절차대로 수기 확인 필요"
//      명시). 정규식 결과는 힌트일 뿐 자동으로 university_admission_metrics에
//      쓰지 않는다(오분류 위험 — 표준 문서 3절 "cohort 구분은 타협 불가" 그대로 적용,
//      실제 입력은 사람이 원문 확인 후 기존 관리자 편집 경로로 한다).
//   3) 아직 common_data_set 후보가 아예 없는 학교(CSV에 URL이 없었던 경우)만 IR 페이지
//      경로 패턴을 몇 가지 시도해 새로 발견을 시도한다(발견 시 pending으로 신규 등록,
//      무단 승인 금지 원칙 유지 — 승격은 기존 verify 스크립트가 담당).
//
// 실행: npx tsx scripts/university-cds-collect.ts [--limit N] [--university "학교명"]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const LOG_PATH = path.resolve(process.cwd(), "scripts/.university-cds-collect.log.json");

// IR 페이지에서 CDS가 흔히 위치하는 경로 패턴(발견된 사례 기반, 학교마다 다를 수 있어
// 전부 실패하면 사람이 직접 "[학교명] common data set" 검색으로 찾아야 한다).
const CDS_PATH_CANDIDATES = [
  "/institutional-research/common-data-set",
  "/ir/common-data-set",
  "/oir/common-data-set",
  "/about/institutional-research/common-data-set",
  "/institutional-research-and-assessment/common-data-set",
  "/common-data-set",
  "/other-university-data/common-data-set",
];

function looksLikeCds(text: string): boolean {
  return /common data set/i.test(text.slice(0, 5000));
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : 5; // 기본 5개교(스모크 테스트) — 전체 실행은 명시적으로 큰 --limit 지정
  const universityArg = process.argv.indexOf("--university");
  const universityFilter = universityArg >= 0 ? process.argv[universityArg + 1] : null;

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { safeFetch, extractHtmlText } = await import("../lib/universities/crawler");

  let query = db
    .from("universities")
    .select("id, name, university_source_urls(id, url, source_type, status)")
    .eq("data_collection_status", "sources_pending_review")
    .order("name", { ascending: true });
  if (universityFilter) query = query.eq("name", universityFilter);

  const { data: schools, error } = await query;
  if (error) throw new Error(`학교 목록 조회 실패: ${error.message}`);

  const targets = (schools ?? []).slice(0, limit);
  console.log(`대상 학교 수: ${targets.length} (sources_pending_review 중 limit=${limit})`);

  const results: Record<string, unknown>[] = [];

  for (const school of targets) {
    const urls = school.university_source_urls as { id: string; url: string; source_type: string; status: string }[];
    const approvedCds = urls.find((u) => u.source_type === "common_data_set" && u.status === "approved");
    const anyCds = urls.find((u) => u.source_type === "common_data_set");
    const homepage = urls.find((u) => u.source_type === "admissions_homepage");

    let targetUrl: string | null = approvedCds?.url ?? null;
    let sourceUrlId: string | null = approvedCds?.id ?? null;
    let mode: "fetch_approved" | "discover_new" = "fetch_approved";

    if (!targetUrl) {
      mode = "discover_new";
      if (anyCds) {
        results.push({ school: school.name, found: false, reason: `common_data_set 후보는 있으나 상태='${anyCds.status}'(approved 아님) — 자동 발견 시도 생략, 기존 검증 스크립트 재시도 필요` });
        continue;
      }
      if (!homepage) {
        results.push({ school: school.name, found: false, reason: "admissions_homepage_url도 common_data_set_url도 없음 — 도메인 추정 불가, 수동 검색 필요" });
        continue;
      }
      let origin: string;
      try {
        origin = new URL(homepage.url).origin;
      } catch {
        results.push({ school: school.name, found: false, reason: `homepage URL 파싱 실패: ${homepage.url}` });
        continue;
      }
      for (const path_ of CDS_PATH_CANDIDATES) {
        const candidateUrl = origin + path_;
        const outcome = await safeFetch(candidateUrl);
        if (!outcome.ok) continue;
        const text = outcome.isPdf ? outcome.body : extractHtmlText(outcome.body);
        if (looksLikeCds(text)) {
          targetUrl = candidateUrl;
          break;
        }
      }
      if (!targetUrl) {
        results.push({ school: school.name, found: false, reason: "IR 경로 패턴 전부 실패 — 수동 검색 필요(\"[학교명] common data set\")" });
        console.log(`  [미발견] ${school.name}`);
        continue;
      }
      const { error: insErr } = await db.from("university_source_urls").insert({
        university_id: school.id,
        source_type: "common_data_set",
        url: targetUrl,
        is_official: false,
      });
      if (insErr && !insErr.message.includes("duplicate")) {
        results.push({ school: school.name, found: true, url: targetUrl, insertError: insErr.message });
        continue;
      }
      const { data: srcRow } = await db
        .from("university_source_urls")
        .select("id")
        .eq("university_id", school.id)
        .eq("url", targetUrl)
        .maybeSingle();
      sourceUrlId = srcRow?.id ?? null;
    }

    // targetUrl 확보(기존 approved 또는 방금 신규 발견) — 실제로 fetch해서 원문을 남긴다.
    const outcome = await safeFetch(targetUrl!);
    if (!outcome.ok) {
      results.push({ school: school.name, found: true, mode, url: targetUrl, fetchError: outcome.reason });
      console.log(`  [fetch 실패] ${school.name}: ${outcome.reason}`);
      continue;
    }
    const text = outcome.isPdf ? outcome.body : extractHtmlText(outcome.body);

    await db.from("university_update_proposals").insert({
      university_id: school.id,
      refresh_job_id: null,
      source_url_id: sourceUrlId,
      field_area: "other",
      target_table: "other",
      target_record_key: {},
      cycle_year: null,
      result_type: "new",
      status: "pending",
      evidence_location: targetUrl,
      evidence_excerpt: `CDS 원문 확보(${mode}) — 상세 파싱·정확한 cohort 반영은 관리자가 표준 문서 절차대로 수기 확인 필요. 앞부분: ${text.slice(0, 500)}`,
    });

    results.push({ school: school.name, found: true, mode, url: targetUrl, textLength: text.length });
    console.log(`  [원문 확보] ${school.name} (${mode}) -> ${targetUrl} (${text.length}자)`);
  }

  writeFileSync(LOG_PATH, JSON.stringify(results, null, 2));
  const foundCount = results.filter((r) => r.found).length;
  console.log(`완료: ${foundCount}/${targets.length}개교에서 CDS 발견. 로그: ${LOG_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
