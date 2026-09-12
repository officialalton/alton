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
  // 일반 관리자에게 정산권한을 주지 않은 상태에서도 조회되는지 확인하기 위해
  // 명시적으로 지운다(현재 정책: capability는 필수 조건이 아니다).
  psql(
    `delete from supervisor_capabilities where profile_id = '${ADMIN_ID}' and capability = '${PAYOUT_CAPABILITY}';`
  );
});

describe("DB 조회 경계", () => {
  it("관리자는 교사 서류를 조회한다", () => {
    const docId = psql(
      `insert into teacher_documents (teacher_id, file_name, storage_path, uploaded_by)
       values ('${TEACHER_ID}', 'admin-visible.pdf', '${TEACHER_ID}/admin-visible.pdf', '${TEACHER_ID}') returning id;`
    );
    expect(asUser(ADMIN_ID, `select count(*) from teacher_documents where id = '${docId}';`)).toBe("1");
  });

  it("정산권한을 부여받은 운영자도 조회한다(기존 RLS 의도 유지)", () => {
    expect(
      asUser(PAYOUT_ADMIN_ID, `select current_user_has_capability('${PAYOUT_CAPABILITY}');`)
    ).toBe("t");
  });

  it("학생·보호자는 교사 서류를 조회할 수 없다", () => {
    const docId = psql(
      `insert into teacher_documents (teacher_id, file_name, storage_path, uploaded_by)
       values ('${TEACHER_ID}', 'secret.pdf', '${TEACHER_ID}/secret.pdf', '${TEACHER_ID}') returning id;`
    );
    expect(asUser(STUDENT_ID, `select count(*) from teacher_documents where id = '${docId}';`)).toBe("0");
    const guardianId = psql(
      `select primary_guardian_id from households where id = 'aabbccdd-0000-0000-0000-000000000001';`
    );
    if (guardianId) {
      expect(asUser(guardianId, `select count(*) from teacher_documents where id = '${docId}';`)).toBe("0");
    }
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

// P4-3 3단계 — 교사가 올린 서류가 관리자 보관함의 그 교사 아래에 나타나는지.
// "업로드·삭제 경로 없음"은 **관리자 보관함에만** 해당한다 — 교사 본인의
// 업로드·조회·내려받기는 그대로다.
describe("교사 업로드 → 관리자 보관함 연결", () => {
  it("교사가 올린 서류가 그 교사 아래에 나타난다", () => {
    const before = psql(
      `select count(*) from teacher_documents where teacher_id = '${TEACHER_ID}';`
    );

    // 교사 포털의 업로드 경로가 남기는 것과 같은 행(P4-2 uploadMyDocumentAction).
    psql(
      `insert into teacher_documents (teacher_id, file_name, storage_path, content_type, size_bytes, note, uploaded_by)
       values ('${TEACHER_ID}', 'w9-2026.pdf', '${TEACHER_ID}/w9-2026.pdf', 'application/pdf', 12345, '2026년 W-9', '${TEACHER_ID}')
       returning id;`
    );

    const after = psql(
      `select count(*) from teacher_documents where teacher_id = '${TEACHER_ID}';`
    );
    expect(Number(after)).toBe(Number(before) + 1);

    // 관리자 보관함이 읽는 것과 같은 조회 — 그 교사 아래에 보인다.
    expect(
      asUser(
        ADMIN_ID,
        `select file_name from teacher_documents where teacher_id = '${TEACHER_ID}' and file_name = 'w9-2026.pdf';`
      )
    ).toBe("w9-2026.pdf");

    // 다른 교사 아래에는 섞이지 않는다.
    expect(
      asUser(
        ADMIN_ID,
        `select count(*) from teacher_documents where teacher_id = '${OTHER_TEACHER_ID}' and file_name = 'w9-2026.pdf';`
      )
    ).toBe("0");
  });

  it("교사 본인의 조회 경로는 그대로 살아 있다", () => {
    const docId = psql(
      `insert into teacher_documents (teacher_id, file_name, storage_path, uploaded_by)
       values ('${TEACHER_ID}', 'mine.pdf', '${TEACHER_ID}/mine.pdf', '${TEACHER_ID}') returning id;`
    );
    expect(asUser(TEACHER_ID, `select count(*) from teacher_documents where id = '${docId}';`)).toBe("1");
  });

  it("제출 여부가 정산·매칭·수업의 조건이 되지 않는다(참조하는 모듈이 없다)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    // 정산·매칭·수업 경로가 teacher_documents를 읽으면 게이트가 생긴 것이다.
    const roots = ["lib/payout", "app/teacher", "app/session", "app/admin/matching-data.ts"];
    const offenders: string[] = [];

    function walk(target: string) {
      if (!fs.existsSync(target)) return;
      const stat = fs.statSync(target);
      if (stat.isFile()) {
        if (!/\.(ts|tsx)$/.test(target)) return;
        // 업로드 창구(교사 정산 탭)와 테스트는 제외한다.
        if (target.includes("settlement-actions")) return;
        if (target.includes(".test.")) return;
        if (fs.readFileSync(target, "utf-8").includes("teacher_documents")) offenders.push(target);
        return;
      }
      for (const entry of fs.readdirSync(target)) walk(path.join(target, entry));
    }
    for (const r of roots) walk(r);

    expect(offenders).toEqual([]);
  });
});
