import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-09-29(20261913000000): 관리자 미팅 담당 컨설턴트 배정 + 상담↔미팅 대칭 겹침 금지 + 슬롯 목록 제외.
// 실제 로컬 DB(psql). 재실행 안전: 실행 ID 전용 컨설턴트·가족·관리자만 만들고 정리한다. 외부 호출 없음.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = randomUUID().slice(0, 8);
const TAG = `meet-assign-${RUN}`;
const CA = randomUUID();
const CB = randomUUID();
const ADMIN = randomUUID();
const GUARDIAN = randomUUID();
const HOUSEHOLD = randomUUID();

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlErr(sql: string): string {
  const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  if (r.status === 0) throw new Error(`expected failure but succeeded: ${sql.slice(0, 80)}`);
  return r.stderr;
}
// 로그인 사용자(auth.uid())로 실행 — 서버 액션이 쓰는 세션 클라이언트와 같은 조건.
const asUser = (id: string, sql: string) =>
  `select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', true); set local role authenticated; ${sql}`;

const BASE = Date.UTC(2060 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 3, 0, 0);
const t = (h: number) => `'${new Date(BASE + h * 3600_000).toISOString()}'`;

function createUser(id: string, label: string, role: string) {
  psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${TAG}-${label}@example.com',
      crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
    insert into profiles (id, role, name) values ('${id}', '${role}', '${TAG}-${label}');`);
}
const insertMeeting = (consultant: string | null, status: string, s: string | null, e: string | null) =>
  psql(`insert into meeting_requests (household_id, requested_by, status, consultant_id, starts_at, ends_at)
    values ('${HOUSEHOLD}', '${GUARDIAN}', '${status}', ${consultant ? `'${consultant}'` : "null"}, ${s ?? "null"}, ${e ?? "null"}) returning id;`).split("\n")[0];
const insertConsultation = (consultant: string, status: string, s: string | null, e: string | null) =>
  psql(`insert into consultations (source, contact_name, contact_email, contact_phone, category, status, requested_at, admissions_consultant_id, starts_at, ends_at)
    values ('homepage','${TAG}','${TAG}@example.com','010','family','${status}',now(),'${consultant}',${s ?? "null"},${e ?? "null"}) returning id;`).split("\n")[0];
const assign = (actor: string, meeting: string, consultant: string) =>
  asUser(actor, `select admin_assign_meeting_consultant('${meeting}','${consultant}','test');`);

beforeAll(() => {
  createUser(CA, "ca", "consultant");
  createUser(CB, "cb", "consultant");
  createUser(ADMIN, "admin", "admin");
  createUser(GUARDIAN, "g", "parent");
  psql(`insert into parents (id) values ('${GUARDIAN}');
    insert into households (id, primary_guardian_id) values ('${HOUSEHOLD}', '${GUARDIAN}');
    insert into household_members (household_id, profile_id, role, is_primary) values ('${HOUSEHOLD}', '${GUARDIAN}', 'guardian', true);`);
});

afterAll(() => {
  psql(`delete from consultations where admissions_consultant_id in ('${CA}','${CB}');
    delete from consult_availability_rules where consultant_id in ('${CA}','${CB}');
    delete from meeting_requests where household_id = '${HOUSEHOLD}';
    delete from household_members where household_id = '${HOUSEHOLD}';
    delete from households where id = '${HOUSEHOLD}';
    delete from parents where id = '${GUARDIAN}';
    delete from profiles where id in ('${CA}','${CB}','${GUARDIAN}','${ADMIN}');
    delete from auth.users where id in ('${CA}','${CB}','${GUARDIAN}','${ADMIN}');`);
});

describe("미팅 담당 컨설턴트 배정 (DB RPC)", () => {
  it("관리자 배정 → 시간·이벤트는 생기지 않고, 이후 일정 확정이 가능해진다 + 이력", () => {
    const id = insertMeeting(null, "requested", null, null);
    expect(psqlErr(`update meeting_requests set status='scheduled', starts_at=${t(0)}, ends_at=${t(1)} where id='${id}';`)).toContain("Please assign a consultant first");
    psql(assign(ADMIN, id, CA));
    expect(psql(`select consultant_id = '${CA}' and starts_at is null and google_event_id is null from meeting_requests where id='${id}'`)).toBe("t");
    psql(`update meeting_requests set status='scheduled', starts_at=${t(0)}, ends_at=${t(1)} where id='${id}';`);
    expect(psql(`select count(*) from meeting_request_assignment_history where meeting_request_id='${id}' and new_consultant_id='${CA}' and prior_consultant_id is null and actor_id='${ADMIN}'`)).toBe("1");
  });

  it("확정 전에는 담당자 변경 가능, 확정·종료 후에는 거절", () => {
    const id = insertMeeting(CA, "confirming", null, null);
    psql(assign(ADMIN, id, CB));
    expect(psql(`select consultant_id = '${CB}' from meeting_requests where id='${id}'`)).toBe("t");
    expect(psql(`select count(*) from meeting_request_assignment_history where meeting_request_id='${id}'`)).toBe("1");
    const sched = insertMeeting(CA, "scheduled", t(100), t(101));
    expect(psqlErr(assign(ADMIN, sched, CB))).toContain("이미 일정이 확정되었거나 종료된");
    const done = insertMeeting(CA, "cancelled", null, null);
    expect(psqlErr(assign(ADMIN, done, CB))).toContain("이미 일정이 확정되었거나 종료된");
  });

  it("관리자가 아니면 배정할 수 없다(컨설턴트 본인·보호자)", () => {
    const id = insertMeeting(null, "requested", null, null);
    expect(psqlErr(assign(CA, id, CA))).toContain("관리자만");
    expect(psqlErr(assign(GUARDIAN, id, CA))).toContain("관리자만");
    expect(psql(`select consultant_id is null from meeting_requests where id='${id}'`)).toBe("t");
  });

  it("컨설턴트가 아닌 계정·없는 미팅은 거절", () => {
    const id = insertMeeting(null, "requested", null, null);
    expect(psqlErr(assign(ADMIN, id, GUARDIAN))).toContain("컨설턴트를 찾을 수 없습니다");
    expect(psqlErr(assign(ADMIN, randomUUID(), CA))).toContain("미팅 요청을 찾을 수 없습니다");
  });

  it("옛 시간 보유 미팅: 충돌하는 컨설턴트로의 배정은 거절, 비충돌은 허용(미팅·상담 둘 다)", () => {
    psql(`alter table meeting_requests disable trigger meeting_requests_enforce_consultant;`);
    let legacy = "";
    try {
      legacy = insertMeeting(null, "requested", t(200), t(202));
    } finally {
      psql(`alter table meeting_requests enable trigger meeting_requests_enforce_consultant;`);
    }
    insertMeeting(CA, "scheduled", t(201), t(203));
    expect(psqlErr(assign(ADMIN, legacy, CA))).toContain("overlaps another meeting");
    insertConsultation(CB, "scheduled", t(200), t(201));
    expect(psqlErr(assign(ADMIN, legacy, CB))).toContain("overlaps a consultation");
    expect(psql(`select consultant_id is null and starts_at is not null from meeting_requests where id='${legacy}'`)).toBe("t"); // 옛 행 그대로
  });
});

describe("상담 ↔ 미팅 대칭 겹침 (DB)", () => {
  it("같은 컨설턴트: 미팅이 있는 시간에 상담 거절(insert/update), 맞닿음 허용", () => {
    insertMeeting(CA, "scheduled", t(300), t(302));
    expect(psqlErr(`insert into consultations (source, contact_name, contact_email, contact_phone, category, status, requested_at, admissions_consultant_id, starts_at, ends_at)
      values ('homepage','${TAG}','${TAG}@example.com','010','family','scheduled',now(),'${CA}',${t(301)},${t(303)});`)).toContain("overlaps another meeting");
    const c = insertConsultation(CA, "requested", null, null);
    expect(psqlErr(`update consultations set starts_at=${t(301)}, ends_at=${t(302)}, status='scheduled' where id='${c}';`)).toContain("overlaps another meeting");
    psql(`update consultations set starts_at=${t(302)}, ends_at=${t(303)}, status='scheduled' where id='${c}';`); // 맞닿음
  });

  it("상담을 다른 컨설턴트에서 겹치는 컨설턴트로 재배정하면 거절", () => {
    insertMeeting(CB, "scheduled", t(310), t(311));
    const c = insertConsultation(CA, "scheduled", t(310), t(311));
    expect(psqlErr(`update consultations set admissions_consultant_id='${CB}' where id='${c}';`)).toContain("overlaps another meeting");
  });

  it("다른 컨설턴트는 겹쳐도 허용, 취소된 미팅은 무시", () => {
    insertMeeting(CA, "scheduled", t(320), t(321));
    insertConsultation(CB, "scheduled", t(320), t(321));
    insertMeeting(CA, "cancelled", t(330), t(331));
    insertConsultation(CA, "scheduled", t(330), t(331));
  });

  it("옛 겹침 행은 무관한 수정으로 막히지 않는다(트리거는 새 쓰기 컬럼에만)", () => {
    psql(`alter table consultations disable trigger consultations_no_meeting_overlap;`);
    let c = "";
    try {
      insertMeeting(CA, "scheduled", t(340), t(341));
      c = insertConsultation(CA, "scheduled", t(340), t(341));
    } finally {
      psql(`alter table consultations enable trigger consultations_no_meeting_overlap;`);
    }
    psql(`update consultations set updated_at=now() where id='${c}';`);
    expect(psql(`select starts_at is not null from consultations where id='${c}'`)).toBe("t");
  });
});

describe("고객 예약 슬롯 목록 (list_consultant_open_slots)", () => {
  it("컨설턴트의 활성 미팅과 겹치는 슬롯은 숨겨진다, 취소된 미팅은 숨기지 않는다", () => {
    const [slot0, weekday] = psql(
      `select (((${t(0)}::timestamptz at time zone 'America/Los_Angeles')::date + time '09:00')::timestamp at time zone 'America/Los_Angeles')::text || '|' ||
        extract(dow from (${t(0)}::timestamptz at time zone 'America/Los_Angeles')::date)::int`
    ).split("|");
    psql(`insert into consult_availability_rules (weekday, start_time, end_time, consultant_id) values (${weekday}, '09:00', '11:00', '${CA}');`);
    const c = insertConsultation(CA, "requested", null, null);
    const token = `tok-${RUN}`;
    psql(`insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at) values ('${c}','${CA}','${token}', now() + interval '1 day');`);
    const list = () =>
      psql(`select coalesce(string_agg(slot_starts_at::text, ',' order by slot_starts_at), '') from list_consultant_open_slots('${token}',
        '${slot0}'::timestamptz - interval '1 hour', '${slot0}'::timestamptz + interval '3 hours');`).split(",").filter(Boolean);
    const slotStartIso = () => psql(`select '${slot0}'::timestamptz::text`);
    expect(list()).toContain(slotStartIso());
    insertMeeting(CA, "cancelled", `'${slot0}'`, `'${slot0}'::timestamptz + interval '1 hour'`);
    expect(list()).toContain(slotStartIso());
    psql(`insert into meeting_requests (household_id, requested_by, status, consultant_id, starts_at, ends_at)
      values ('${HOUSEHOLD}','${GUARDIAN}','scheduled','${CA}','${slot0}'::timestamptz, '${slot0}'::timestamptz + interval '1 hour');`);
    const after = list();
    expect(after).not.toContain(slotStartIso());
    expect(after.length).toBe(1); // 10:00 슬롯만 남는다
  });
});
