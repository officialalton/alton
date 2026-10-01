import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P4-2 — 교사 정산 관련 RLS 실측 검증.
// 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
// 확인 대상:
//  (1) 교사는 본인 payout_items/payout_batches만 읽고 타 교사 행은 못 읽는다
//      (기존 R10 RLS — 교사 정산 화면이 이 정책에만 의존하므로 회귀를 못박는다).
//  (2) 교사는 본인 수취 계좌·변경 이력·제출 서류만 읽는다.
//  (3) 교사는 계좌·서류를 클라이언트에서 직접 쓸 수 없다(서버 액션 전용).
//  (4) teacher_payout_account_events는 INSERT-only.
//  (5) teacher_documents에는 승인·검토 상태 컬럼이 없다 — 게이트로 쓸 수 없는 구조.

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
      stdio: ["pipe", "pipe", "pipe"],
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

function createTeacher(label: string): string {
  const email = `p4-2-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '정산교사${label}');`);
  // teachers.status='active'는 유효한 시급 이력을 요구한다(enforce_teacher_active_requires_rate).
  // 이 스펙은 RLS만 보므로 pending으로 만든다 — 정산 RLS는 teachers.status와 무관하다.
  psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  return id;
}

function createPayoutRow(teacherId: string, amount: number): string {
  return psql(
    `insert into payout_items (teacher_id, item_type, hourly_rate_snapshot_minor, currency, payable_minutes, amount_minor, status)
     values ('${teacherId}', 'regular', 50000, 'KRW', 60, ${amount}, 'pending') returning id;`
  );
}

function createAccount(teacherId: string, last4: string): void {
  psql(
    `insert into teacher_payout_accounts (teacher_id, account_holder_name, bank_name, account_number, account_number_last4, currency, updated_by)
     values ('${teacherId}', '예금주', '국민은행', '110-123-${last4}', '${last4}', 'KRW', '${teacherId}');`
  );
}

describe("payout_items / payout_batches — 교사 본인 행만", () => {
  it("교사는 본인 정산 항목만 읽고 타 교사 항목은 보이지 않는다", () => {
    const mine = createTeacher("own");
    const other = createTeacher("other");
    const myItem = createPayoutRow(mine, 11111);
    const otherItem = createPayoutRow(other, 22222);

    const visible = asUser(mine, `select id from payout_items where id in ('${myItem}', '${otherItem}');`)
      .split("\n")
      .filter(Boolean);
    expect(visible).toEqual([myItem]);
  });

  it("교사는 정산 항목을 직접 쓸 수 없다(금액 조작 불가)", () => {
    const teacher = createTeacher("nowrite");
    const itemId = createPayoutRow(teacher, 5000);
    // 쓰기 정책이 없으면 Postgres는 오류 대신 "0행 영향"으로 조용히 끝난다 —
    // 그래서 오류 메시지가 아니라 값이 그대로인지를 확인한다.
    asUser(teacher, `update payout_items set amount_minor = 999999 where id = '${itemId}';`);
    expect(psql(`select amount_minor from payout_items where id = '${itemId}';`)).toBe("5000");
  });
});

describe("teacher_payout_accounts — 본인만 조회, 클라이언트 쓰기 불가", () => {
  it("본인 계좌만 조회되고 타 교사 계좌는 보이지 않는다", () => {
    const mine = createTeacher("acct-own");
    const other = createTeacher("acct-other");
    createAccount(mine, "1111");
    createAccount(other, "2222");

    const visible = asUser(
      mine,
      `select account_number_last4 from teacher_payout_accounts where teacher_id in ('${mine}', '${other}');`
    )
      .split("\n")
      .filter(Boolean);
    expect(visible).toEqual(["1111"]);
  });

  it("교사가 클라이언트에서 직접 계좌를 쓰면 거부된다(서버 액션 전용)", () => {
    const teacher = createTeacher("acct-write");
    const stderr = asUserExpectError(
      teacher,
      `insert into teacher_payout_accounts (teacher_id, account_holder_name, bank_name, account_number, account_number_last4)
       values ('${teacher}', 'x', 'y', '123456', '3456');`
    );
    expect(stderr).toMatch(/row-level security|policy|permission denied/i);
    expect(psql(`select count(*) from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("0");
  });

  it("변경 이력은 INSERT-only다", () => {
    const teacher = createTeacher("acct-events");
    const eventId = psql(
      `insert into teacher_payout_account_events (teacher_id, action, actor_id, changed_fields, new_last4)
       values ('${teacher}', 'created', '${teacher}', '{account_number}', '9999') returning id;`
    );
    expect(() =>
      psql(`update teacher_payout_account_events set action = 'updated' where id = '${eventId}';`)
    ).toThrow(/INSERT-only/);
    expect(() => psql(`delete from teacher_payout_account_events where id = '${eventId}';`)).toThrow(
      /INSERT-only/
    );
  });
});

describe("teacher_documents — 보관 창구 전용", () => {
  it("본인 서류만 조회된다", () => {
    const mine = createTeacher("doc-own");
    const other = createTeacher("doc-other");
    psql(
      `insert into teacher_documents (teacher_id, file_name, storage_path, uploaded_by)
       values ('${mine}', 'mine.pdf', '${mine}/mine.pdf', '${mine}'),
              ('${other}', 'other.pdf', '${other}/other.pdf', '${other}');`
    );

    const visible = asUser(mine, `select file_name from teacher_documents where teacher_id in ('${mine}', '${other}');`)
      .split("\n")
      .filter(Boolean);
    expect(visible).toEqual(["mine.pdf"]);
  });

  it("승인·검토·보완 상태 컬럼이 존재하지 않는다 — 업무 게이트로 쓸 수 없는 구조다", () => {
    const columns = psql(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'teacher_documents';`
    ).split("\n");
    for (const forbidden of ["status", "review_status", "approved_at", "approved_by", "reviewed_at"]) {
      expect(columns).not.toContain(forbidden);
    }
  });
});
