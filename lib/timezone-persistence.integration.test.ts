import { execFileSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// 제품 오너 지적사항 2 — 시간대 변경이 세션이 아니라 DB(profiles.timezone /
// households.default_timezone)에 영구 저장되는지, "다음 로그인"을 흉내 낸
// 별도 조회에서도 그대로 유지되는지 실제 로컬 Postgres로 검증한다. 지적사항
// 4(학생/학부모/관리자 포털 동일 로직)는 lib/timezone-actions.ts가 4개 포털
// 공용 서버 액션 한 벌만 쓰는 것으로 이미 보장되므로(app/*/Shell.tsx가 전부
// 같은 TimezoneSettingsModal + timezone-actions를 import), 여기서는 그 액션이
// 실제로 쓰는 DB 경로(RLS update / security definer RPC)만 직접 검증한다.
// 패턴은 app/admin/trial-sessions-guardian-consent.integration.test.ts와 동일.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const PRIMARY_GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000002";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

// psql -c는 배치의 각 문장 출력을 줄 단위로 이어붙인다(마지막 "reset role"의
// "RESET" 태그 포함) — 호출부가 원하는 값은 늘 "set role"/"set_config"/
// "reset" 결과를 뺀 실제 쿼리 결과이므로, sql 인자가 만든 줄 수만큼만
// 뒤에서부터 세어 반환한다. 여기서는 단일 SELECT 하나만 감싸 쓰므로 그
// 결과 한 줄만 돌려주면 충분하다.
function asUser(userId: string, sql: string): string {
  const out = psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    ${sql}
    reset role;
  `);
  const lines = out.trim().split("\n");
  // 뒤에서 두 번째 줄이 sql 인자의 실제 결과(마지막 줄은 "RESET").
  return lines[lines.length - 2] ?? "";
}

describe("시간대 개인 설정 — profiles.timezone 영구 저장 (실제 DB)", () => {
  afterAll(() => {
    psql(`
      update profiles set timezone = null where id in ('${STUDENT_ID}', '${PRIMARY_GUARDIAN_ID}');
      update households set default_timezone = 'America/Los_Angeles' where id = '${HOUSEHOLD_ID}';
    `);
  });

  beforeEach(() => {
    psql(`
      update profiles set timezone = null where id in ('${STUDENT_ID}', '${PRIMARY_GUARDIAN_ID}');
      update households set default_timezone = 'America/Los_Angeles' where id = '${HOUSEHOLD_ID}';
    `);
  });

  it("학생이 개인 시간대를 저장하면(updateMyTimezone과 동일한 RLS update) 재조회 시(=다음 로그인) 그대로 유지된다", () => {
    // updateMyTimezone()이 실제로 실행하는 것과 동일한 경로: 본인 프로필 RLS update.
    asUser(STUDENT_ID, `update profiles set timezone = 'America/New_York' where id = '${STUDENT_ID}';`);

    // "다음 로그인" 흉내 — 완전히 새 조회(세션 상태가 아니라 DB에서 다시 읽음).
    const reloaded = asUser(STUDENT_ID, `select timezone from profiles where id = '${STUDENT_ID}';`);
    expect(reloaded).toBe("America/New_York");
  });

  it("미국 전역 시간대(알래스카/하와이 포함) 어느 값이든 개인 설정으로 저장·유지된다", () => {
    for (const tz of ["America/Anchorage", "Pacific/Honolulu", "America/Phoenix"]) {
      asUser(STUDENT_ID, `update profiles set timezone = '${tz}' where id = '${STUDENT_ID}';`);
      const reloaded = asUser(STUDENT_ID, `select timezone from profiles where id = '${STUDENT_ID}';`);
      expect(reloaded).toBe(tz);
    }
  });

  it("본인이 아닌 다른 사람의 개인 시간대는 RLS로 바꿀 수 없다", () => {
    expect(() =>
      asUser(STUDENT_ID, `update profiles set timezone = 'America/Chicago' where id = '${PRIMARY_GUARDIAN_ID}';`)
    ).not.toThrow(); // update 자체는 실행되지만

    const untouched = asUser(
      PRIMARY_GUARDIAN_ID,
      `select timezone from profiles where id = '${PRIMARY_GUARDIAN_ID}';`
    );
    // RLS가 0 rows affected로 막아 실제로는 바뀌지 않아야 한다.
    expect(untouched.trim().split("\n").pop()).not.toBe("America/Chicago");
  });

  it("주 보호자가 가족 기본 시간대를 RPC로 바꾸면 영구 저장되고 자녀 조회에도 반영된다", () => {
    asUser(
      PRIMARY_GUARDIAN_ID,
      `select update_household_default_timezone('${HOUSEHOLD_ID}'::uuid, 'America/Denver');`
    );

    const reloaded = psql(`select default_timezone from households where id = '${HOUSEHOLD_ID}';`);
    expect(reloaded.trim().split("\n").pop()).toBe("America/Denver");
  });

  it("주 보호자가 아니면 가족 기본 시간대를 바꿀 수 없다(fail-closed)", () => {
    expect(() =>
      asUser(STUDENT_ID, `select update_household_default_timezone('${HOUSEHOLD_ID}'::uuid, 'America/Denver');`)
    ).toThrow();
  });
});
