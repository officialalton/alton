import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P4-2(2차) — 자동 월 마감 / 최종 송금액 조정 / 마감 뒤 차액 이월의 DB 레이어 검증.
// 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
//
// 확인 대상:
//  (1) 자동 마감이 중복 실행·재시도에도 같은 항목을 두 번 묶지 않는다.
//  (2) 재실행 시 새 묶음을 만들지 않고 열려 있는 같은 기간 묶음에 덧붙인다.
//  (3) 조정은 자동 산정 항목을 고치지 않고 별도 항목 + 이력으로 들어간다.
//  (4) 승인 뒤 조정하면 검토 중으로 되돌아가 재승인이 필요하다.
//  (5) 송금 요청 이후에는 조정이 거부된다.
//  (6) 마감(승인) 뒤 수업 재판정은 원본을 덮어쓰지 않고 차액을 미배치 조정으로 만든다.
//  (7) 그 차액이 다음 마감에 자동으로 실린다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const HOURLY_RATE_MINOR = 60000; // KRW/시간 — 금액은 payable_minutes로 조절한다.

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createTeacher(label: string): string {
  const email = `p4-2b-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '정산교사${label}');`);
  psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  // 세션 생성 트리거(enforce_and_snapshot_teacher_rate)가 유효한 시급 이력을 요구한다.
  // 시급은 교사당 1회만 세팅하고(이후 변경은 effective_from이 더 뒤여야 한다),
  // 금액 차이는 payable_minutes로 만든다 — 금액 = 시급 × 분 / 60.
  psql(`select set_teacher_rate('${id}'::uuid, ${HOURLY_RATE_MINOR}, 'KRW', now() - interval '2 years');`);
  return id;
}

