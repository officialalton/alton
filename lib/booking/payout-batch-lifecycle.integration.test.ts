import { execFileSync, spawn } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// R10(결제·환불·선생님 정산) — payout batch 생성·승인·지급·역분개 상태머신
// (supabase/migrations/20261218000000_r10_payout_batch_lifecycle.sql)을 로컬
// Postgres에 직접 psql로 검증한다. lib/booking/session-final-judgment.integration.test.ts와
// 동일한 fixture 패턴(전용 선생님/학생, UUID 재사용 없음)을 재사용해 다른 통합
// 테스트와의 teacher_availability_rules 레이스를 피한다.
//
// UAT 실행 ID: r10-batch-uat-2026-09-07 — 아래에서 만드는 auth user 이메일에
// 그대로 포함시켜 남는 흔적을 추적 가능하게 하고, afterAll에서 이 파일이 만든
// 모든 데이터(payout_items/batches/audit_log/sessions/reservations/entitlement/
// contract/household/student/teacher_availability_rules)를 FK 의존 역순으로
// 정리한다(2026-09-07 제품 오너 리뷰: "다음 db reset이 지운다"는 기존 관례에
// 기대면 reset 없이 반복 실행할 때 잔여 데이터가 다음 실행과 충돌한다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN_ID = "r10-batch-uat-2026-09-07";
const TEACHER_ID = "77777777-0000-0000-0000-000000000002"; // 이 파일 전용(final-judgment 테스트의 ...001과 겹치지 않음)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (기존 통합 테스트와 공유하는 seed subject, 읽기만 함)
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let regularProductId: string;
let householdId: string;

