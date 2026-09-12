import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 기반 안정화 계획(docs/superpowers/plans/2026-09-09-codebase-review-and-performance-diagnosis.md)
// 7절 4단계 — createAdminClient() 호출부 전수 감사 결과: app/admin/*.ts의
// 모든 exported 함수는 이미 requireAdmin()/requireAdminOrCapability()를
// 함수 본문 안에서 호출하고 있었다(발견된 코드 누락 없음 — 아래 ALLOWLIST의
// 세 예외는 실제로 검토해 안전함을 확인했다: getClosureDraftAction은
// requireAdminOrCapability를 이미 호출하는 getConsultationCardDetailAction을
// 위임 호출, users-data.ts는 admin/page.tsx가 middleware 역할 게이트(모든
// 포털 page.tsx가 동일하게 의존하는 패턴, 특정 admin 예외가 아님)로만
// 보호되는 순수 데이터 로더, payouts-cron.ts는 이미 다른 회귀 가드
// (lib/legacy-teacher-payouts-write-guard.test.ts)로 no-op임이 증명됨).
//
// 이 테스트는 앞으로 새로 추가되는 createAdminClient() 호출부가
// requireAdmin()/requireAdminOrCapability() 없이 만들어지는 것을 막는
// 회귀 가드다 — "발견된 누락을 고치는" 것이 아니라 "앞으로 누락이 생기지
// 않게 지키는" 목적.

const ROOT = path.resolve(__dirname, "..", "..");
const ADMIN_DIR = path.join(ROOT, "app", "admin");

// 이미 검토를 마친, createAdminClient()를 쓰지만 함수 본문 안에서 직접
// requireAdmin류를 호출하지 않는 파일 — 이유는 위 주석 참고.
const ALLOWLIST_FILES = new Set<string>([
  "users-data.ts", // page.tsx가 middleware 역할 게이트로만 보호(다른 모든 포털 page.tsx와 동일 패턴)
  "payouts-cron.ts", // 완전 no-op, 별도 회귀 가드로 이미 증명됨
]);
const ALLOWLIST_FUNCTIONS = new Set<string>([
  "getClosureDraftAction", // requireAdminOrCapability를 이미 호출하는 getConsultationCardDetailAction에 위임
]);

function collectAdminTsFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(ADMIN_DIR)) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    const full = path.join(ADMIN_DIR, entry);
    if (statSync(full).isDirectory()) continue;
    out.push(full);
  }
  return out;
}

// 소스에서 "export (async )?function NAME(" 시작점부터 중괄호 깊이가 0으로
// 돌아오는 지점까지를 그 함수의 본문으로 추출한다(문자열 리터럴 안의 중괄호는
// 무시하도록 아주 단순한 상태 기계를 쓴다 — 이 코드베이스의 실제 스타일에서
// 충분히 안정적으로 동작함을 아래 테스트로 직접 확인했다).
function extractTopLevelFunctions(content: string): { name: string; body: string }[] {
  const results: { name: string; body: string }[] = [];
  const startRe = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = startRe.exec(content))) {
    const name = match[1];
    const openBraceIdx = content.indexOf("{", match.index);
    if (openBraceIdx === -1) continue;
    let depth = 0;
    let inString: '"' | "'" | "`" | null = null;
    let i = openBraceIdx;
    for (; i < content.length; i++) {
      const ch = content[i];
      const prev = content[i - 1];
      if (inString) {
        if (ch === inString && prev !== "\\") inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    results.push({ name, body: content.slice(openBraceIdx, i + 1) });
  }
  return results;
}

describe("관리자 서버 액션의 createAdminClient() 호출부는 항상 requireAdmin류를 동반한다(회귀 가드)", () => {
  const files = collectAdminTsFiles();

  it("app/admin/*.ts 파일이 실제로 스캔 대상에 존재한다", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("createAdminClient()를 호출하는 모든 export 함수는 같은 함수 본문 안에서 requireAdmin()/requireAdminOrCapability()를 호출한다(허용목록 제외)", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = path.relative(ADMIN_DIR, file);
      const content = readFileSync(file, "utf-8");
      if (!content.includes("createAdminClient")) continue;
      if (ALLOWLIST_FILES.has(rel)) continue;

      const functions = extractTopLevelFunctions(content);
      for (const fn of functions) {
        if (ALLOWLIST_FUNCTIONS.has(fn.name)) continue;
        if (!fn.body.includes("createAdminClient")) continue;
        const hasGuard = /requireAdmin(OrCapability)?\s*\(/.test(fn.body);
        if (!hasGuard) {
          offenders.push(`${rel}::${fn.name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