// 세션 기반 정산 항목 1건을 만든다(예약일 = 지정한 날짜).
function createSessionPayoutItem(teacherId: string, dateIso: string, amount: number): { itemId: string; sessionId: string } {
  // 금액 = 시급(60,000) × 분 / 60 → 원하는 금액에 맞는 분을 역산한다.
  const payableMinutes = Math.round((amount * 60) / HOURLY_RATE_MINOR);
  const lessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const subjectId = "eeeeeeee-0000-0000-0000-000000000001";
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-2b-child-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${childId}', 'student', '정산학생');`);
  psql(`insert into students (id, status) values ('${childId}', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${subjectId}', '${contractId}', 'active') returning id;`
  );
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${teacherId}', '${dateIso}T10:00:00Z', '${dateIso}T11:00:00Z', 'confirmed')
     returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, payable_minutes)
     values ('${reservationId}', '${enrollmentId}', '${teacherId}', '${lessonTypeId}', 60, 'completed', ${payableMinutes})
     returning id;`
  );
  psql(`select upsert_session_payout_item('${sessionId}');`);
  const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
  return { itemId, sessionId };
}

describe("close_payout_period() — 자동 월 마감 멱등성", () => {
  it("같은 기간을 두 번 마감해도 항목이 두 번 묶이지 않고 새 묶음도 생기지 않는다", () => {
    const teacher = createTeacher("idem");
    createSessionPayoutItem(teacher, "2026-04-10", 50000);

    const first = psql(`select count(*) from close_payout_period('2026-04-01', '2026-04-30') where out_teacher_id = '${teacher}';`);
    expect(first).toBe("1");

    // 두 번째 실행: 새로 묶을 항목이 없다.
    psql(`select * from close_payout_period('2026-04-01', '2026-04-30');`);

    expect(psql(`select count(*) from payout_batches where teacher_id = '${teacher}' and period_start = '2026-04-01';`)).toBe("1");
    expect(psql(`select count(*) from payout_items where teacher_id = '${teacher}' and batch_id is not null;`)).toBe("1");
  });

  it("마감 뒤 같은 달 항목이 늦게 생기면 새 묶음을 만들지 않고 기존 묶음에 덧붙인다", () => {
    const teacher = createTeacher("late");
    createSessionPayoutItem(teacher, "2026-05-05", 30000);
    psql(`select * from close_payout_period('2026-05-01', '2026-05-31');`);

    // 실행 지연 사이에 같은 달 수업이 하나 더 확정됐다.
    createSessionPayoutItem(teacher, "2026-05-20", 20000);
    psql(`select * from close_payout_period('2026-05-01', '2026-05-31');`);

    expect(psql(`select count(*) from payout_batches where teacher_id = '${teacher}' and period_start = '2026-05-01';`)).toBe("1");
    const batchId = psql(`select id from payout_batches where teacher_id = '${teacher}' and period_start = '2026-05-01';`);
    expect(psql(`select count(*) from payout_items where batch_id = '${batchId}';`)).toBe("2");
    expect(psql(`select sum(amount_minor) from payout_items where batch_id = '${batchId}';`)).toBe("50000");
  });
});

describe("add_payout_batch_adjustment() — 최종 송금액 조정", () => {
  function arrangeApprovedBatch(label: string): { teacher: string; batchId: string; itemId: string } {
    const teacher = createTeacher(label);
    const { itemId } = createSessionPayoutItem(teacher, "2026-06-10", 40000);
    psql(`select * from close_payout_period('2026-06-01', '2026-06-30');`);
    const batchId = psql(`select id from payout_batches where teacher_id = '${teacher}' and period_start = '2026-06-01';`);
    return { teacher, batchId, itemId };
  }

  it("자동 산정 항목을 고치지 않고 별도 조정 항목과 이력을 남긴다", () => {
    const { batchId, itemId } = arrangeApprovedBatch("adjust");
    psql(`select add_payout_batch_adjustment('${batchId}'::uuid, -5000, '교통비 차감', '${ADMIN_ID}'::uuid);`);

    // 원본 수업 항목은 그대로다.
    expect(psql(`select amount_minor from payout_items where id = '${itemId}';`)).toBe("40000");
    // 조정 항목이 따로 생겼고 합계는 35000이다.
    expect(psql(`select amount_minor from payout_items where batch_id = '${batchId}' and item_type = 'adjustment';`)).toBe("-5000");
    expect(psql(`select sum(amount_minor) from payout_items where batch_id = '${batchId}';`)).toBe("35000");
    // 사유·처리자·시각이 이력에 남는다.
    const row = psql(`select amount_minor, reason, created_by is not null from payout_batch_adjustments where batch_id = '${batchId}';`);
    expect(row).toBe("-5000|교통비 차감|t");
  });

  it("사유 없이는 조정할 수 없다", () => {
    const { batchId } = arrangeApprovedBatch("noreason");
    expect(() => psql(`select add_payout_batch_adjustment('${batchId}'::uuid, 1000, '  ', '${ADMIN_ID}'::uuid);`)).toThrow(
      /조정 사유/
    );
  });

  it("승인 뒤 조정하면 검토 중으로 되돌아가 재승인이 필요하다", () => {
    const { batchId } = arrangeApprovedBatch("reapprove");
    psql(`select approve_payout_batch('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    psql(`select add_payout_batch_adjustment('${batchId}'::uuid, 3000, '보정', '${ADMIN_ID}'::uuid);`);

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("reviewed");
    expect(psql(`select approved_at is null from payout_batches where id = '${batchId}';`)).toBe("t");
    expect(
      psql(`select count(*) from payout_batch_audit_log where batch_id = '${batchId}' and action = 'reverted_to_review';`)
    ).toBe("1");
  });

  it("송금 요청 이후에는 조정을 거부한다", () => {
    const { batchId } = arrangeApprovedBatch("dispatched");
    // 실제 송금 경로는 게이트로 막혀 있으므로 상태만 직접 올려 규칙을 검증한다.
    psql(`update payout_batches set status = 'dispatch_requested' where id = '${batchId}';`);
    expect(() => psql(`select add_payout_batch_adjustment('${batchId}'::uuid, 1000, '뒤늦은 보정', '${ADMIN_ID}'::uuid);`)).toThrow(
      /송금 요청 이후에는 금액을 변경할 수 없습니다/
    );
  });
});

