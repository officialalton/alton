import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P4-3 2단계 — 문서 접근 감사 기록의 보장을 DB에서 고정한다.
//   ① INSERT-only: 남긴 기록은 고칠 수도 지울 수도 없다.
//   ② 링크 발급과 실제 다운로드가 다른 값으로 남는다.
//   ③ 조회는 관리자만.
//   ④ 일반 사용자는 기록을 넣을 수 없다(서버 액션 service_role 전용).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    return (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
  }
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

function asUserExpectError(userId: string, sql: string): string {
  return psqlExpectError(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

function insertEvent(action: string, kind = "contract_artifact"): string {
  return psql(
    `insert into document_access_events (actor_id, target_kind, target_id, subject_id, action, detail)
     values ('${ADMIN_ID}', '${kind}', gen_random_uuid(), '${STUDENT_ID}', '${action}', '{"artifactType":"signed_document"}'::jsonb)
     returning id;`
  );
}

describe("document_access_events", () => {
  it("링크 발급과 실제 다운로드를 다른 값으로 남긴다", () => {
    const issued = insertEvent("download_url_issued");
    const completed = insertEvent("download_completed");
    expect(psql(`select action from document_access_events where id = '${issued}';`)).toBe(
      "download_url_issued"
    );
    expect(psql(`select action from document_access_events where id = '${completed}';`)).toBe(
      "download_completed"
    );
  });

  it("시작·완료·실패를 각각 남길 수 있다", () => {
    for (const action of ["download_started", "download_completed", "download_failed"]) {
      expect(insertEvent(action)).not.toBe("");
    }
  });

  it("알 수 없는 행위는 기록할 수 없다", () => {
    expect(psqlExpectError(
      `insert into document_access_events (actor_id, target_kind, target_id, action)
       values ('${ADMIN_ID}', 'contract_artifact', gen_random_uuid(), 'peeked');`
    )).toMatch(/check constraint|violates/i);
  });

  it("남긴 기록은 고칠 수도 지울 수도 없다(INSERT-only)", () => {
    const id = insertEvent("download_completed");
    expect(psqlExpectError(`update document_access_events set action = 'download_failed' where id = '${id}';`)).toMatch(
      /INSERT-only/
    );
    expect(psqlExpectError(`delete from document_access_events where id = '${id}';`)).toMatch(
      /INSERT-only/
    );
  });

  it("조회는 관리자만 — 교사·학생에게는 보이지 않는다", () => {
    insertEvent("download_completed");
    expect(Number(asUser(ADMIN_ID, "select count(*) from document_access_events;"))).toBeGreaterThan(0);
    expect(asUser(TEACHER_ID, "select count(*) from document_access_events;")).toBe("0");
    expect(asUser(STUDENT_ID, "select count(*) from document_access_events;")).toBe("0");
  });

  it("관리자라도 직접 기록을 넣을 수 없다(서버 액션 전용)", () => {
    expect(
      asUserExpectError(
        ADMIN_ID,
        `insert into document_access_events (actor_id, target_kind, target_id, action)
         values ('${ADMIN_ID}', 'contract_artifact', gen_random_uuid(), 'download_completed');`
      )
    ).toMatch(/permission denied|row-level security|policy/i);
  });

  it("계약과 교사 서류를 같은 표에서 구분해 담는다", () => {
    const contract = insertEvent("download_completed", "contract_artifact");
    const teacherDoc = insertEvent("download_url_issued", "teacher_document");
    expect(psql(`select target_kind from document_access_events where id = '${contract}';`)).toBe(
      "contract_artifact"
    );
    expect(psql(`select target_kind from document_access_events where id = '${teacherDoc}';`)).toBe(
      "teacher_document"
    );
  });
});
