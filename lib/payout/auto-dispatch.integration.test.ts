import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P4-2 — 지급 예정일 저장 / 자동 송금 대상 선별 / 외부 송금 완료 기록의 DB 검증.
//
// 핵심: 게이트가 닫힌 환경에서 **자동 송금이 상태를 바꾸거나 송금을 시도한 것처럼
// 기록하면 안 된다**. 대상 조회(list_due_auto_dispatch_batches)는 읽기 전용이고,
// 실제 dispatch는 real_disbursement_enabled() 뒤에 있다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const HOURLY_RATE_MINOR = 60000;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createTeacher(label: string): string {
  const email = `p4-2d-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '정산교사${label}');`);
  psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  psql(`select set_teacher_rate('${id}'::uuid, ${HOURLY_RATE_MINOR}, 'KRW', now() - interval '2 years');`);
  return id;
}

function createApprovedBatch(label: string, dateIso: string): { teacher: string; batchId: string } {
  const teacher = createTeacher(label);
  const lessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const subjectId = "eeeeeeee-0000-0000-0000-000000000001";
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-2d-child-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${childId}', 'student', '학생');`);
  psql(`insert into students (id, status) values ('${childId}', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${subjectId}', '${contractId}', 'active') returning id;`
  );
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${teacher}', '${dateIso}T10:00:00Z', '${dateIso}T11:00:00Z', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, payable_minutes)
     values ('${reservationId}', '${enrollmentId}', '${teacher}', '${lessonTypeId}', 60, 'completed', 60) returning id;`
  );
  psql(`select upsert_session_payout_item('${sessionId}');`);
  const month = dateIso.slice(0, 7);
  const lastDay = psql(`select (date_trunc('month', '${dateIso}'::date) + interval '1 month' - interval '1 day')::date;`);
  psql(`select * from close_payout_period('${month}-01', '${lastDay}');`);
  const batchId = psql(`select id from payout_batches where teacher_id = '${teacher}' and period_start = '${month}-01';`);
  psql(`select approve_payout_batch('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);
  return { teacher, batchId };
}

describe("next_scheduled_payout_date() — 10일 03:00 UTC 경계", () => {
  it("그 달 10일 03:00 UTC 이전 승인은 그 달 10일, 이후는 다음 달 10일이다", () => {
    const row = psql(
      `select next_scheduled_payout_date('2026-09-01T00:00:00Z'::timestamptz),
              next_scheduled_payout_date('2026-09-10T02:59:59Z'::timestamptz),
              next_scheduled_payout_date('2026-09-10T03:00:01Z'::timestamptz),
              next_scheduled_payout_date('2026-12-20T00:00:00Z'::timestamptz);`
    ).split("|");
    expect(row).toEqual(["2026-09-10", "2026-09-10", "2026-10-10", "2027-01-10"]);
  });
});

describe("승인 시 지급 예정일 저장", () => {
  it("승인하면 예정일이 묶음에 저장되고 이력이 남는다(화면 계산값이 아니다)", () => {
    const { batchId } = createApprovedBatch("sched", "2026-05-10");
    const stored = psql(`select scheduled_payout_date is not null from payout_batches where id = '${batchId}';`);
    expect(stored).toBe("t");
    expect(
      psql(`select count(*) from payout_scheduled_date_events where batch_id = '${batchId}' and source = 'approval';`)
    ).toBe("1");
  });

  it("관리자가 예정일을 바꾸면 전후 날짜·사유·처리자가 이력에 남는다", () => {
    const { batchId } = createApprovedBatch("change", "2026-06-10");
    const before = psql(`select scheduled_payout_date from payout_batches where id = '${batchId}';`);

    psql(`select set_payout_batch_scheduled_date('${batchId}'::uuid, '2027-03-10', '은행 점검으로 연기', '${ADMIN_ID}'::uuid);`);

    expect(psql(`select scheduled_payout_date from payout_batches where id = '${batchId}';`)).toBe("2027-03-10");
    const row = psql(
      `select previous_date, new_date, reason, actor_id is not null from payout_scheduled_date_events
       where batch_id = '${batchId}'::uuid and source = 'admin_change';`
    );
    expect(row).toBe(`${before}|2027-03-10|은행 점검으로 연기|t`);
  });

  it("사유 없이는 예정일을 바꿀 수 없다", () => {
    const { batchId } = createApprovedBatch("noreason", "2026-07-10");
    expect(() => psql(`select set_payout_batch_scheduled_date('${batchId}'::uuid, '2027-01-10', ' ', '${ADMIN_ID}'::uuid);`)).toThrow(
      /변경 사유/
    );
  });
});

describe("list_due_auto_dispatch_batches() — 자동 송금 대상 선별", () => {
  it("승인 + 자동 송금 켜짐 + 예정일 도래를 모두 만족할 때만 대상이다", () => {
    const { batchId } = createApprovedBatch("due", "2026-08-10");
    psql(`update payout_batches set scheduled_payout_date = '2026-09-10' where id = '${batchId}';`);

    // 예정일 전날에는 대상이 아니다.
    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-09-09') where batch_id = '${batchId}';`)).toBe("0");
    // 예정일 당일부터 대상이다.
    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-09-10') where batch_id = '${batchId}';`)).toBe("1");
  });

  it("묶음별 자동 송금을 끄면 예정일이 와도 대상에서 빠진다", () => {
    const { batchId } = createApprovedBatch("optout", "2026-09-10");
    psql(`update payout_batches set scheduled_payout_date = '2026-10-10' where id = '${batchId}';`);
    psql(`select set_payout_batch_auto_dispatch('${batchId}'::uuid, false, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-10-10') where batch_id = '${batchId}';`)).toBe("0");
  });

  it("전역 스위치를 끄면 모든 묶음이 대상에서 빠진다", () => {
    const { batchId } = createApprovedBatch("globaloff", "2026-10-10");
    psql(`update payout_batches set scheduled_payout_date = '2026-11-10' where id = '${batchId}';`);
    psql(`select set_auto_dispatch_enabled(false, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-11-10');`)).toBe("0");

    psql(`select set_auto_dispatch_enabled(true, '${ADMIN_ID}'::uuid);`);
    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-11-10') where batch_id = '${batchId}';`)).toBe("1");
  });

  it("승인되지 않은 묶음은 예정일을 넣어도 대상이 되지 않는다", () => {
    const teacher = createTeacher("not-approved");
    const batchId = psql(
      `insert into payout_batches (teacher_id, period_start, period_end, currency, status, scheduled_payout_date)
       values ('${teacher}', '2026-03-01', '2026-03-31', 'KRW', 'reviewed', '2026-04-10') returning id;`
    );
    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-04-10') where batch_id = '${batchId}';`)).toBe("0");
  });

  it("지급 완료된 묶음은 예정일이 남아 있어도 다시 대상이 되지 않는다", () => {
    // (외부 송금으로 지급 완료된 건은 예정일을 그대로 보존한다 — 기록이니까.)
    expect(
      psql(`select count(*) from list_due_auto_dispatch_batches('2099-12-31') b
            join payout_batches pb on pb.id = b.batch_id where pb.status = 'paid';`)
    ).toBe("0");
  });
});

