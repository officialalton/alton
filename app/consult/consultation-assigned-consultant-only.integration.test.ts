import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-09-29 오너 규칙(20261910000000): 상담과 상담 시간 슬롯은 고객과 "배정된 컨설턴트" 사이에만
// 존재한다. 공용 슬롯 풀·미배정 확정/시간 보유는 DB가 막는다. 실제 로컬 DB(psql) 검증.
// 재실행 안전: 실행 ID가 붙은 전용 컨설턴트·가족·상담만 만들고 afterAll에서 그 행만 정리한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = randomUUID().slice(0, 8);
const TAG = `assigned-only-${RUN}`;
const EMAIL = (n: string) => `${TAG}-${n}@example.com`;
const CONSULTANT_A = randomUUID();
const CONSULTANT_B = randomUUID();
const GUARDIAN_WITH = randomUUID();
const GUARDIAN_WITHOUT = randomUUID();
const CHILD_WITH = randomUUID();
const CHILD_WITHOUT = randomUUID();
const HOUSEHOLD_WITH = randomUUID();
const HOUSEHOLD_WITHOUT = randomUUID();

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlErr(sql: string): string {
  const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  if (r.status === 0) throw new Error(`expected failure but succeeded: ${sql.slice(0, 80)}`);
  return r.stderr;
}
/** authenticated + 사용자 jwt (RLS·auth.uid() 를 실제로 태운다). */
function asUser(userId: string, sql: string): string {
  return `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'; ${sql} commit;`;
}

const BASE = Date.UTC(2050 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 17, 0, 0);
const slot = (hours: number) => new Date(BASE + hours * 3600_000).toISOString();

