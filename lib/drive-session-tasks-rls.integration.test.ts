import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-17(보안 결함 수정 — advisor 발견) — session_drive_tasks는 Drive 폴더 생성·권한
// 부여/회수 처리를 위한 내부 작업 큐이고, 코드 전체에서 service_role(createAdminClient)
// 로만 접근한다(학생·교사·관리자 어떤 화면도 이 테이블을 직접 읽지 않는다). RLS가
// 꺼져 있으면 anon/authenticated 키로 누구나 모든 행(Drive file id·권한 부여 대상
// 이메일 등)을 읽고 쓸 수 있었다. RLS를 켜고 anon/authenticated에는 아무 정책도
// 주지 않는(=전면 차단) 방식으로 막았는지 실제로 DB에 대고 확인한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

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
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

describe("session_drive_tasks — RLS 활성화(보안 결함 수정)", () => {
  it("RLS가 켜져 있다", () => {
    const enabled = psql(`select relrowsecurity from pg_class where relname = 'session_drive_tasks';`);
    expect(enabled).toBe("t");
  });

  it("anon 키로는 어떤 행도 삽입할 수 없다", () => {
    const stderr = psqlExpectError(`
      set role anon;
      insert into session_drive_tasks (session_id, task_type) values (gen_random_uuid(), 'folder_provision');
      reset role;
    `);
    expect(stderr).toContain("row-level security");
  });

  it("authenticated 키로는 어떤 행도 조회되지 않는다(정책 없음 = 전면 차단)", () => {
    // service_role로 실제 행 하나를 만들어(워커가 하는 것과 동일) 데이터 자체는
    // 있는 상태에서, authenticated로는 여전히 하나도 안 보이는지 확인한다.
    const sessionId = psql(`select id from sessions limit 1;`);
    if (sessionId) {
      psql(`insert into session_drive_tasks (session_id, task_type) values ('${sessionId}', 'folder_provision');`);
    }
    const visibleCount = psql(`
      set role authenticated;
      select count(*) from session_drive_tasks;
      reset role;
    `);
    expect(visibleCount).toBe("0");
  });

  it("authenticated 키로는 UPDATE/DELETE도 아무 행에 영향을 주지 못한다", () => {
    const result = psql(`
      set role authenticated;
      update session_drive_tasks set status = 'succeeded';
      reset role;
    `);
    // psql -t -A로 UPDATE 결과 자체는 안 나오지만, 이후 service_role로 봤을 때
    // succeeded로 바뀐 행이 없어야 한다(=변경이 전혀 반영되지 않음).
    void result;
    const succeededCount = psql(`select count(*) from session_drive_tasks where status = 'succeeded';`);
    expect(succeededCount).toBe("0");
  });
});