describe("지급 경계가 닫혀 있으면 실제 송금이 일어나지 않는다", () => {
  it("게이트가 false인 동안 dispatch는 거부되고 상태·멱등키가 생기지 않는다", () => {
    expect(psql(`select real_disbursement_enabled();`)).toBe("f");
    const { batchId } = createApprovedBatch("gate", "2026-11-10");

    expect(() => psql(`select dispatch_payout_batch('${batchId}'::uuid, 'wise', '${ADMIN_ID}'::uuid);`)).toThrow(
      /실제 지급이 활성화되지 않아/
    );
    const row = psql(`select status, dispatch_idempotency_key is null from payout_batches where id = '${batchId}';`);
    expect(row).toBe("approved|t");
  });
});

describe("record_external_payout_transfer() — 은행 직접 송금 기록", () => {
  it("승인된 묶음을 지급 완료로 바꾸고 근거·처리자를 남긴다", () => {
    const { batchId } = createApprovedBatch("ext", "2026-12-10");

    psql(
      `select record_external_payout_transfer('${batchId}'::uuid, '2027-01-10', 60000, 'KRW', 'WIRE-12345', '수기 이체', '${ADMIN_ID}'::uuid);`
    );

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("paid");
    expect(psql(`select external_transfer_recorded_at is not null from payout_batches where id = '${batchId}';`)).toBe("t");
    const row = psql(
      `select transferred_on, amount_minor, currency, bank_reference, recorded_by is not null
       from payout_external_transfers where batch_id = '${batchId}';`
    );
    expect(row).toBe("2027-01-10|60000|KRW|WIRE-12345|t");
    // 지급 완료된 묶음은 자동 송금 대상에서도 빠진다.
    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2027-12-10') where batch_id = '${batchId}';`)).toBe("0");
  });

  it("승인된 최종 송금액과 다른 금액은 기록할 수 없다", () => {
    const { batchId } = createApprovedBatch("ext-amount", "2027-06-10");
    // 승인 금액은 60000인데 다른 금액으로 기록하려 하면 막힌다.
    expect(() =>
      psql(`select record_external_payout_transfer('${batchId}'::uuid, '2027-07-10', 59000, 'KRW', 'WIRE-1', null, '${ADMIN_ID}'::uuid);`)
    ).toThrow(/승인된 최종 송금액.*다릅니다/);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
  });

  it("조정으로 금액이 바뀌면 재승인 뒤 그 금액으로 기록할 수 있다", () => {
    const { batchId } = createApprovedBatch("ext-adjusted", "2027-08-10");
    // 승인 상태에서 조정하면 검토 중으로 되돌아간다.
    psql(`select add_payout_batch_adjustment('${batchId}'::uuid, -10000, '차감', '${ADMIN_ID}'::uuid);`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("reviewed");
    psql(`select approve_payout_batch('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);

    psql(`select record_external_payout_transfer('${batchId}'::uuid, '2027-09-10', 50000, 'KRW', 'WIRE-2', null, '${ADMIN_ID}'::uuid);`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("paid");
  });

  it("같은 묶음에 두 번 기록할 수 없다", () => {
    const { batchId } = createApprovedBatch("ext-twice", "2027-10-10");
    psql(`select record_external_payout_transfer('${batchId}'::uuid, '2027-11-10', 60000, 'KRW', 'WIRE-3', null, '${ADMIN_ID}'::uuid);`);
    expect(() =>
      psql(`select record_external_payout_transfer('${batchId}'::uuid, '2027-11-11', 60000, 'KRW', 'WIRE-4', null, '${ADMIN_ID}'::uuid);`)
    ).toThrow(/송금 승인된 묶음에만/);
  });

  it("승인되지 않은 묶음에는 기록할 수 없다", () => {
    const teacher = createTeacher("ext-unapproved");
    const batchId = psql(
      `insert into payout_batches (teacher_id, period_start, period_end, currency, status)
       values ('${teacher}', '2026-04-01', '2026-04-30', 'KRW', 'calculated') returning id;`
    );
    expect(() =>
      psql(`select record_external_payout_transfer('${batchId}'::uuid, '2026-05-10', 1000, 'KRW', 'X', null, '${ADMIN_ID}'::uuid);`)
    ).toThrow(/송금 승인된 묶음에만/);
  });

  // 2026-09-12 정정: 확인 메모는 사후 대사 보조 정보라 필수가 아니다.
  it("확인 메모가 비어 있어도 기록된다(필수는 완료일과 금액 일치뿐)", () => {
    const { batchId } = createApprovedBatch("ext-nomemo", "2027-02-10");
    psql(`select record_external_payout_transfer('${batchId}'::uuid, '2027-03-10', 60000, 'KRW', '  ', null, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("paid");
    // 공백만 넣으면 null로 저장한다(빈 문자열을 남기지 않는다).
    expect(psql(`select bank_reference is null from payout_external_transfers where batch_id = '${batchId}';`)).toBe("t");
  });

  it("송금 완료일이 없으면 거부한다", () => {
    const { batchId } = createApprovedBatch("ext-nodate", "2027-02-10");
    expect(() =>
      psql(`select record_external_payout_transfer('${batchId}'::uuid, null, 60000, 'KRW', 'X', null, '${ADMIN_ID}'::uuid);`)
    ).toThrow(/송금 완료일/);
  });

  it("기록 뒤에는 금액도 예정일도 바꿀 수 없다", () => {
    const { batchId } = createApprovedBatch("ext-frozen", "2027-04-10");
    psql(`select record_external_payout_transfer('${batchId}'::uuid, '2027-05-10', 60000, 'KRW', 'WIRE-9', null, '${ADMIN_ID}'::uuid);`);

    expect(() => psql(`select add_payout_batch_adjustment('${batchId}'::uuid, -1000, '차감', '${ADMIN_ID}'::uuid);`)).toThrow(
      /변경할 수 없습니다/
    );
    expect(() => psql(`select set_payout_batch_scheduled_date('${batchId}'::uuid, '2027-06-10', '연기', '${ADMIN_ID}'::uuid);`)).toThrow(
      /지급 예정일만 변경할 수 있습니다|변경할 수 없습니다/
    );
  });
});

describe("교사 정산 송금 제공자는 Wise 전용 (2026-09-12 확정)", () => {
  it("앱의 교사 정산 경로에는 제공자 선택이 없다 — 상수 하나뿐", async () => {
    const { TEACHER_PAYOUT_PROVIDER } = await import("./auto-dispatch");
    expect(TEACHER_PAYOUT_PROVIDER).toBe("wise");
  });

  it("자동 실행과 수동 실행이 같은 멱등성 키를 재사용해 이중 송금을 막는다", () => {
    // 게이트가 닫혀 있어 실제 dispatch는 못 하므로, 키 재사용 규칙 자체를 확인한다:
    // dispatch_payout_batch()는 키가 이미 있으면 새로 만들지 않고 그대로 돌려준다.
    const definition = psql(`select pg_get_functiondef(oid) from pg_proc where proname = 'dispatch_payout_batch';`);
    expect(definition).toContain("if v_key is not null then");
    expect(definition).toContain("return v_key");
  });
});

// 2026-09-12 제품 오너 지시로 정책이 둘로 갈린다. 섞이지 않게 분리해 고정한다.
describe("자동 송금 기본값 — 새로 승인되는 묶음", () => {
  it("승인하면 자동 송금 대상이 되고 예정일이 함께 정해진다", () => {
    const { batchId } = createApprovedBatch("new-approval", "2026-01-10");
    const row = psql(
      `select auto_dispatch_enabled, scheduled_payout_date is not null from payout_batches where id = '${batchId}';`
    );
    expect(row).toBe("t|t");
  });

  it("관리자가 제외했더라도 재승인하면 다시 대상이 된다(재승인 = 보내도 된다는 판단)", () => {
    const { batchId } = createApprovedBatch("reapprove-auto", "2026-01-10");
    psql(`select set_payout_batch_auto_dispatch('${batchId}'::uuid, false, '${ADMIN_ID}'::uuid);`);
    expect(psql(`select auto_dispatch_enabled from payout_batches where id = '${batchId}';`)).toBe("f");

    // 조정하면 검토 중으로 돌아가고, 재승인하면 다시 대상이 된다.
    psql(`select add_payout_batch_adjustment('${batchId}'::uuid, -1000, '보정', '${ADMIN_ID}'::uuid);`);
    psql(`select approve_payout_batch('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select auto_dispatch_enabled from payout_batches where id = '${batchId}';`)).toBe("t");
  });
});

describe("기존 승인 묶음 보정 — 자동 송금은 켜지 않는다 (2026-09-12 UAT 결함)", () => {
  function legacyApprovedBatch(label: string): string {
    const teacher = createTeacher(label);
    const batchId = psql(
      `insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at)
       values ('${teacher}', '2026-01-01', '2026-01-31', 'KRW', 'approved', '2026-02-03T00:00:00Z') returning id;`
    );
    // 도입 전 상태 재현: 예정일 없음 + 자동 송금 제외.
    psql(`update payout_batches set scheduled_payout_date = null, auto_dispatch_enabled = false where id = '${batchId}';`);
    return batchId;
  }

  it("예정일만 승인 시각 기준으로 채우고 자동 송금은 제외 상태로 남긴다", () => {
    const batchId = legacyApprovedBatch("backfill");

    psql(`select ensure_payout_batch_scheduled_date('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);

    // 2026-02-03 승인 → 그 달 10일(2026-02-10).
    expect(psql(`select scheduled_payout_date from payout_batches where id = '${batchId}';`)).toBe("2026-02-10");
    expect(psql(`select count(*) from payout_scheduled_date_events where batch_id = '${batchId}';`)).toBe("1");
    // **자동 송금은 여전히 제외** — Wise 게이트를 여는 순간 과거 건이 나가면 안 된다.
    expect(psql(`select auto_dispatch_enabled from payout_batches where id = '${batchId}';`)).toBe("f");
    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-02-10') where batch_id = '${batchId}';`)).toBe("0");
  });

  it("관리자가 명시적으로 포함시키면 그때부터 대상이 된다", () => {
    const batchId = legacyApprovedBatch("backfill-include");
    psql(`select ensure_payout_batch_scheduled_date('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);

    psql(`select set_payout_batch_auto_dispatch('${batchId}'::uuid, true, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select count(*) from list_due_auto_dispatch_batches('2026-02-10') where batch_id = '${batchId}';`)).toBe("1");
  });

  it("이미 예정일이 있으면 덮어쓰지 않는다(관리자가 지정한 날짜 보호)", () => {
    const { batchId } = createApprovedBatch("keep-date", "2027-11-10");
    psql(`select set_payout_batch_scheduled_date('${batchId}'::uuid, '2028-01-15', '협의된 날짜', '${ADMIN_ID}'::uuid);`);

    psql(`select ensure_payout_batch_scheduled_date('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select scheduled_payout_date from payout_batches where id = '${batchId}';`)).toBe("2028-01-15");
  });

  it("승인 전 묶음에는 예정일을 확정할 수 없다", () => {
    const teacher = createTeacher("backfill-unapproved");
    const batchId = psql(
      `insert into payout_batches (teacher_id, period_start, period_end, currency, status)
       values ('${teacher}', '2026-02-01', '2026-02-28', 'KRW', 'calculated') returning id;`
    );
    expect(() => psql(`select ensure_payout_batch_scheduled_date('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`)).toThrow(
      /송금 승인된 묶음만/
    );
  });
});
