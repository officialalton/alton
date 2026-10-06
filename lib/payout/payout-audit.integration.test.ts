import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

// 2026-10-06 정산·자동 송금 감사 — 월 2회 정산 전환 뒤 남을 수 있는 충돌을 DB에서 검증한다.
// 실행 ID(RUN)가 붙은 전용 교사·학생 데이터만 쓰고, 종료 시 그 데이터만 지운다. 지급 게이트는
// 트랜잭션 안에서만 열고 롤백한다(실제 송금 없음).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `pa${Date.now().toString(36)}`;
const teachers: string[] = [];
const children: string[] = [];

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function mkUser(label: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
}
function createTeacher(): string {
  const id = mkUser("t");
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '${RUN}교사');`);
  psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  psql(`select set_teacher_rate('${id}'::uuid, 60000, 'KRW', now() - interval '2 years');`);
  teachers.push(id);
  return id;
}
/** 수업 하나 + pending payout item. dateIso는 LA 기준으로도 같은 날이 되는 UTC 17시에 둔다. */
function addLesson(teacher: string, dateIso: string): void {
  const lessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const childId = mkUser("c");
  children.push(childId);
  psql(`insert into profiles (id, role, name) values ('${childId}', 'student', '${RUN}학생');`);
  psql(`insert into students (id, status) values ('${childId}', 'active');`);
  const hh = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${hh}', '${childId}', 'child', true);`);
  const contract = psql(`insert into contracts (household_id, child_id, status) values ('${hh}', '${childId}', 'draft') returning id;`);
  const enr = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', 'eeeeeeee-0000-0000-0000-000000000001', '${contract}', 'active') returning id;`
  );
  const res = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enr}', '${teacher}', '${dateIso}T17:00:00Z', '${dateIso}T18:00:00Z', 'confirmed') returning id;`
  );
  const ses = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, payable_minutes)
     values ('${res}', '${enr}', '${teacher}', '${lessonTypeId}', 60, 'completed', 60) returning id;`
  );
  psql(`select upsert_session_payout_item('${ses}');`);
}
const count = (sql: string) => Number(psql(sql));

afterAll(() => {
  // 승인된 묶음은 scheduled_date_events/audit_log가 INSERT-only라 지울 수 없다(실행 ID 접두 교사로 식별 가능, 기존 통합 테스트와 동일).
  // 승인 전 묶음과 항목만 정리한다.
  for (const t of teachers) {
    try {
      psql(
        `delete from payout_batch_audit_log where batch_id in (select id from payout_batches where teacher_id = '${t}' and status in ('calculated','reviewed','draft','reviewing'));
         update payout_items set batch_id = null where teacher_id = '${t}' and batch_id in (select id from payout_batches where status in ('calculated','reviewed','draft','reviewing'));
         delete from payout_batches where teacher_id = '${t}' and status in ('calculated','reviewed','draft','reviewing');`
      );
    } catch {
      /* 정리 실패는 실행 ID로 구분되므로 무시 */
    }
  }
});

describe("마감 catch-up과 레거시 월 묶음 겹침", () => {
  it("기간 이전의 놓친 미배치 항목은 기본(관리자)은 건드리지 않고, 크론(include_earlier)은 쓸어 담는다", () => {
    const t = createTeacher();
    addLesson(t, "2031-03-05"); // H1 — 마감이 한 번 빠진 항목
    addLesson(t, "2031-03-20"); // H2

    psql(`select * from close_payout_period('2031-03-16', '2031-03-31');`);
    expect(count(`select count(*) from payout_items where teacher_id='${t}' and batch_id is null;`)).toBe(1);

    psql(`select * from close_payout_period('2031-03-16', '2031-03-31');`); // 이미 마감: 멱등
    expect(count(`select count(*) from payout_batches where teacher_id='${t}';`)).toBe(1);

    const rows = psql(`select item_count from close_payout_period('2031-04-01', '2031-04-15', true) where out_teacher_id = '${t}';`);
    expect(rows).toBe("1"); // 놓친 3/5 항목이 다음 마감에 합류
    expect(count(`select count(*) from payout_items where teacher_id='${t}' and batch_id is null;`)).toBe(0);
  });

  it("레거시 월 묶음에 이미 담긴 항목은 반월 마감이 다시 담지 않고, 같은 기간 중복 묶음도 만들지 않는다", () => {
    const t = createTeacher();
    addLesson(t, "2031-06-05");
    addLesson(t, "2031-06-20");
    psql(`select * from close_payout_period('2031-06-01', '2031-06-30');`); // 레거시 월 묶음
    expect(count(`select count(*) from payout_batches where teacher_id='${t}';`)).toBe(1);

    psql(`select * from close_payout_period('2031-06-01', '2031-06-15', true);`);
    psql(`select * from close_payout_period('2031-06-16', '2031-06-30', true);`);
    psql(`select * from close_payout_period('2031-06-16', '2031-06-30', true);`);
    expect(count(`select count(*) from payout_batches where teacher_id='${t}';`)).toBe(1);
    expect(count(`select count(*) from payout_items where batch_id in (select id from payout_batches where teacher_id='${t}');`)).toBe(2);
  });

  it("같은 교사·같은 반월 기간은 재실행해도 열린 묶음 하나만 쓴다", () => {
    const t = createTeacher();
    addLesson(t, "2031-09-02");
    psql(`select * from close_payout_period('2031-09-01', '2031-09-15', true);`);
    addLesson(t, "2031-09-10");
    psql(`select * from close_payout_period('2031-09-01', '2031-09-15', true);`);
    expect(count(`select count(*) from payout_batches where teacher_id='${t}';`)).toBe(1);
    expect(count(`select count(*) from payout_items where teacher_id='${t}' and batch_id is not null;`)).toBe(2);
  });
});

describe("자동 송금 대상·중복 송금 방지", () => {
  function approvedBatch(date: string, scheduled: string): string {
    const t = createTeacher();
    addLesson(t, date);
    psql(`select * from close_payout_period('${date.slice(0, 7)}-01', '${date.slice(0, 7)}-15', true) where out_teacher_id = '${t}';`);
    const id = psql(`select id from payout_batches where teacher_id='${t}';`);
    psql(`select approve_payout_batch('${id}'::uuid, '${ADMIN_ID}'::uuid);`);
    psql(`update payout_batches set scheduled_payout_date = '${scheduled}' where id = '${id}';`);
    return id;
  }

  it("기본 기준일은 LA 날짜이고, 미래 예정일은 대상이 아니며 과거(놓친) 예정일은 대상이다", () => {
    const past = approvedBatch("2031-11-03", "2031-11-20");
    const today = psql(`select (now() at time zone 'America/Los_Angeles')::date;`);
    const future = psql(`select ((now() at time zone 'America/Los_Angeles')::date + 1);`);
    psql(`update payout_batches set scheduled_payout_date = '2020-01-06' where id = '${past}';`);
    const fut = approvedBatch("2031-12-03", future);
    const due = (id: string) => count(`select count(*) from list_due_auto_dispatch_batches() where batch_id = '${id}';`);
    expect(due(past)).toBe(1); // 크론이 며칠 빠졌어도 다음 실행에 따라잡는다
    expect(due(fut)).toBe(0);
    psql(`update payout_batches set scheduled_payout_date = '${today}' where id = '${fut}';`);
    expect(due(fut)).toBe(1);
  });

  it("dispatch를 두 번 호출해도 같은 멱등키 하나만 발급되고 감사 로그는 한 줄이다(게이트는 트랜잭션 안에서만 연다)", () => {
    const id = approvedBatch("2032-01-04", "2020-01-06");
    const out = psql(
      `begin;
       update payout_disbursement_gate set real_disbursement_enabled = true where id = true;
       select dispatch_payout_batch('${id}'::uuid, 'wise', null);
       select dispatch_payout_batch('${id}'::uuid, 'wise', null);
       select count(*) from payout_batch_audit_log where batch_id = '${id}' and action = 'dispatch_requested';
       rollback;`
    ).split("\n");
    const keys = out.filter((l) => /^[0-9a-f-]{36}$/.test(l));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(out[out.length - 1]).toBe("1");
    // 롤백했으므로 묶음은 그대로 approved, 키 없음.
    expect(psql(`select status, dispatch_idempotency_key is null from payout_batches where id='${id}';`)).toBe("approved|t");
  });

  it("이미 dispatch된 묶음은 다시 대상에 오르지 않는다", () => {
    const id = approvedBatch("2032-02-03", "2020-01-06");
    psql(`update payout_batches set dispatch_idempotency_key = gen_random_uuid() where id = '${id}';`);
    expect(count(`select count(*) from list_due_auto_dispatch_batches() where batch_id = '${id}';`)).toBe(0);
  });
});

describe("승인 마감(08:00 LA)과 크론 실행 시각의 정합", () => {
  it("크론(17:00 UTC = LA 09:00/10:00)은 08:00 LA 전 승인분을 같은 날 처리하고, 이후 승인분은 다음 슬롯이다", () => {
    // 2026-10-20(PDT, UTC-7): 08:00 LA = 15:00Z, 크론 17:00Z = 10:00 LA.
    const row = psql(
      `select next_scheduled_payout_date('2026-10-20T14:59:00Z'::timestamptz), next_scheduled_payout_date('2026-10-20T15:01:00Z'::timestamptz),
              next_scheduled_payout_date('2027-01-05T15:59:00Z'::timestamptz), next_scheduled_payout_date('2027-01-05T16:01:00Z'::timestamptz);`
    );
    // 2027-01-05(PST, UTC-8): 08:00 LA = 16:00Z, 크론 17:00Z = 09:00 LA — 둘 다 마감 뒤에 돈다.
    expect(row).toBe("2026-10-20|2026-11-05|2027-01-05|2027-01-20");
  });
});
