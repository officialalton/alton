import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-09-29 오너 규칙(20261912000000): 미팅(meeting_requests)은 배정된 컨설턴트와만 존재하고,
// 같은 컨설턴트의 미팅·상담은 겹칠 수 없다. 실제 로컬 DB(psql). 재실행 안전: 실행 ID 전용 행만 만들고 정리.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = randomUUID().slice(0, 8);
const TAG = `meet-cons-${RUN}`;
const CA = randomUUID();
const CB = randomUUID();
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

beforeAll(() => {
  createUser(CA, "ca", "consultant");
  createUser(CB, "cb", "consultant");
  createUser(GUARDIAN, "g", "parent");
  psql(`insert into parents (id) values ('${GUARDIAN}');
    insert into households (id, primary_guardian_id) values ('${HOUSEHOLD}', '${GUARDIAN}');
    insert into household_members (household_id, profile_id, role, is_primary) values ('${HOUSEHOLD}', '${GUARDIAN}', 'guardian', true);`);
});

afterAll(() => {
  psql(`delete from consultations where admissions_consultant_id in ('${CA}','${CB}');
    delete from meeting_requests where household_id = '${HOUSEHOLD}';
    delete from household_members where household_id = '${HOUSEHOLD}';
    delete from households where id = '${HOUSEHOLD}';
    delete from parents where id = '${GUARDIAN}';
    delete from profiles where id in ('${CA}','${CB}','${GUARDIAN}');
    delete from auth.users where id in ('${CA}','${CB}','${GUARDIAN}');`);
});

describe("meeting_requests 컨설턴트 필수 (DB)", () => {
  it("컨설턴트 없이는 시간·scheduled 를 가질 수 없다(insert/update)", () => {
    expect(psqlErr(`insert into meeting_requests (household_id, requested_by, status, starts_at, ends_at) values ('${HOUSEHOLD}','${GUARDIAN}','requested',${t(0)},${t(1)});`)).toContain("먼저 담당 컨설턴트를 배정해 주세요");
    expect(psqlErr(`insert into meeting_requests (household_id, requested_by, status) values ('${HOUSEHOLD}','${GUARDIAN}','scheduled');`)).toContain("먼저 담당 컨설턴트를 배정해 주세요");
    const id = insertMeeting(null, "requested", null, null);
    expect(psqlErr(`update meeting_requests set starts_at=${t(0)}, ends_at=${t(1)} where id='${id}';`)).toContain("먼저 담당 컨설턴트를 배정해 주세요");
    expect(psqlErr(`update meeting_requests set status='scheduled' where id='${id}';`)).toContain("먼저 담당 컨설턴트를 배정해 주세요");
  });

  it("컨설턴트가 있으면 일정이 잡힌다", () => {
    const id = insertMeeting(CA, "requested", null, null);
    psql(`update meeting_requests set status='scheduled', starts_at=${t(10)}, ends_at=${t(11)} where id='${id}';`);
  });

  it("옛 위반 행: 무관한 수정·취소는 허용, 새 시간 부여는 거절", () => {
    psql(`alter table meeting_requests disable trigger meeting_requests_enforce_consultant;`);
    let id = "";
    try {
      id = insertMeeting(null, "requested", t(20), t(21));
    } finally {
      psql(`alter table meeting_requests enable trigger meeting_requests_enforce_consultant;`);
    }
    psql(`update meeting_requests set subject='memo', google_sync_status='failed', updated_at=now() where id='${id}';`);
    psql(`update meeting_requests set status='cancelled' where id='${id}';`);
    expect(psql(`select starts_at is not null from meeting_requests where id='${id}'`)).toBe("t");
    expect(psqlErr(`update meeting_requests set status='requested', starts_at=${t(22)}, ends_at=${t(23)} where id='${id}';`)).toContain("먼저 담당 컨설턴트를 배정해 주세요");
  });

  it("컨설턴트가 다르면 같은 시간 미팅 가능, 같으면 겹침 거절(미팅↔미팅)", () => {
    insertMeeting(CA, "scheduled", t(30), t(32));
    insertMeeting(CB, "scheduled", t(30), t(32));
    expect(psqlErr(`insert into meeting_requests (household_id, requested_by, status, consultant_id, starts_at, ends_at) values ('${HOUSEHOLD}','${GUARDIAN}','scheduled','${CA}',${t(31)},${t(33)});`)).toContain("다른 미팅과 시간이 겹칩니다");
    insertMeeting(CA, "scheduled", t(32), t(33)); // 맞닿음은 허용
  });

  it("같은 컨설턴트의 상담과 겹치면 거절(미팅↔상담), 다른 컨설턴트는 허용", () => {
    psql(`insert into consultations (source, contact_name, contact_email, contact_phone, category, status, requested_at, admissions_consultant_id, starts_at, ends_at)
      values ('homepage','${TAG}','${TAG}@example.com','010','family','scheduled',now(),'${CA}',${t(40)},${t(41)});`);
    expect(psqlErr(`insert into meeting_requests (household_id, requested_by, status, consultant_id, starts_at, ends_at) values ('${HOUSEHOLD}','${GUARDIAN}','requested','${CA}',${t(40)},${t(41)});`)).toContain("상담 일정과 시간이 겹칩니다");
    insertMeeting(CB, "requested", t(40), t(41));
  });

  it("취소 건은 겹침 검사에서 제외", () => {
    insertMeeting(CA, "cancelled", t(50), t(51));
    insertMeeting(CA, "scheduled", t(50), t(51));
  });
});