function createUser(id: string, label: string, role: string) {
  psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${EMAIL(label)}',
      crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
    insert into profiles (id, role, name) values ('${id}', '${role}', '${TAG}-${label}');`);
}

beforeAll(() => {
  createUser(CONSULTANT_A, "ca", "consultant");
  createUser(CONSULTANT_B, "cb", "consultant");
  createUser(GUARDIAN_WITH, "gw", "parent");
  createUser(GUARDIAN_WITHOUT, "gn", "parent");
  createUser(CHILD_WITH, "kw", "student");
  createUser(CHILD_WITHOUT, "kn", "student");
  psql(`insert into parents (id) values ('${GUARDIAN_WITH}'), ('${GUARDIAN_WITHOUT}');
    insert into households (id, primary_guardian_id) values ('${HOUSEHOLD_WITH}', '${GUARDIAN_WITH}'), ('${HOUSEHOLD_WITHOUT}', '${GUARDIAN_WITHOUT}');
    insert into household_members (household_id, profile_id, role, is_primary) values
      ('${HOUSEHOLD_WITH}', '${GUARDIAN_WITH}', 'guardian', true), ('${HOUSEHOLD_WITH}', '${CHILD_WITH}', 'child', false),
      ('${HOUSEHOLD_WITHOUT}', '${GUARDIAN_WITHOUT}', 'guardian', true), ('${HOUSEHOLD_WITHOUT}', '${CHILD_WITHOUT}', 'child', false);
    insert into consultant_assignments (consultant_id, student_id) values ('${CONSULTANT_A}', '${CHILD_WITH}');
    insert into consult_availability_rules (weekday, start_time, end_time, consultant_id)
      select d, '09:00', '12:00', '${CONSULTANT_A}' from generate_series(0, 6) d;
    insert into consult_availability_rules (weekday, start_time, end_time, consultant_id)
      select d, '13:00', '16:00', '${CONSULTANT_B}' from generate_series(0, 6) d;`);
});

afterAll(() => {
  const cids = `(select id from consultations where contact_name like '${TAG}%')`;
  const ids = `('${CONSULTANT_A}','${CONSULTANT_B}','${GUARDIAN_WITH}','${GUARDIAN_WITHOUT}','${CHILD_WITH}','${CHILD_WITHOUT}')`;
  // 감사 이력 테이블은 INSERT-only 트리거가 있어 테스트 정리에서만 replica 모드로 우회한다(로컬 DB, 실행 ID 행만).
  psql(`set session_replication_role = replica;
    delete from consultation_assignment_history where consultation_id in ${cids};
    delete from consultation_scheduling_links where consultation_id in ${cids};
    delete from consultation_status_events where consultation_id in ${cids};
    delete from consultations where contact_name like '${TAG}%';
    delete from prospect_contacts where full_name like '${TAG}%';
    delete from meeting_requests where household_id in ('${HOUSEHOLD_WITH}','${HOUSEHOLD_WITHOUT}');
    delete from consult_availability_rules where consultant_id in ('${CONSULTANT_A}','${CONSULTANT_B}');
    delete from consultant_assignments where consultant_id in ('${CONSULTANT_A}','${CONSULTANT_B}');
    delete from household_members where household_id in ('${HOUSEHOLD_WITH}','${HOUSEHOLD_WITHOUT}');
    delete from households where id in ('${HOUSEHOLD_WITH}','${HOUSEHOLD_WITHOUT}');
    delete from parents where id in ('${GUARDIAN_WITH}','${GUARDIAN_WITHOUT}');
    delete from profiles where id in ${ids};
    delete from auth.users where id in ${ids};`);
});

function insertConsultation(name: string, consultant: string | null, startHours: number | null, status: string): string {
  const id = randomUUID();
  psql(`insert into consultations (id, contact_name, contact_email, status, admissions_consultant_id, starts_at, ends_at)
    values ('${id}', '${TAG}', '${EMAIL(name)}', '${status}', ${consultant ? `'${consultant}'` : "null"},
    ${startHours === null ? "null" : `'${slot(startHours)}'`}, ${startHours === null ? "null" : `'${slot(startHours + 1)}'`});`);
  return id;
}

describe("DB 강제: 컨설턴트 없이 확정·시간 보유 불가", () => {
  it("컨설턴트 없는 scheduled 는 시간이 없어도 거절된다", () => {
    expect(psqlErr(`insert into consultations (contact_name, contact_email, status) values ('${TAG}', '${EMAIL("s1")}', 'scheduled')`)).toContain(
      "A consultation without an assigned consultant cannot be confirmed"
    );
  });

  it("컨설턴트 없이 시간이 있는 requested 는 거절되고, 시간 없는 requested 는 허용된다", () => {
    expect(
      psqlErr(`insert into consultations (contact_name, contact_email, status, starts_at, ends_at)
        values ('${TAG}', '${EMAIL("s2")}', 'requested', '${slot(1)}', '${slot(2)}')`)
    ).toContain("A time cannot be set on a consultation");
    expect(() => insertConsultation("s3", null, null, "requested")).not.toThrow();
  });

  it("컨설턴트가 있으면 scheduled·시간 모두 허용된다", () => {
    expect(() => insertConsultation("s4", CONSULTANT_A, 3, "scheduled")).not.toThrow();
  });

  it("미배정 requested 를 수락(scheduled)하거나 시간을 넣으면 거절된다 — 배정 후에만 가능", () => {
    const id = insertConsultation("s5", null, null, "requested");
    expect(psqlErr(`update consultations set status = 'scheduled' where id = '${id}'`)).toContain("cannot be confirmed");
    expect(psqlErr(`update consultations set starts_at = '${slot(5)}', ends_at = '${slot(6)}' where id = '${id}'`)).toContain("A time cannot be set on a consultation");
    psql(`update consultations set admissions_consultant_id = '${CONSULTANT_A}' where id = '${id}'`);
    expect(() => psql(`update consultations set starts_at = '${slot(5)}', ends_at = '${slot(6)}', status = 'scheduled' where id = '${id}'`)).not.toThrow();
  });

  it("종료 상태의 옛 행(시간 있음·미배정)은 그대로 유지·수정된다(이력 보존)", () => {
    expect(() => insertConsultation("s6", null, 8, "completed")).not.toThrow();
    expect(() => insertConsultation("s7", null, 9, "cancelled")).not.toThrow();
    // 취소 상태 행의 무관한 컬럼 수정은 트리거를 태우지 않는다.
    expect(() => psql(`update consultations set concerns = 'x' where contact_email = '${EMAIL("s7")}'`)).not.toThrow();
  });

  it("미배정 전사 겹침 제약은 제거됐고 컨설턴트별 제약만 남는다", () => {
    const names = psql(`select conname from pg_constraint where conrelid = 'consultations'::regclass and contype = 'x' order by 1`);
    expect(names).toBe("consultations_no_overlap");
  });
});

describe("제거된 공용 슬롯 RPC", () => {
  const removed = [
    "select * from list_open_consult_slots(now(), now() + interval '7 days')",
    "select * from list_open_meeting_slots(now(), now() + interval '7 days')",
    `select submit_guardian_portal_consult_request('${HOUSEHOLD_WITH}', '${GUARDIAN_WITH}', 'x', 'x@example.com', now() + interval '2 days', '[{"name":"a"}]'::jsonb, null)`,
  ];
  for (const role of ["anon", "authenticated"]) {
    it(`${role} 는 호출할 수 없다(함수 자체가 없다)`, () => {
      for (const q of removed) {
        expect(psqlErr(`set role ${role}; ${q};`)).toMatch(/does not exist/);
      }
    });
  }
  it("함수가 실제로 catalog 에서 사라졌다", () => {
    expect(
      psql(`select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('list_open_consult_slots','list_open_meeting_slots','submit_guardian_portal_consult_request')`)
    ).toBe("0");
  });
});

describe("홈페이지 신청은 시간을 갖지 않는다", () => {
  it("시간을 보내면 거절되고, 시간 없이 보내면 시간 없는 requested 로 접수된다", () => {
    const err = psqlErr(`select submit_homepage_consult_request('${TAG}-h1', '${EMAIL("h1")}', null, '${slot(20)}', '고1', null, null)`);
    expect(err).toContain("A consultation time cannot be chosen when submitting the request. Please choose a time from the link sent after a consultant is assigned.");
    const row = psql(
      `select status || '|' || coalesce(starts_at::text, 'null') from submit_homepage_consult_request('${TAG}-h2', '${EMAIL("h2")}', null, null, '고1', null, null)`
    );
    expect(row).toBe("requested|null");
  });

  it("anon/authenticated 는 홈페이지 RPC 를 직접 호출할 수 없다(서버 액션 service_role 전용)", () => {
    for (const role of ["anon", "authenticated"]) {
      expect(psqlErr(`set role ${role}; select submit_homepage_consult_request('${TAG}-h3', '${EMAIL("h3")}', null, null, null, null, null)`)).toMatch(/permission denied/);
    }
  });
});

describe("보호자 포털: 배정된 컨설턴트의 슬롯만", () => {
  const RANGE = "now(), now() + interval '8 days'";

  it("담당 컨설턴트가 있는 보호자는 그 컨설턴트 슬롯만 본다(다른 컨설턴트 슬롯은 조회 불가)", () => {
    const own = psql(asUser(GUARDIAN_WITH, `select count(*) from list_open_consultant_meeting_slots('${CONSULTANT_A}', ${RANGE});`));
    expect(Number(own)).toBeGreaterThan(0);
    // A 의 규칙은 09~12시(3칸/일), B 의 규칙은 13~16시 — B 의 슬롯을 물으면 거절.
    const err = psqlErr(asUser(GUARDIAN_WITH, `select count(*) from list_open_consultant_meeting_slots('${CONSULTANT_B}', ${RANGE});`));
    expect(err).toContain("Only the assigned consultant's available times can be viewed.");
  });

  it("담당 컨설턴트가 없는 보호자는 어떤 컨설턴트의 슬롯도 조회할 수 없다", () => {
    for (const c of [CONSULTANT_A, CONSULTANT_B]) {
      expect(psqlErr(asUser(GUARDIAN_WITHOUT, `select count(*) from list_open_consultant_meeting_slots('${c}', ${RANGE});`))).toContain("assigned consultant");
    }
  });

  it("컨설턴트 본인은 자기 슬롯을 볼 수 있다", () => {
    expect(Number(psql(asUser(CONSULTANT_B, `select count(*) from list_open_consultant_meeting_slots('${CONSULTANT_B}', ${RANGE});`)))).toBeGreaterThan(0);
  });

  it("담당 컨설턴트가 없는 보호자는 시간 있는 면담 요청을 만들 수 없고, 시간 없는 요청은 관리자 큐(미배정)로 들어간다", () => {
    expect(
      psqlErr(
        asUser(
          GUARDIAN_WITHOUT,
          `insert into meeting_requests (household_id, requested_by, content, starts_at, ends_at)
           values ('${HOUSEHOLD_WITHOUT}', '${GUARDIAN_WITHOUT}', '${TAG}', now() + interval '3 days', now() + interval '3 days 1 hour');`
        )
      )
    ).toMatch(/row-level security|Please assign a consultant first\. A meeting without an assigned consultant cannot be scheduled\./); // 20261912000000 트리거가 RLS 보다 먼저 거절
    psql(
      asUser(
        GUARDIAN_WITHOUT,
        `insert into meeting_requests (household_id, requested_by, content) values ('${HOUSEHOLD_WITHOUT}', '${GUARDIAN_WITHOUT}', '${TAG}');`
      )
    );
    expect(psql(`select count(*) from meeting_requests where household_id = '${HOUSEHOLD_WITHOUT}' and consultant_id is null and starts_at is null and status = 'requested'`)).toBe("1");
  });

  it("담당 컨설턴트가 있는 보호자는 그 컨설턴트를 지정해 시간 있는 요청을 만들 수 있고, 다른 컨설턴트 지정은 거절된다", () => {
    expect(() =>
      psql(
        asUser(
          GUARDIAN_WITH,
          `insert into meeting_requests (household_id, child_id, consultant_id, requested_by, content, starts_at, ends_at)
           values ('${HOUSEHOLD_WITH}', '${CHILD_WITH}', '${CONSULTANT_A}', '${GUARDIAN_WITH}', '${TAG}', now() + interval '3 days', now() + interval '3 days 1 hour');`
        )
      )
    ).not.toThrow();
    expect(
      psqlErr(
        asUser(
          GUARDIAN_WITH,
          `insert into meeting_requests (household_id, child_id, consultant_id, requested_by, content, starts_at, ends_at)
           values ('${HOUSEHOLD_WITH}', '${CHILD_WITH}', '${CONSULTANT_B}', '${GUARDIAN_WITH}', '${TAG}', now() + interval '4 days', now() + interval '4 days 1 hour');`
        )
      )
    ).toContain("row-level security");
  });
});

describe("기존 컨설턴트 스케줄링 링크 흐름은 그대로 동작한다", () => {
  it("배정된 컨설턴트의 링크로 슬롯을 확정하면 scheduled 가 된다", () => {
    const id = insertConsultation("r1", CONSULTANT_A, null, "requested");
    const token = `tok-${RUN}-${randomUUID().slice(0, 6)}`;
    psql(`insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at)
      values ('${id}', '${CONSULTANT_A}', '${token}', now() + interval '1 day');`);
    expect(psql(`select status from redeem_consultation_scheduling_link('${token}', '${slot(40)}')`)).toBe("scheduled");
    expect(psql(`select admissions_consultant_id::text from consultations where id = '${id}'`)).toBe(CONSULTANT_A);
  });
});
