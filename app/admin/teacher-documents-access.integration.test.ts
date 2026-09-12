import { execFileSync } from "node:child_process";
import { describe, expect, it, beforeAll } from "vitest";

// P4-3 3단계 — 교사 제출 서류는 **정산 담당 관리자만** 연다.
//
// 관리자 조회는 service_role로 하므로 RLS가 막아주지 않는다. 실질적인 통제는
// 앱 게이트(requireCapabilityOnly) 하나뿐이라, 여기서는 그 게이트가 기대는
// DB 판정(current_user_has_capability)이 역할을 우회로로 삼지 않는지 확인한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const PAYOUT_CAPABILITY = "정산권한";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

// profiles.id는 auth.users를 참조하므로 새 계정을 만들지 않고, 시드에 있는
// 계정에 권한만 붙여 판정을 확인한다. 여기서 보려는 것은 "역할이 아니라
// capability가 통과를 결정하는가"이지 특정 계정이 아니다.
const PAYOUT_ADMIN_ID = OTHER_TEACHER_ID;

beforeAll(() => {
  psql(
    `insert into supervisor_capabilities (profile_id, capability) values ('${PAYOUT_ADMIN_ID}', '${PAYOUT_CAPABILITY}')
     on conflict do nothing;`
  );
  // 일반 관리자에게는 정산권한을 주지 않는다 — 역할만으로 통과하지 못하는지 본다.
  psql(
    `delete from supervisor_capabilities where profile_id = '${ADMIN_ID}' and capability = '${PAYOUT_CAPABILITY}';`
  );
});

describe("정산 담당 관리자 전용 게이트", () => {
  it("정산권한을 부여받은 사람은 통과한다", () => {
    expect(
      asUser(PAYOUT_ADMIN_ID, `select current_user_has_capability('${PAYOUT_CAPABILITY}');`)
    ).toBe("t");
  });

  it("일반 관리자는 역할만으로 통과하지 못한다", () => {
    // role='admin'이지만 정산권한이 없다 — 이 판정은 false여야 한다.
    expect(psql(`select role from profiles where id = '${ADMIN_ID}';`)).toBe("admin");
    expect(asUser(ADMIN_ID, `select current_user_has_capability('${PAYOUT_CAPABILITY}');`)).toBe("f");
  });

  it("권한을 부여받지 않은 교사는 통과하지 못한다", () => {
    expect(asUser(TEACHER_ID, `select current_user_has_capability('${PAYOUT_CAPABILITY}');`)).toBe("f");
  });
});

describe("교사 본인 경로는 그대로 동작한다", () => {
  it("교사는 자기 서류를 계속 조회한다", () => {
    const docId = psql(
      `insert into teacher_documents (teacher_id, file_name, storage_path, uploaded_by)
       values ('${TEACHER_ID}', 'w9.pdf', '${TEACHER_ID}/w9.pdf', '${TEACHER_ID}') returning id;`
    );
    expect(
      asUser(TEACHER_ID, `select count(*) from teacher_documents where id = '${docId}';`)
    ).toBe("1");
    // 권한 없는 제3자에게는 보이지 않는다(위 PAYOUT_ADMIN_ID는 정산권한을
    // 부여받았으므로 여기서 쓰지 않는다 — 그 계정이 보이는 것이 정상이다).
    expect(
      asUser(STUDENT_ID, `select count(*) from teacher_documents where id = '${docId}';`)
    ).toBe("0");
  });
});

describe("승인·검토 상태를 만들지 않는다(게이트가 될 수 없는 구조 유지)", () => {
  it("teacher_documents에 승인·검토 컬럼이 없다", () => {
    const cols = psql(
      `select string_agg(column_name, ',') from information_schema.columns
       where table_name = 'teacher_documents';`
    );
    for (const banned of ["status", "review_status", "approved_at", "approved_by", "reviewed_at"]) {
      expect(cols.split(",")).not.toContain(banned);
    }
  });
});
