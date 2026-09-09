import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 배치 1-2 corrective(20261251000000/20261253000000) — bypass_teacher_rate_protect
// GUC를 status_transition_tokens 1회용 토큰으로 교체한 뒤의 회귀 테스트. psql
// shell-out 패턴은 이 저장소의 다른 통합 테스트(trial-session-completion-link 등)와
// 동일 — 파일 전용 선생님을 매번 새로 만들어 레이스를 피한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function lastLine(output: string): string {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines[lines.length - 1]?.trim() ?? "";
}

function createTestTeacher(label: string): string {
  const now = Date.now();
  const teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'rate-token-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '토큰테스트 선생님(${label})');`);
  return teacherId;
}

describe("protect_teacher_rate_history() / set_teacher_rate() — status_transition_tokens 1회용 토큰(corrective 회귀)", () => {
  it("① 정상 호출 — 기존 이력 종료 + 새 이력 INSERT + teachers.hourly_rate_krw 동기화가 함께 일어난다", () => {
    const teacherId = createTestTeacher("normal-change");
    const firstId = lastLine(
      psql(`select set_teacher_rate('${teacherId}', 2000000, 'KRW', now() - interval '2 days');`)
    );
    psql(`insert into teachers (id, status) values ('${teacherId}', 'pending');`);

    const secondId = lastLine(
      psql(`select set_teacher_rate('${teacherId}', 3500000, 'KRW', now() - interval '1 day');`)
    );

    const firstClosed = psql(`select effective_until is not null from teacher_rate_history where id = '${firstId}';`);
    expect(firstClosed).toBe("t");

    const secondRow = psql(
      `select amount_minor, effective_until is null from teacher_rate_history where id = '${secondId}';`
    );
    expect(secondRow).toBe("3500000|t");

    const hourlyRate = psql(`select hourly_rate_krw from teachers where id = '${teacherId}';`);
    expect(hourlyRate).toBe("3500000");
  });

  it("② effective_until만 노린 직접 UPDATE를 토큰 없이 시도하면 거부된다(방식 a였다면 통과했을 케이스)", () => {
    const teacherId = createTestTeacher("direct-update-block");
    const currentId = lastLine(
      psql(`select set_teacher_rate('${teacherId}', 2500000, 'KRW', now() - interval '1 day');`)
    );

    expect(() =>
      psql(`update teacher_rate_history set effective_until = now() where id = '${currentId}';`)
    ).toThrow(/직접 UPDATE할 수 없습니다/);

    const stillOpen = psql(`select effective_until is null from teacher_rate_history where id = '${currentId}';`);
    expect(stillOpen).toBe("t");
  });

  it("③ 예전 GUC(app.bypass_teacher_rate_protect)를 직접 SET해도 새 설계에는 아무 효과가 없다", () => {
    const teacherId = createTestTeacher("legacy-guc-noop");
    const currentId = lastLine(
      psql(`select set_teacher_rate('${teacherId}', 2500000, 'KRW', now() - interval '1 day');`)
    );

    expect(() =>
      psql(`
        set app.bypass_teacher_rate_protect = 'true';
        update teacher_rate_history set effective_until = now() where id = '${currentId}';
      `)
    ).toThrow(/직접 UPDATE할 수 없습니다/);

    const stillOpen = psql(`select effective_until is null from teacher_rate_history where id = '${currentId}';`);
    expect(stillOpen).toBe("t");
  });

  it("④ 새 이력 INSERT 실패 시 트랜잭션 전체가 롤백된다(기존 이력이 종료된 채 새 이력 없이 남지 않음)", () => {
    const teacherId = createTestTeacher("atomicity");
    const currentId = lastLine(
      psql(`select set_teacher_rate('${teacherId}', 2500000, 'KRW', now() - interval '1 day');`)
    );

    // 새 이력 INSERT를 강제로 실패시키는 임시 트리거(테스트 종료 시 정리).
    psql(`
      create or replace function force_teacher_rate_insert_failure_for_test()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced insert failure for atomicity test';
      end;
      $$;
    `);
    psql(`
      create trigger force_teacher_rate_insert_failure
        before insert on teacher_rate_history
        for each row execute function force_teacher_rate_insert_failure_for_test();
    `);

    try {
      expect(() =>
        psql(`select set_teacher_rate('${teacherId}', 4000000, 'KRW', now());`)
      ).toThrow(/forced insert failure/);

      const stillOpen = psql(`select effective_until is null from teacher_rate_history where id = '${currentId}';`);
      expect(stillOpen).toBe("t");
      const tokenCount = psql(
        `select count(*) from status_transition_tokens where table_name = 'teacher_rate_history' and row_id = '${currentId}';`
      );
      expect(tokenCount).toBe("0");
    } finally {
      psql(`drop trigger if exists force_teacher_rate_insert_failure on teacher_rate_history;`);
      psql(`drop function if exists force_teacher_rate_insert_failure_for_test();`);
    }
  });
});
