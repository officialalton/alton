// 2026-09-19 — 대학 진학 정보 DB Part 2: Part 1 소스 레지스트리 CSV를 universities 테이블에 적재.
// 소스: docs/2026-09-19-top200-us-universities-source-registry.csv (200개교, 라이브 검증 완료).
// 실행: npx tsx scripts/universities-seed.ts [--dry-run]
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

/** 아주 단순한 CSV 파서 — 이 레지스트리는 필드 안에 큰따옴표로 감싼 콤마 포함 텍스트가 있으므로 처리한다. */
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

type UniversityRow = {
  rank_final: number | null;
  name: string;
  country: string;
  city: string | null;
  state: string | null;
  public_private: string | null;
  application_platform: string | null;
  admissions_homepage_url: string | null;
  common_data_set_url: string | null;
  catalog_programs_url: string | null;
  deadlines_url: string | null;
  url_verification_status: string | null;
  rank_confidence: string | null;
};

function toUniversityRows(): UniversityRow[] {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(raw);
  const header = rows[0];
  const idx = (col: string) => header.indexOf(col);
  const iRank = idx("rank_final");
  const iName = idx("school_name");
  const iCity = idx("city");
  const iState = idx("state");
  const iType = idx("public_private");
  const iHome = idx("admissions_homepage_url");
  const iCds = idx("common_data_set_url");
  const iCatalog = idx("catalog_programs_url");
  const iDeadlines = idx("deadlines_url");
  const iVerify = idx("url_verification_status");
  const iConfidence = idx("rank_confidence");

  return rows.slice(1).map((r) => ({
    rank_final: r[iRank] ? Number(r[iRank]) : null,
    name: r[iName]?.trim() ?? "",
    country: "United States",
    city: r[iCity]?.trim() || null,
    state: r[iState]?.trim() || null,
    public_private: r[iType]?.trim() || null,
    application_platform: null, // Part 1 레지스트리에 없음 — 관리자가 개별 입력(V1 범위)
    admissions_homepage_url: r[iHome]?.trim() || null,
    common_data_set_url: r[iCds]?.trim() || null,
    catalog_programs_url: r[iCatalog]?.trim() || null,
    deadlines_url: r[iDeadlines]?.trim() || null,
    url_verification_status: r[iVerify]?.trim() || null,
    rank_confidence: r[iConfidence]?.trim() || null,
  }));
}

export { parseCsv, toUniversityRows };

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rows = toUniversityRows().filter((r) => r.name);
  console.log(`파싱된 대학 수: ${rows.length}`);

  if (dryRun) {
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.from("universities").upsert(rows, { onConflict: "name,country" });
  if (error) throw new Error(`대학 시드 삽입 실패: ${error.message}`);
  console.log(`${rows.length}개교 upsert 완료.`);
}

const isDirectRun = process.argv[1] && process.argv[1].includes("universities-seed");
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