function grantRegularEntitlement(): string {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 5, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 5, '${RUN_ID}-grant-${grantId}');`
  );
  return grantId;
}

const SESSION_MINUTES = 120;
const BUFFER_MINUTES = 15; // violates_teacher_buffer()의 booking_buffer_minutes()와 동일

// 제품 오너 리뷰(2026-09-07): 이 파일의 예약 시각은 예전엔 daysAgo(1~11)로 결정되는
// 고정 시각(17:00) 하나뿐이었다. entitlement_ledger는 INSERT-only(reject_ledger_mutation
// 트리거)라 이 ledger가 참조하는 reservations 행은 "다음 db reset" 전까지 절대 지울 수
// 없다(afterAll에서 실제 확인함 — entitlement_ledger_reservation_id_fkey가 DELETE를
// 막는다). 즉 같은 날 이 파일을 reset 없이 다시 실행하면 daysAgo가 가리키는 "오늘-N일"
// 날짜가 매번 동일해서 reservations_no_overlap(정확히 겹침) 또는 violates_teacher_buffer
// (전후 15분 이내)에 반드시 부딪힌다 — 이번에 고치는 플레이키니스의 근본 원인이다.
//
// 고정 시각 대신, 그날 이 TEACHER_ID에 이미 잡혀 있는(과거 실행이 남긴 것 포함) 모든
// 예약을 실제로 조회해서 버퍼까지 포함해 겹치지 않는 시각을 찾는다 — "추측으로 흩뿌리기"가
// 아니라 DB 상태를 직접 확인하므로 몇 번을 반복 실행해도 항상 안전한 슬롯을 찾을 수 있다
// (그날 후보 슬롯이 모두 소진된 극단적인 경우에만 예외를 던진다). 후보 시각은
// is_teacher_slot_open()이 "자정을 넘기는 슬롯은 같은 로컬 날짜가 아니면 거부"하는 조건
// (America/Los_Angeles, UTC-7/-8)을 피해 UTC 08~23시, 00~04시 범위(로컬 자정 부근만
// 제외)에서 150분(수업 120분 + 양쪽 버퍼 15분) 간격으로만 고른다.
const CANDIDATE_HOURS_UTC = [8, 10.5, 13, 15.5, 18, 20.5, 23, 1.5, 4] as const;

function findFreeSlot(dayBase: Date): Date {
  const dayStart = new Date(dayBase);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600000);
  const existingRaw = psql(
    `select starts_at, ends_at from reservations where owner_profile_id = '${TEACHER_ID}' and starts_at >= '${dayStart.toISOString()}' and starts_at < '${dayEnd.toISOString()}' order by starts_at;`
  );
  const busy = existingRaw
    ? existingRaw.split("\n").map((line) => {
        const [s, e] = line.split("|");
        return { start: new Date(s).getTime(), end: new Date(e).getTime() };
      })
    : [];
  const bufferMs = BUFFER_MINUTES * 60000;
  for (const h of CANDIDATE_HOURS_UTC) {
    const candidateStart = dayStart.getTime() + h * 3600000;
    const candidateEnd = candidateStart + SESSION_MINUTES * 60000;
    const overlaps = busy.some(
      (b) => candidateStart < b.end + bufferMs && candidateEnd + bufferMs > b.start
    );
    if (!overlaps) {
      return new Date(candidateStart);
    }
  }
  throw new Error(
    `findFreeSlot: ${dayBase.toISOString().slice(0, 10)}에 TEACHER_ID(${TEACHER_ID})용 빈 슬롯이 없습니다 — 후보를 늘리거나 db reset이 필요합니다.`
  );
}

function bookAndCompleteSession(daysAgo: number): string {
  // confirm_lesson_booking()은 미래 시각만 허용(booking_window_violation)하므로
  // 미래로 예약한 뒤(session-final-judgment.integration.test.ts와 동일 패턴)
  // reservations.starts_at/ends_at을 과거로 되돌려 세션 조회 기간(scheduled_start_at)에
  // 걸리게 한다. 임시 미래 슬롯도 findFreeSlot()으로 고른다 — 이 파일이 비정상
  // 종료(테스트 크래시/강제 중단)돼 과거로 되돌리는 UPDATE 전에 멈추면 그 예약이
  // 그대로 남는데, 다음 실행도 실제 DB 상태를 조회해서 그 잔여 예약을 피해간다.
  // 날짜는 is_within_booking_window(24시간~8주)를 벗어나지 않도록 40~51일 사이로 유지한다.
  const futureDate = new Date();
  futureDate.setUTCDate(futureDate.getUTCDate() + 40 + daysAgo);
  const futureSlot = findFreeSlot(futureDate);
  const startsAt = futureSlot.toISOString();
  const endsAt = new Date(futureSlot.getTime() + SESSION_MINUTES * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', '${RUN_ID}-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");

  const pastDate = new Date();
  pastDate.setUTCDate(pastDate.getUTCDate() - daysAgo);
  const pastSlot = findFreeSlot(pastDate);
  const pastStarts = pastSlot.toISOString();
  const pastEnds = new Date(pastSlot.getTime() + SESSION_MINUTES * 60000).toISOString();
  psql(`update reservations set starts_at = '${pastStarts}', ends_at = '${pastEnds}' where id = '${reservationId}';`);

  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '${RUN_ID} 정상 완료');`);
  return sessionId;
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);

  // 이 파일 전용 선생님(77777777-...-002)은 seed에 없으므로 profiles/auth.users를 직접 만든다.
  psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '${TEACHER_ID}', 'authenticated', 'authenticated', '${RUN_ID}-teacher-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
     on conflict (id) do nothing;`
  );
  psql(`insert into profiles (id, role, name) values ('${TEACHER_ID}', 'teacher', '${RUN_ID} 선생님') on conflict (id) do nothing;`);

  const authEmail = `${RUN_ID}-${Date.now()}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', '${RUN_ID} 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${childId}', 'child', true);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '10 day');`);
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '10 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );
});

// best-effort 정리: 한 문장이 (예상 못 한 FK 참조 등으로) 실패해도 나머지 정리
// 문장은 계속 실행되도록 감싼다 — 부분 실패로 정리 전체가 중단되어 다음 실행에
// 잔여 데이터를 남기는 사태를 막는다. 실패는 흔적을 남기려고 stderr에만 남긴다.
function psqlBestEffort(sql: string): void {
  try {
    psql(sql);
  } catch (err) {
    console.error(`[payout-batch-lifecycle cleanup] 정리 문장 실패(계속 진행): ${sql}\n`, err);
  }
}

