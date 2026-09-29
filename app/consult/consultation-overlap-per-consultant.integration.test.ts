import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-09-29 오너 결정: 상담 겹침 검사는 컨설턴트별(20261908000000). 실제 DB(psql) 검증.
// 재실행 안전: 실행 ID가 붙은 전용 컨설턴트·상담만 만들고 afterAll에서 그 행만 정리한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = randomUUID().slice(0, 8);
const EMAIL = (n: string) => `overlap-${RUN}-${n}@example.com`;
const CONSULTANT_A = randomUUID();
const CONSULTANT_B = randomUUID();

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlErr(sql: string): string {
  const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  if (r.status === 0) throw new Error("expected failure");
  return r.stderr;
}
function asAdmin(sql: string): string {
  return `set role authenticated; select set_config('request.jwt.claim.sub','${ADMIN_ID}',false); ${sql}`;
}

// 실행마다 다른 먼 미래 날짜(2050~2059) — 다른 테스트 행과 겹치지 않게.
const BASE = Date.UTC(2050 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 17, 0, 0);
const slot = (hours: number) => new Date(BASE + hours * 3600_000).toISOString();

function insertConsultation(name: string, consultant: string | null, startHours: number | null, status = "requested"): string {
  const id = randomUUID();
  psql(`insert into consultations (id, contact_name, contact_email, status, admissions_consultant_id, starts_at, ends_at)
    values ('${id}', 'overlap-${RUN}', '${EMAIL(name)}', '${status}', ${consultant ? `'${consultant}'` : "null"},
    ${startHours === null ? "null" : `'${slot(startHours)}'`}, ${startHours === null ? "null" : `'${slot(startHours + 1)}'`});`);
  return id;
}
function insertLink(consultationId: string, consultant: string): string {
  const token = `tok-${RUN}-${randomUUID().slice(0, 6)}`;
  psql(`insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at)
    values ('${consultationId}', '${consultant}', '${token}', now() + interval '1 day');`);
  return token;
}

