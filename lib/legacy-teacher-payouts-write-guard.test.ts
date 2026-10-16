import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// R10 corrective(요구사항 3, 2026-09-07 제품 오너 리뷰) — 레거시
// teacher_payouts 테이블에 대한 쓰기(INSERT/UPDATE/UPSERT/DELETE) 경로가
// 코드베이스 전체에 하나도 남아있지 않은지 정적으로 검사하는 회귀 가드.
// v3 payout_batches(payout-batches-actions.ts)가 정산 배치 생성/승인/실패
// 처리를 전담하고, teacher_payouts는 R13 전까지 읽기 전용으로만 남는다.
//
// 이 테스트는 소스 트리를 grep해 `.from("teacher_payouts")...insert/update/
// upsert/delete(` 패턴을 찾는다. 새 write 경로가 추가되면 이 테스트가 실패해
// 리뷰에서 걸러진다. 허용 목록(ALLOWLIST)은 의도적으로 비어 있다 — 쓰기가
// 필요하면 이 테스트를 고치기 전에 왜 레거시 테이블에 다시 써야 하는지부터
// 확인해야 한다.

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "lib", "supabase/migrations"];
const IGNORE_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

// 이 파일 자체와, "쓰지 않음"을 증명하는 테스트/주석 파일들은 문자열
// "teacher_payouts"를 언급하지만 실제 쓰기 코드가 아니므로 스캔에서 제외한다.
const ALLOWLIST_FILES = new Set<string>([
  "lib/legacy-teacher-payouts-write-guard.test.ts",
  "app/admin/payouts-cron.ts", // no-op: 계산만 하고 teacher_payouts에 접근하지 않음(아래 별도 검증)
  "app/admin/payouts-cron.test.ts",
  "app/admin/payouts-actions.ts", // 전부 throw만 하는 disabled 스텁(아래 별도 검증)
  "app/admin/payouts-actions.test.ts",
  "app/admin/payouts-data.ts", // select만 함(아래 별도 검증)
  "app/admin/payouts-data.test.ts",
  "app/admin/PayoutBatchesTab.tsx",
  "app/api/cron/generate-payouts/route.ts",
  "app/api/cron/generate-payouts/route.test.ts",
]);

function collectFiles(dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, out);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry)) || entry.endsWith(".sql")) {
      out.push(full);
    }
  }
}

// teacher_payouts에 대한 쓰기로 볼 수 있는 패턴: Supabase 클라이언트의
// .from("teacher_payouts")... 뒤에 insert/update/upsert/delete가 오는 경우,
// 또는 raw SQL의 insert/update/delete into|from teacher_payouts.
const SUPABASE_WRITE_RE =
  /\.from\(\s*["'`]teacher_payouts["'`]\s*\)[\s\S]{0,120}?\.(insert|update|upsert|delete)\s*\(/;
const SQL_WRITE_RE =
  /\b(insert\s+into|update|delete\s+from)\s+(public\.)?teacher_payouts\b/i;

describe("레거시 teacher_payouts 쓰기 경로 제거 (R10 corrective 요구사항 3)", () => {
  it("app/lib/migrations 전체에 teacher_payouts에 대한 write 경로가 없다(허용목록 제외)", () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) {
      collectFiles(path.join(ROOT, dir), files);
    }
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      if (ALLOWLIST_FILES.has(rel)) continue;
      if (!rel.includes("teacher_payouts") && rel.endsWith(".sql")) {
        // SQL 마이그레이션은 전부 스캔(과거 initial_schema/RLS 파일은 테이블
        // 정의·정책이지 write가 아니므로 정규식 자체가 걸리지 않는다).
      }
      const content = readFileSync(file, "utf-8");
      if (!content.includes("teacher_payouts")) continue;
      if (SUPABASE_WRITE_RE.test(content) || SQL_WRITE_RE.test(content)) {
        offenders.push(rel);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("payouts-cron.ts는 teacher_payouts에 대한 select/insert/update/upsert/delete 호출이 전혀 없다(완전 no-op)", () => {
    const content = readFileSync(path.join(ROOT, "app/admin/payouts-cron.ts"), "utf-8");
    expect(content.includes(".from(")).toBe(false);
    expect(/\.(select|insert|update|upsert|delete)\s*\(/.test(content)).toBe(false);
  });

  it("payouts-actions.ts의 모든 export는 throw만 한다(레거시 서버 액션 완전 비활성화)", () => {
    const content = readFileSync(path.join(ROOT, "app/admin/payouts-actions.ts"), "utf-8");
    // .from(...)이나 .insert(/.update(/.upsert( 호출이 전혀 없어야 한다 —
    // requireAdmin() 뒤 곧바로 throw하는 스텁 구조만 허용.
    expect(content.includes(".from(")).toBe(false);
    expect(/\.(insert|update|upsert|delete)\s*\(/.test(content)).toBe(false);
  });

  it("payouts-data.ts는 teacher_payouts를 select로만 읽는다(쓰기 없음)", () => {
    const content = readFileSync(path.join(ROOT, "app/admin/payouts-data.ts"), "utf-8");
    expect(SUPABASE_WRITE_RE.test(content)).toBe(false);
  });
});
