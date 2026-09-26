// 2026-09-23 — 200개교 확대(지시서 E 이후 세션) Part 1: Part 1 소스 레지스트리 CSV에서
// 후보 URL을 추출해 university_source_urls에 status='pending'으로 등록한다.
// 무단 승인 금지 원칙: 여기서는 절대 'approved'/is_official=true를 쓰지 않는다 —
// 실제 fetch 검증(university-source-urls-verify.ts)을 통과한 것만 승격한다.
//
// 실행: npx tsx scripts/university-source-urls-bulk-register.ts [--dry-run]
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const CSV_PATH = path.resolve(process.cwd(), "docs/2026-09-19-top200-us-universities-source-registry.csv");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

const isHttpUrl = (v: string | undefined | null): v is string => !!v && /^https?:\/\//i.test(v.trim());

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(raw);
  const header = rows[0];
  const idx = (col: string) => header.indexOf(col);
  const iName = idx("school_name");
  const iHome = idx("admissions_homepage_url");
  const iCds = idx("common_data_set_url");
  const iCatalog = idx("catalog_programs_url");
  const iDeadlines = idx("deadlines_url");

  const candidates = rows.slice(1).map((r) => ({
    name: r[iName]?.trim() ?? "",
    admissions_homepage_url: r[iHome]?.trim() || null,
    common_data_set_url: r[iCds]?.trim() || null,
    catalog_programs_url: r[iCatalog]?.trim() || null,
    deadlines_url: r[iDeadlines]?.trim() || null,
  })).filter((r) => r.name);

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: universities, error: uErr } = await db
    .from("universities")
    .select("id, name, data_collection_status");
  if (uErr) throw new Error(`universities 조회 실패: ${uErr.message}`);

  const byName = new Map(universities!.map((u) => [u.name, u]));

  let registeredUrls = 0;
  let skippedSchools = 0;
  const skippedSchoolNames: string[] = [];

  for (const c of candidates) {
    const uni = byName.get(c.name);
    if (!uni) {
      skippedSchools++;
      skippedSchoolNames.push(c.name);
      continue;
    }
    // 이미 verified_pilot(10개교 파일럿)인 학교는 건드리지 않는다 — 파일럿 전용 상태 유지.
    if (uni.data_collection_status === "verified_pilot") continue;

    const toInsert: { source_type: string; url: string }[] = [];
    if (isHttpUrl(c.admissions_homepage_url)) toInsert.push({ source_type: "admissions_homepage", url: c.admissions_homepage_url });
    if (isHttpUrl(c.common_data_set_url)) toInsert.push({ source_type: "common_data_set", url: c.common_data_set_url });
    if (isHttpUrl(c.catalog_programs_url)) toInsert.push({ source_type: "catalog_programs", url: c.catalog_programs_url });
    if (isHttpUrl(c.deadlines_url)) toInsert.push({ source_type: "deadlines", url: c.deadlines_url });

    if (toInsert.length === 0) continue;

    for (const item of toInsert) {
      // 같은 대학·유형·URL로 이미 등록된 게 있으면 중복 삽입하지 않는다(재실행 안전).
      const { data: existing } = await db
        .from("university_source_urls")
        .select("id")
        .eq("university_id", uni.id)
        .eq("source_type", item.source_type)
        .eq("url", item.url)
        .maybeSingle();
      if (existing) continue;

      if (dryRun) {
        registeredUrls++;
        continue;
      }
      const { error: insErr } = await db.from("university_source_urls").insert({
        university_id: uni.id,
        url: item.url,
        source_type: item.source_type,
        is_official: false, // 검증 전이므로 공식 표시하지 않음 — 승격은 verify 스크립트에서만.
        status: "pending",
        review_note: "200개교 확대 세션(2026-09-23) — Part 1 소스 레지스트리 CSV에서 후보 URL 자동 등록, 미검증 상태.",
      });
      if (insErr) {
        console.error(`  삽입 실패: ${c.name} / ${item.source_type} — ${insErr.message}`);
        continue;
      }
      registeredUrls++;
    }
  }

  console.log(`후보 URL 등록: ${registeredUrls}건${dryRun ? " (dry-run, 실제 삽입 없음)" : ""}`);
  console.log(`universities 테이블에서 이름 매칭 실패한 학교: ${skippedSchools}개`);
  if (skippedSchoolNames.length) console.log(skippedSchoolNames.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