afterAll(() => {
  // 제품 오너 리뷰(2026-09-07): 실제로 지울 수 있는 것과 없는 것을 확인했다.
  // entitlement_ledger는 INSERT-only(reject_ledger_mutation 트리거)라 DELETE
  // 자체가 거부되고, entitlement_ledger.reservation_id가 reservations를 참조하는
  // 한 그 reservations 행(과 이를 참조하는 subject_enrollments/contracts/
  // households/profiles/students/auth.users 전체 체인)은 구조적으로 영구히
  // 지울 수 없다 — "다음 db reset이 지운다"는 기존 주석은 이 부분에 한해 맞는
  // 말이었다. 반면 payout_items/batches/audit_log, sessions(+session_status_events),
  // teacher_assignments(+자동 생성되는 subject_threads), teacher_availability_rules는
  // 실제로 삭제 가능하므로 여기서 정리해 다음 실행과의 오염을 최대한 줄인다.
  // (reservations 자체가 영구히 남는 문제는 위 bookAndCompleteSession()의
  // 지터링된 슬롯 선택으로 해결한다 — 같은 날 반복 실행해도 서로 다른, 버퍼
  // 위반 없는 시각을 골라 절대 겹치지 않게 한다.)
  psqlBestEffort(`delete from payout_batch_audit_log where batch_id in (select id from payout_batches where teacher_id = '${TEACHER_ID}');`);
  psqlBestEffort(`delete from payout_items where teacher_id = '${TEACHER_ID}';`);
  psqlBestEffort(`delete from payout_batches where teacher_id = '${TEACHER_ID}';`);
  // 20260928000000_r6_sessions_cutover.sql에서 sessions_v3 -> sessions로 rename됐다
  // (레거시 sessions는 legacy_sessions로 옮겨짐) — 실제 테이블명은 sessions다.
  // mark_lesson_session_started()/finalize_lesson_session()가 호출될 때마다
  // session_status_events에 감사 로그 행을 남기므로(FK, cascade 없음) sessions를
  // 지우기 전에 먼저 지워야 한다.
  psqlBestEffort(`delete from session_status_events where session_id in (select id from sessions where teacher_id = '${TEACHER_ID}');`);
  psqlBestEffort(`delete from sessions where teacher_id = '${TEACHER_ID}';`);
  // teacher_assignments INSERT마다 트리거(teacher_assignments_ensure_subject_thread,
  // 20260925010000_r5_subject_thread_auto_create.sql)가 subject_threads를 자동
  // 생성하므로, teacher_assignments를 지우기 전에 먼저 지워야 한다.
  psqlBestEffort(`delete from subject_threads where teacher_assignment_id in (select id from teacher_assignments where teacher_id = '${TEACHER_ID}');`);
  psqlBestEffort(`delete from teacher_assignments where teacher_id = '${TEACHER_ID}';`);
  psqlBestEffort(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("payout batch lifecycle (R10)", () => {
  it("generate_payout_batches가 미배치 pending 항목을 선생님×통화 단위 draft batch로 묶는다(멱등)", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(3);

    const pendingBefore = psql(
      `select status, batch_id is null from payout_items where session_id = '${sessionId}';`
    );
    expect(pendingBefore).toBe("pending|t");

    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const periodEnd = new Date();
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = periodEnd.toISOString().slice(0, 10);

    const row = psql(
      `select batch_id, currency, item_count, total_amount_minor from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const [batchId, currency, itemCount] = row.split("|");
    expect(currency).toBe("KRW");
    expect(itemCount).toBe("1");

    const itemStatus = psql(`select status, batch_id from payout_items where session_id = '${sessionId}';`);
    expect(itemStatus).toBe(`batched|${batchId}`);

    // 멱등: 다시 호출해도 이미 배치된 항목은 재조회되지 않아 신규 batch가 생기지 않는다.
    const secondRun = psql(
      `select count(*) from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    expect(secondRun).toBe("0");

    // 승인까지는 정책상 허용(법인 설립 전에도 검토·승인 원장은 진행).
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    expect(psql(`select status from payout_items where batch_id = '${batchId}';`)).toBe("approved");

    // 법인 설립 전 지급 경계(2026-09-07, 20261221000000 corrective migration):
    // approved -> processing/paid는 real_disbursement_enabled() 게이트가
    // false(기본값)인 동안 fail-closed로 거부된다.
    expect(() => psql(`select mark_payout_batch_processing('${batchId}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    // 거부된 시도가 상태를 바꾸지 않았는지 확인.
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    const auditActions = psql(
      `select string_agg(action, ',' order by created_at) from payout_batch_audit_log where batch_id = '${batchId}';`
    );
    expect(auditActions).toBe("approved");
  });

  // 게이트가 닫혀 있는 동안(fail-closed, 기본값) processing/dispatch_requested/
  // provider_pending/paid로의 모든 전이가 전부 거부되는지 전체 매트릭스를 확인한다
  // (제품 오너 리뷰: "Task A 라운드에서 일부만 검증됨 — 전체 매트릭스로 확장").
  it("게이트가 닫혀 있으면 processing/dispatch_requested/provider_pending/paid 전이가 전부 거부된다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(4);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select real_disbursement_enabled();`)).toBe("f");

    expect(() => psql(`select mark_payout_batch_processing('${batchId}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    expect(() => psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    expect(() =>
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'tx-should-not-work');`)
    ).toThrow(/법인 설립 전 지급 경계|dispatch_requested 상태의 batch만/);
    expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    void sessionId;
  });

  // R10 corrective(요구사항 1, 2026-09-07 리뷰): 게이트가 열려 있어도 paid는
  // provider_pending 상태 + provider_transaction_id + provider_confirmed_at이
  // 전부 있어야만 성립한다. approved/processing에서 곧바로 paid로 갈 수 없고,
  // provider_pending이어도 확인 컬럼이 없으면 거부된다.
  it("게이트가 열려도 provider_pending + transaction id + 최종 확인이 모두 있어야만 paid가 된다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(5);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      // approved에서 곧바로 paid — 여전히 거부(요구사항 1의 핵심).
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /provider_pending 상태의 batch만/
      );

      const key = psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      expect(key).toMatch(/-/); // uuid
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "dispatch_requested"
      );

      // dispatch_requested에서도 paid 직행은 여전히 거부.
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /provider_pending 상태의 batch만/
      );

      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-001');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      // provider_pending이지만 아직 최종 확인(provider_confirmed_at)이 없다 — 거부.
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /제공자 최종 성공 확인/
      );

      // provider_transaction_id 없이는 확인 자체도 거부(방어적 가드).
      psql(`update payout_batches set provider_transaction_id = null where id = '${batchId}';`);
      expect(() =>
        psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`)
      ).toThrow(/provider_transaction_id가 없는 batch/);
      psql(`update payout_batches set provider_transaction_id = 'mercury-tx-001' where id = '${batchId}';`);

      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      // 이제 세 조건이 모두 있으므로 paid로 전이 성공.
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);

      const [status, txId, confirmedNotNull] = psql(
        `select status, provider_transaction_id, (provider_confirmed_at is not null) from payout_batches where id = '${batchId}';`
      ).split("|");
      expect(status).toBe("paid");
      expect(txId).toBe("mercury-tx-001");
      expect(confirmedNotNull).toBe("t");

      const [itemStatus, itemTx, itemConfirmedNotNull] = psql(
        `select status, provider_transaction_id, (provider_confirmed_at is not null) from payout_items where id = '${itemId}';`
      ).split("|");
      expect(itemStatus).toBe("paid");
      expect(itemTx).toBe("mercury-tx-001");
      expect(itemConfirmedNotNull).toBe("t");

      // CHECK 제약이 구조적으로도 강제하는지: 함수를 우회해 provider_transaction_id를
      // 지우는 직접 UPDATE는 트리거(prevent_paid_item_mutation, old.status=paid)가
      // 이미 막지만, 애초에 paid로 만드는 시도 자체도 CHECK가 막는지 별도 batch로 확인.
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(요구사항 1): CHECK 제약은 함수 본문과 무관하게 구조적으로
  // paid + 확인 컬럼 누락 조합을 거부한다 — 새 batch를 만들어 직접 검증.
  // (2026-09-07 트리거 보강 이후: 트리거는 OLD.status=provider_pending일 때만
  //  paid 전이를 허용하므로, CHECK 자체를 단독으로 시험하려면 batch를 먼저
  //  provider_pending까지 올려서 트리거 검사를 통과시킨 뒤 확인 컬럼 누락 상태로
  //  paid를 시도해야 한다.)
  it("CHECK 제약이 provider_transaction_id/provider_confirmed_at 없는 paid 행을 구조적으로 거부한다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(6);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-check-only');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      // 트리거의 OLD.status 검사는 통과(provider_pending)하지만, CHECK가
      // provider_confirmed_at(및 이번 사례는 transaction_id도) 누락을 거부해야 한다.
      expect(() =>
        psql(`update payout_batches set status = 'paid' where id = '${batchId}';`)
      ).toThrow(/payout_batches_paid_requires_confirmation/);
      expect(() =>
        psql(
          `update payout_batches set status = 'paid', provider_transaction_id = 'x' where id = '${batchId}';`
        )
      ).toThrow(/payout_batches_paid_requires_confirmation/);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  it("reverse_payout_item은 게이트가 열려 있어도(요구사항 2) 항상 approved에서 시작하고, 정규 payout과 동일한 파이프라인을 거쳐야만 paid가 된다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(7);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const row = psql(`select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`);
    const batchId = row.split("\n")[0];
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);

    // reverse_payout_item()은 paid 상태의 원본 항목만 대상으로 하므로, 이 시나리오를
    // 시험하려면 게이트를 임시로 열어 정식 파이프라인(dispatch->provider_pending->
    // confirmed->paid)으로 원본을 paid까지 만든 뒤 다시 닫는다(운영 게이트 테이블을
    // 테스트 목적으로만 직접 조작 — 실제 앱 코드 경로는 아님).
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-orig');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
    expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("paid");

    // 직접 수정 시도는 트리거가 막는다(R1 기존 불변, 게이트와 무관).
    expect(() => psql(`update payout_items set amount_minor = 1 where id = '${itemId}';`)).toThrow();

    const [origAmount, origMinutes] = psql(
      `select amount_minor, payable_minutes from payout_items where id = '${itemId}';`
    ).split("|");

    // 게이트가 닫힌 채로(기본값) 역분개 — 새 batch/item은 paid가 아니라 approved에서 멈춰야 한다.
    const newItemId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 판정 정정', '${ADMIN_ID}');`);
    const [revAmount, revMinutes, revType, revStatus, revBatchId] = psql(
      `select amount_minor, payable_minutes, item_type, status, batch_id from payout_items where id = '${newItemId}';`
    ).split("|");
    expect(revAmount).toBe(String(-Number(origAmount)));
    expect(revMinutes).toBe(String(-Number(origMinutes)));
    expect(revType).toBe("reversal");
    expect(revStatus).toBe("approved"); // paid가 아니다 — 법인 설립 전 경계.
    expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("approved");

    // 요구사항 2의 핵심: 게이트를 다시 열어도(이미 approved인) 역분개 batch가
    // "게이트가 열려있으니" 자동으로 paid가 되지는 않는다 — 정규 payout과 동일한
    // 파이프라인(dispatch->provider_pending->confirmed->paid)을 직접 거쳐야만 한다.
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("approved");
      expect(() => psql(`select mark_payout_batch_paid('${revBatchId}', '${ADMIN_ID}');`)).toThrow(
        /provider_pending 상태의 batch만/
      );
      psql(`select dispatch_payout_batch('${revBatchId}', 'wise', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${revBatchId}', 'wise-tx-reversal');`);
      psql(`select mark_payout_batch_provider_confirmed('${revBatchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${revBatchId}', '${ADMIN_ID}');`);
      expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("paid");
      expect(psql(`select status from payout_items where id = '${newItemId}';`)).toBe("paid");
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }

    // 원본 항목은 그대로 불변.
    const stillOrig = psql(`select amount_minor from payout_items where id = '${itemId}';`);
    expect(stillOrig).toBe(origAmount);
  });

  // R10 corrective(2026-09-09, 기반 안정화 1단계 — 정산 P0):
  // reverse_payout_item()의 "원본당 역분개 정확히 1회" 멱등 정책
  // (20261262000000_r10_corrective_reversal_idempotency.sql)을 검증한다.
  // 원본을 paid까지 만드는 절차는 위 테스트와 동일한 패턴을 재사용한다.
  function createPaidOriginalItem(daysAgo: number): string {
    const sessionId = bookAndCompleteSession(daysAgo);
    const periodStart = new Date();
    // generate_payout_batches는 세션의 starts_at 날짜가 [periodStart, periodEnd] 안에
    // 있어야만 묶는다 — daysAgo가 10을 넘는 호출도 있으므로 항상 daysAgo보다 넉넉히
    // 앞선 날짜를 period 시작으로 잡는다(고정 -10일이면 daysAgo>10일 때 범위 밖).
    periodStart.setUTCDate(periodStart.getUTCDate() - (daysAgo + 3));
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);
    const batchId = psql(`select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-${itemId}');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
    expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("paid");
    return itemId;
  }

  it("reverse_payout_item을 같은 원본에 순차 재시도하면 두 번째 호출은 새 행을 만들지 않고 기존 역분개 ID를 그대로 반환한다(멱등)", () => {
    const itemId = createPaidOriginalItem(9);

    const firstId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 첫 호출', '${ADMIN_ID}');`);
    const secondId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 재시도', '${ADMIN_ID}');`);

    expect(secondId).toBe(firstId);
    expect(psql(`select count(*) from payout_items where reversed_from_item_id = '${itemId}';`)).toBe("1");
    // 감사 로그도 정확히 1건만 존재 — 재시도가 새 로그를 남기지 않는다.
    expect(
      psql(
        `select count(*) from payout_batch_audit_log where action = 'reversal_created' and note like '%${itemId}%';`
      )
    ).toBe("1");
  });

  it("같은 원본에 대한 동시 역분개 호출은 정확히 1건의 역분개 행만 남기고, 유니크 제약에 부딪힌 쪽은 에러 없이 같은 ID로 수렴한다", async () => {
    const itemId = createPaidOriginalItem(10);

    // 두 트랜잭션이 "기존 역분개 없음"을 확인한 뒤 INSERT 사이의 경합 창을 넓히기
    // 위해, reversal item INSERT 직전에 짧게 지연시키는 트리거를 임시로 건다
    // (reconciliation-task-lock-token.integration.test.ts와 동일한 기법).
    psql(`
      create or replace function delay_reversal_insert_for_test()
      returns trigger language plpgsql as $$
      begin
        if new.item_type = 'reversal' then
          perform pg_sleep(0.4);
        end if;
        return new;
      end;
      $$;
    `);
    psql(`
      create trigger delay_reversal_insert
        before insert on payout_items
        for each row execute function delay_reversal_insert_for_test();
    `);

    function runReverse(reason: string): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        const child = spawn("psql", [
          DB_URL,
          "-v",
          "ON_ERROR_STOP=1",
          "-q",
          "-t",
          "-A",
          "-c",
          `select reverse_payout_item('${itemId}', '${reason}', '${ADMIN_ID}');`,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output: output.trim() }));
      });
    }

    try {
      const [a, b] = await Promise.all([
        runReverse(`${RUN_ID} 동시 호출 A`),
        runReverse(`${RUN_ID} 동시 호출 B`),
      ]);
      // 유니크 제약 위반은 함수 내부에서 잡아 재조회로 수렴하므로, 두 호출 모두
      // 에러 없이 성공하고 같은 ID를 반환해야 한다.
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(a.output).toBe(b.output);
      expect(psql(`select count(*) from payout_items where reversed_from_item_id = '${itemId}';`)).toBe("1");
    } finally {
      psql(`drop trigger if exists delay_reversal_insert on payout_items;`);
      psql(`drop function if exists delay_reversal_insert_for_test();`);
    }
  });

  it("역분개 생성 도중 실패하면 전체 롤백되어 좀비 상태(역분개 없이 reversed_from_item_id만 존재 등)를 남기지 않고, 다음 호출이 정상적으로 새 역분개를 만든다", () => {
    const itemId = createPaidOriginalItem(11);

    // payout_batch_audit_log INSERT를 강제로 실패시키는 트리거 — reverse_payout_item()의
    // 마지막 단계(감사 로그 기록)가 실패했을 때 앞서 만든 batch/item INSERT까지
    // 전부 롤백되는지 확인한다(단일 함수 = 단일 트랜잭션이므로 구조적으로 원자적이어야 함).
    psql(`
      create or replace function fail_reversal_audit_log_for_test()
      returns trigger language plpgsql as $$
      begin
        if new.action = 'reversal_created' and new.note like '%중간 실패 유도%' then
          raise exception '테스트 유도 실패: 감사 로그 기록 실패';
        end if;
        return new;
      end;
      $$;
    `);
    psql(`
      create trigger fail_reversal_audit_log
        before insert on payout_batch_audit_log
        for each row execute function fail_reversal_audit_log_for_test();
    `);

    try {
      expect(() =>
        psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 중간 실패 유도', '${ADMIN_ID}');`)
      ).toThrow(/테스트 유도 실패/);
      // 좀비 상태 없음: 역분개 행도, reversed_from_item_id 표시도 전혀 남지 않았다.
      expect(psql(`select count(*) from payout_items where reversed_from_item_id = '${itemId}';`)).toBe("0");
    } finally {
      psql(`drop trigger if exists fail_reversal_audit_log on payout_batch_audit_log;`);
      psql(`drop function if exists fail_reversal_audit_log_for_test();`);
    }

    // 트리거 제거 후 재호출하면 정상적으로 새 역분개가 만들어진다(이전 실패가
    // 유니크 제약을 선점하지 않았음을 함께 증명).
    const newItemId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 재시도 성공', '${ADMIN_ID}');`);
    expect(
      psql(`select reversed_from_item_id from payout_items where id = '${newItemId}';`)
    ).toBe(itemId);
  });

  it("서로 다른 원본 항목에 대한 동시 역분개 호출은 서로 간섭 없이 모두 성공한다", async () => {
    const itemIdA = createPaidOriginalItem(12);
    const itemIdB = createPaidOriginalItem(13);

    function runReverse(id: string, reason: string): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        const child = spawn("psql", [
          DB_URL,
          "-v",
          "ON_ERROR_STOP=1",
          "-q",
          "-t",
          "-A",
          "-c",
          `select reverse_payout_item('${id}', '${reason}', '${ADMIN_ID}');`,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output: output.trim() }));
      });
    }

    const [a, b] = await Promise.all([
      runReverse(itemIdA, `${RUN_ID} 비간섭 A`),
      runReverse(itemIdB, `${RUN_ID} 비간섭 B`),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.output).not.toBe(b.output);
    expect(psql(`select count(*) from payout_items where reversed_from_item_id = '${itemIdA}';`)).toBe("1");
    expect(psql(`select count(*) from payout_items where reversed_from_item_id = '${itemIdB}';`)).toBe("1");
  });

  // R10 corrective(요구사항 4): mark_payout_batch_failed()가 검토 단계
  // (reviewing/reviewed)에서도 실제로 동작해 PayoutBatchesTab의 버튼 노출과
  // 일치하는지 확인한다.
  it("mark_payout_batch_failed는 reviewing/reviewed 상태에서도 동작한다(UI 버튼과 DB 허용 상태 일치)", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(8);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select submit_payout_batch_for_review('${batchId}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("reviewed");

    psql(`select mark_payout_batch_failed('${batchId}', '${RUN_ID} 검토 중 반려', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("failed");
    expect(psql(`select count(*) from payout_items where batch_id = '${batchId}';`)).toBe("0");
  });

  // R10 corrective(2026-09-07, CHECK 제약 보강 — 20261225000000): CHECK 제약은
  // 행의 현재 컬럼만 볼 수 있어 OLD.status를 검사할 수 없다. 특권 직접 UPDATE가
  // approved -> paid를 한 문장으로 실행하면서 provider_transaction_id·
  // provider_confirmed_at까지 같은 문장에서 채우면 CHECK만으로는 막을 수 없었다
  // — 이 트리거(payout_batches_paid_transition_guard)가 OLD.status=provider_pending을
  // 구조적으로 강제하는지 검증한다.
  it("트리거가 direct UPDATE로 approved->paid를 확인 컬럼과 함께 한 문장에 넣어도 거부한다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(9);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    // 게이트 상태와 무관하게(CHECK를 우회하려는 시도이지 게이트 우회 시도가
    // 아니므로 게이트는 닫힌 채로 둔다) 확인 컬럼까지 한 문장에서 채워서
    // approved -> paid 직접 UPDATE를 시도한다.
    expect(() =>
      psql(
        `update payout_batches set status = 'paid', provider_transaction_id = 'shortcut-tx', provider_confirmed_at = now() where id = '${batchId}';`
      )
    ).toThrow(/provider_pending 상태에서만 paid로 전이할 수 있습니다/);

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    expect(psql(`select provider_transaction_id is null from payout_batches where id = '${batchId}';`)).toBe(
      "t"
    );
  });

  // 이전 라운드 CHECK 제약(provider_pending이지만 확인 컬럼 누락)이 새 트리거와
  // 나란히 있어도 여전히 통과하는지(둘 다 독립적으로 paid를 막는지) 재확인한다.
  it("트리거가 추가된 뒤에도 provider_pending + 확인 컬럼 누락 조합은 CHECK가 그대로 거부한다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(10);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-partial');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      // provider_pending이므로 트리거의 OLD.status 검사는 통과하지만,
      // provider_confirmed_at이 없어 CHECK가 여전히 거부해야 한다.
      expect(() =>
        psql(`update payout_batches set status = 'paid' where id = '${batchId}';`)
      ).toThrow(/payout_batches_paid_requires_confirmation/);

      // 함수 경로로도 동일하게 거부(20261224000000의 기존 가드, 재확인).
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /제공자 최종 성공 확인/
      );
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(2026-09-07): 정규 파이프라인(provider_pending -> confirmed ->
  // paid)이 트리거가 추가된 뒤에도 end-to-end로 정상 동작하는지 재확인한다.
  it("정규 파이프라인(provider_pending -> provider_confirmed -> paid)은 트리거가 있어도 end-to-end로 성공한다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(1);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-e2e');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);

      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("paid");
      expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("paid");
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(2026-09-07, CHECK 제약 보강): payout_items 단독 직접 UPDATE로
  // batch와 무관하게(또는 batch가 아직 paid가 아닌 상태에서) paid로 만드는 시도가
  // 트리거(payout_items_paid_transition_guard)에 의해 거부되는지 검증한다.
  it("payout_items를 batch와 독립적으로(또는 batch가 paid이기 전에) 직접 paid로 만들면 거부된다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(2);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const itemId = psql(`select id from payout_items where batch_id = '${batchId}';`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    // batch는 여전히 approved(paid 아님) — item만 직접 paid로 바꾸려는 시도.
    expect(() =>
      psql(
        `update payout_items set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${itemId}';`
      )
    ).toThrow(/부모 payout_batch가 이미 paid 상태일 때만/);
    expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("approved");

    // batch를 정규 파이프라인으로 paid까지 올려도, batch UPDATE와 별개의 트랜잭션에서
    // item만 뒤늦게 직접 paid로 바꾸려는 시도는 여전히 막혀야 한다는 것을 보여주기
    // 위해, 이번에는 batch를 provider_pending까지만 두고(아직 paid 아님) item을
    // 직접 paid로 바꿔본다 — 부모가 provider_pending일 뿐이라 여전히 거부되어야 한다.
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-item-direct');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      expect(() =>
        psql(
          `update payout_items set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${itemId}';`
        )
      ).toThrow(/부모 payout_batch가 이미 paid 상태일 때만/);
      // item 상태는 dispatch/provider_pending 단계에서는 그대로 approved다
      // (mark_payout_batch_paid만이 item을 paid로 올린다) — 거부된 시도가
      // 이 상태를 바꾸지 않았는지 확인.
      expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("approved");
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(2026-09-07): reverse_payout_item()이 만드는 reversal item도
  // 새 트리거가 있는 상태에서 여전히 정규 파이프라인 없이는 paid로 지름길을
  // 낼 수 없는지(INSERT 시점 및 이후 직접 UPDATE 시도 둘 다) 재확인한다.
  it("reverse_payout_item으로 만든 reversal item도 새 트리거 하에서 정규 파이프라인 없이는 paid 지름길이 없다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(11);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 11);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-rev-orig');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }

    const newItemId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 트리거 재검증', '${ADMIN_ID}');`);
    const [revStatus, revBatchId] = psql(
      `select status, batch_id from payout_items where id = '${newItemId}';`
    ).split("|");
    expect(revStatus).toBe("approved");
    expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("approved");

    // reversal item을 직접 paid로 만들려는 시도 — 부모 batch가 approved일 뿐이므로 거부.
    expect(() =>
      psql(
        `update payout_items set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${newItemId}';`
      )
    ).toThrow(/부모 payout_batch가 이미 paid 상태일 때만/);

    // 부모 batch 자체도 트리거로 인해 approved -> paid 직접 지름길이 불가.
    expect(() =>
      psql(
        `update payout_batches set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${revBatchId}';`
      )
    ).toThrow(/provider_pending 상태에서만 paid로 전이할 수 있습니다/);
  });
});