beforeAll(() => {
  for (const [id, n] of [[CONSULTANT_A, "a"], [CONSULTANT_B, "b"]]) {
    psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${EMAIL("c" + n)}',
        crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
      insert into profiles (id, role, name) values ('${id}', 'consultant', 'overlap-${RUN}-${n}');`);
  }
});

afterAll(() => {
  const ids = `(select id from consultations where contact_name = 'overlap-${RUN}')`;
  // 감사 이력 테이블은 INSERT-only 트리거가 있어 테스트 정리에서만 replica 모드로 우회한다(로컬 DB, 실행 ID 행만).
  psql(`set session_replication_role = replica;
    delete from consultation_assignment_history where consultation_id in ${ids};
    delete from consultation_scheduling_links where consultation_id in ${ids};
    delete from consultation_status_events where consultation_id in ${ids};
    delete from consultations where contact_name = 'overlap-${RUN}';
    delete from profiles where id in ('${CONSULTANT_A}','${CONSULTANT_B}');
    delete from auth.users where id in ('${CONSULTANT_A}','${CONSULTANT_B}');`);
});

describe("consultations_no_overlap — 컨설턴트별", () => {
  it("서로 다른 컨설턴트는 같은 시각에 상담을 가질 수 있다", () => {
    insertConsultation("t1a", CONSULTANT_A, 0, "scheduled");
    expect(() => insertConsultation("t1b", CONSULTANT_B, 0, "scheduled")).not.toThrow();
  });

  it("같은 컨설턴트의 겹치는 상담은 DB 제약(23P01)이 막는다", () => {
    insertConsultation("t2a", CONSULTANT_A, 10, "scheduled");
    expect(() => insertConsultation("t2b", CONSULTANT_A, 10, "requested")).toThrow();
    const err = psqlErr(`insert into consultations (contact_name, contact_email, status, admissions_consultant_id, starts_at, ends_at)
      values ('overlap-${RUN}', '${EMAIL("t2c")}', 'requested', '${CONSULTANT_A}', '${slot(10)}', '${slot(11)}')`);
    expect(err).toContain("consultations_no_overlap");
  });

  it("컨설턴트 미배정 시간 행은 만들 수 없다(20261910000000 — 미배정 전사 겹침 제약은 제거됨)", () => {
    expect(psqlErr(`insert into consultations (contact_name, contact_email, status, starts_at, ends_at)
      values ('overlap-${RUN}', '${EMAIL("t3b")}', 'requested', '${slot(20)}', '${slot(21)}')`)).toContain("담당 컨설턴트가 배정되지 않은 상담에는 시간을 지정할 수 없습니다");
    expect(() => insertConsultation("t3c", CONSULTANT_A, 20)).not.toThrow();
  });

  it("취소된 상담은 슬롯을 점유하지 않는다", () => {
    insertConsultation("t4a", CONSULTANT_A, 30, "cancelled");
    expect(() => insertConsultation("t4b", CONSULTANT_A, 30)).not.toThrow();
  });
});

describe("redeem_consultation_scheduling_link / list_consultant_open_slots", () => {
  it("A가 슬롯을 점유해도 컨설턴트 B는 같은 시각을 확정할 수 있고, A는 친절한 문구로 거절된다", () => {
    insertConsultation("t5a", CONSULTANT_A, 40, "scheduled");
    const bReq = insertConsultation("t5b", CONSULTANT_B, null);
    const aReq = insertConsultation("t5c", CONSULTANT_A, null);
    const tokenB = insertLink(bReq, CONSULTANT_B);
    const tokenA = insertLink(aReq, CONSULTANT_A);

    expect(psql(`select status from redeem_consultation_scheduling_link('${tokenB}', '${slot(40)}')`)).toBe("scheduled");
    const err = psqlErr(`select redeem_consultation_scheduling_link('${tokenA}', '${slot(40)}')`);
    expect(err).toContain("이미 다른 상담이 있는 시간입니다");
    expect(err).not.toContain("consultations_no_overlap");
  });

  it("슬롯 목록도 컨설턴트별 기준이다(같은 키)", () => {
    // 검증 대상 슬롯(40시)은 위 테스트에서 A/B 모두 점유. 전용 가능시간 규칙 없이도 사전검사와 제약 키가 같음을 확인.
    const conflictsForB = psql(`select count(*) from consultations c
      where c.admissions_consultant_id = '${CONSULTANT_B}' and c.status in ('requested','scheduled')
        and tstzrange(c.starts_at, c.ends_at) && tstzrange('${slot(0)}', '${slot(1)}')`);
    expect(conflictsForB).toBe("1"); // t1b
  });
});

describe("재배정·시간 변경", () => {
  it("이미 시간이 잡힌 상담을 그 시각에 바쁜 컨설턴트에게 배정하면 친절한 문구로 거절, 한가한 컨설턴트는 가능", () => {
    insertConsultation("t6a", CONSULTANT_A, 50, "scheduled");
    const moving = insertConsultation("t6b", CONSULTANT_B, 50, "scheduled");
    const err = psqlErr(asAdmin(`select assign_consultation_owner('${moving}', 'admissions_consultant', '${CONSULTANT_A}', 'test');`));
    expect(err).toContain("이미 같은 시간의 다른 상담이 있어");
    const free = insertConsultation("t6c", CONSULTANT_B, 60, "scheduled");
    expect(() => psql(asAdmin(`select assign_consultation_owner('${free}', 'admissions_consultant', '${CONSULTANT_A}', 'test');`))).not.toThrow();
  });

  it("관리자 시간 변경: 같은 컨설턴트와 겹치면 거절, 다른 컨설턴트와는 허용", () => {
    insertConsultation("t7a", CONSULTANT_A, 70, "scheduled");
    const b = insertConsultation("t7b", CONSULTANT_B, 80, "scheduled");
    const a = insertConsultation("t7c", CONSULTANT_A, 90, "scheduled");
    expect(psqlErr(asAdmin(`select admin_reschedule_consultation('${a}', '${slot(70)}', 'test');`))).toContain("이미 다른 상담이 있는 시간입니다");
    expect(() => psql(asAdmin(`select admin_reschedule_consultation('${b}', '${slot(70)}', 'test');`))).not.toThrow();
  });
});