describe("upsert_session_payout_item() — 마감 뒤 재판정은 차액 이월", () => {
  it("승인된 묶음의 원본 금액을 덮어쓰지 않고 차액을 미배치 조정 항목으로 만든다", () => {
    const teacher = createTeacher("carry");
    const { itemId, sessionId } = createSessionPayoutItem(teacher, "2026-07-10", 60000);
    psql(`select * from close_payout_period('2026-07-01', '2026-07-31');`);
    const batchId = psql(`select id from payout_batches where teacher_id = '${teacher}' and period_start = '2026-07-01';`);
    psql(`select approve_payout_batch('${batchId}'::uuid, '${ADMIN_ID}'::uuid);`);

    // 마감·승인 뒤 재판정으로 지급 대상 분이 30분으로 줄었다.
    psql(`update sessions set payable_minutes = 30 where id = '${sessionId}';`);
    psql(`select upsert_session_payout_item('${sessionId}');`);

    // 원본은 불변.
    expect(psql(`select amount_minor from payout_items where id = '${itemId}';`)).toBe("60000");
    // 차액(-30000)이 미배치 조정 항목으로 생겼고 원본과 연결돼 있다.
    const carry = psql(
      `select amount_minor, batch_id is null, adjusts_payout_item_id = '${itemId}'
       from payout_items where adjusts_payout_item_id = '${itemId}';`
    );
    expect(carry).toBe("-30000|t|t");
  });

  it("그 차액은 다음 달 마감에 자동으로 실린다", () => {
    const teacher = createTeacher("carry-next");
    const { sessionId } = createSessionPayoutItem(teacher, "2026-08-10", 60000);
    psql(`select * from close_payout_period('2026-08-01', '2026-08-31');`);
    const augustBatch = psql(`select id from payout_batches where teacher_id = '${teacher}' and period_start = '2026-08-01';`);
    psql(`select approve_payout_batch('${augustBatch}'::uuid, '${ADMIN_ID}'::uuid);`);
    psql(`update sessions set payable_minutes = 30 where id = '${sessionId}';`);
    psql(`select upsert_session_payout_item('${sessionId}');`);

    // 다음 달 마감 — 9월엔 수업이 없지만 이월 조정만으로 묶음이 생긴다.
    psql(`select * from close_payout_period('2026-09-01', '2026-09-30');`);

    const septBatch = psql(`select id from payout_batches where teacher_id = '${teacher}' and period_start = '2026-09-01';`);
    expect(septBatch).not.toBe("");
    expect(psql(`select sum(amount_minor) from payout_items where batch_id = '${septBatch}';`)).toBe("-30000");
    // 8월 묶음(승인됨)은 그대로다.
    expect(psql(`select sum(amount_minor) from payout_items where batch_id = '${augustBatch}';`)).toBe("60000");
  });

  it("아직 검토 중인 묶음이면 제자리에서 갱신한다(검토 정확도 유지)", () => {
    const teacher = createTeacher("inreview");
    const { itemId, sessionId } = createSessionPayoutItem(teacher, "2026-10-10", 60000);
    psql(`select * from close_payout_period('2026-10-01', '2026-10-31');`);

    psql(`update sessions set payable_minutes = 30 where id = '${sessionId}';`);
    psql(`select upsert_session_payout_item('${sessionId}');`);

    expect(psql(`select amount_minor from payout_items where id = '${itemId}';`)).toBe("30000");
    expect(psql(`select count(*) from payout_items where adjusts_payout_item_id = '${itemId}';`)).toBe("0");
  });
});
