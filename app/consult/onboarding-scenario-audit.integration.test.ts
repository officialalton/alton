import { execFile, execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPerRunTeacher } from "@/test/per-run-teacher";
import { insertReservationInBand } from "@/test/reservation-slots";

// 2026-09-29 온보딩 시나리오 감사(docs/qa/2026-09-29-onboarding-scenarios.md) 회귀 테스트.
// 실제 로컬 DB(psql)로 검증한다. 실행 ID 가 붙은 전용 컨설턴트·관리자·가족·상담만 만들고
// afterAll 에서 그 행만 정리한다(재실행 안전). 외부 서비스(Google·DocuSign·메일) 호출은 없다.

const execFileAsync = promisify(execFile);
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = randomUUID().slice(0, 8);
const TAG = `scn-audit-${RUN}`;
const EMAIL = (n: string) => `${TAG}-${n}@example.com`;
const ADMIN = randomUUID();
const CONS_A = randomUUID();
const CONS_B = randomUUID();
const GUARDIAN = randomUUID();
const KID = randomUUID();
const KID2 = randomUUID();
const HOUSEHOLD = randomUUID();
let TEACHER_ID: string;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlErr(sql: string): string {
  const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  if (r.status === 0) throw new Error(`expected failure but succeeded: ${sql.slice(0, 100)}`);
  return r.stderr;
}
async function psqlAsync(sql: string): Promise<string> {
  const { stdout } = await execFileAsync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  return stdout.trim();
}
const asUser = (userId: string, sql: string) =>
  `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'; ${sql} commit;`;

// 파일 전용 먼 미래 날짜(다른 테스트와 겹치지 않도록 무작위).
const BASE = Date.UTC(2060 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 17, 0, 0);
const at = (hours: number) => new Date(BASE + hours * 3600_000).toISOString();

function createUser(id: string, label: string, role: string) {
  psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${EMAIL(label)}',
      crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
    insert into profiles (id, role, name) values ('${id}', '${role}', '${TAG}-${label}');`);
}

beforeAll(() => {
  createUser(ADMIN, "adm", "admin");
  createUser(CONS_A, "ca", "consultant");
  createUser(CONS_B, "cb", "consultant");
  createUser(GUARDIAN, "g", "parent");
  createUser(KID, "k1", "student");
  createUser(KID2, "k2", "student");
  psql(`insert into parents (id) values ('${GUARDIAN}');
    insert into households (id, primary_guardian_id) values ('${HOUSEHOLD}', '${GUARDIAN}');
    insert into household_members (household_id, profile_id, role, is_primary) values
      ('${HOUSEHOLD}', '${GUARDIAN}', 'guardian', true), ('${HOUSEHOLD}', '${KID}', 'child', false), ('${HOUSEHOLD}', '${KID2}', 'child', false);
    insert into students (id, grade, status) values ('${KID}', '10', 'pending'), ('${KID2}', '11', 'pending');
    insert into consult_availability_rules (weekday, start_time, end_time, consultant_id)
      select d, '09:00', '12:00', c from generate_series(0, 6) d, (values ('${CONS_A}'::uuid), ('${CONS_B}'::uuid)) v(c);`);
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: TAG });
});

afterAll(() => {
  const cids = `(select id from consultations where contact_name like '${TAG}%')`;
  const users = `('${ADMIN}','${CONS_A}','${CONS_B}','${GUARDIAN}','${KID}','${KID2}')`;
  psql(`set session_replication_role = replica;
    delete from contract_dispatch_jobs where child_id in ('${KID}','${KID2}');
    delete from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id in ('${KID}','${KID2}'));
    delete from entitlement_grants where child_id in ('${KID}','${KID2}');
    delete from consultation_assignment_history where consultation_id in ${cids};
    delete from consultation_scheduling_links where consultation_id in ${cids};
    delete from consultation_status_events where consultation_id in ${cids};
    delete from consultations where contact_name like '${TAG}%';
    delete from prospect_contacts where full_name like '${TAG}%';
    delete from consultant_time_off where consultant_id in ('${CONS_A}','${CONS_B}');
    delete from consult_availability_exceptions where consultant_id in ('${CONS_A}','${CONS_B}');
    delete from consult_availability_rules where consultant_id in ('${CONS_A}','${CONS_B}');
    delete from household_members where household_id = '${HOUSEHOLD}';
    delete from households where id = '${HOUSEHOLD}';
    delete from students where id in ('${KID}','${KID2}');
    delete from parents where id = '${GUARDIAN}';
    delete from profiles where id in ${users};
    delete from auth.users where id in ${users};`);
});

function newConsultation(label: string, o: { consultant?: string | null; status?: string; startH?: number | null; childId?: string | null; outcome?: string | null }): string {
  const id = randomUUID();
  const consultant = o.consultant === undefined ? CONS_A : o.consultant;
  const startH = o.startH === undefined ? null : o.startH;
  psql(`insert into consultations (id, contact_name, contact_email, status, admissions_consultant_id, starts_at, ends_at, child_id, outcome)
    values ('${id}', '${TAG}-${label}', '${EMAIL(label)}', '${o.status ?? "requested"}', ${consultant ? `'${consultant}'` : "null"},
    ${startH === null ? "null" : `'${at(startH)}'`}, ${startH === null ? "null" : `'${at(startH + 1)}'`},
    ${o.childId ? `'${o.childId}'` : "null"}, ${o.outcome ? `'${o.outcome}'` : "null"});`);
  return id;
}
function newLink(consultationId: string, consultant: string): string {
  const token = `tok-${RUN}-${randomUUID().slice(0, 8)}`;
  psql(`insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at)
    values ('${consultationId}', '${consultant}', '${token}', now() + interval '1 day');`);
  return token;
}
const RANGE = (fromH: number, toH: number) => `'${at(fromH)}', '${at(toH)}'`;

describe("B1 — 시간 없는 신청은 수락(scheduled)할 수 없다", () => {
  it("관리자·담당 컨설턴트 모두 거절되고 상태는 requested 로 남는다(예약 링크도 살아 있다)", () => {
    const id = newConsultation("b1", {});
    const token = newLink(id, CONS_A);
    expect(psqlErr(asUser(ADMIN, `select admin_accept_consultation('${id}', null);`))).toContain("상담 시간이 정해지지 않았습니다");
    expect(psqlErr(asUser(CONS_A, `select admin_accept_consultation('${id}', null);`))).toContain("상담 시간이 정해지지 않았습니다");
    expect(psql(`select status from consultations where id = '${id}'`)).toBe("requested");
    // 링크로 시간을 고르면 정상 확정 — 예전에는 유령 scheduled 로 링크가 죽었다.
    expect(psql(`select status from redeem_consultation_scheduling_link('${token}', '${at(30)}')`)).toBe("scheduled");
  });

  it("시간이 있는 requested 는 그대로 수락된다", () => {
    const id = newConsultation("b1-ok", { startH: 200 });
    expect(psql(asUser(CONS_A, `select status from admin_accept_consultation('${id}', null);`)).split("\n")[0]).toBe("scheduled");
  });
});

describe("담당 컨설턴트 권한 경계(RPC)", () => {
  it("담당 컨설턴트는 자기 상담에 결과를 기록하고, 다른 컨설턴트는 거절된다", () => {
    const id = newConsultation("perm", { status: "scheduled", startH: 210 });
    expect(psqlErr(asUser(CONS_B, `select admin_record_consultation_outcome('${id}', 'on_hold', null, '요약');`))).toContain("담당 컨설턴트만");
    expect(psql(asUser(CONS_A, `select outcome from admin_record_consultation_outcome('${id}', 'on_hold', null, '요약');`)).split("\n")[0]).toBe("on_hold");
  });
});

describe("B2 — 결과 기록은 진행된 상담에만", () => {
  it("requested·cancelled 상담에는 기록할 수 없고 체험수업권도 지급되지 않는다", () => {
    const req = newConsultation("b2-req", {});
    const canc = newConsultation("b2-canc", { status: "cancelled", childId: KID });
    for (const id of [req, canc]) {
      expect(psqlErr(asUser(ADMIN, `select admin_record_consultation_outcome('${id}', 'trial_recommended', null, '요약');`))).toContain("일정이 확정되어 진행된 상담에만");
    }
    expect(psql(`select count(*) from entitlement_grants where source_consultation_id = '${canc}'`)).toBe("0");
    expect(psql(`select coalesce(outcome::text,'none') from consultations where id in ('${req}','${canc}') order by contact_name`)).toBe("none\nnone");
  });

  it("이벤트 이력의 previous_status 는 실제 이전 상태다(scheduled → completed)", () => {
    const id = newConsultation("b2-hist", { status: "scheduled", startH: 220 });
    psql(asUser(ADMIN, `select admin_record_consultation_outcome('${id}', 'on_hold', null, '요약');`));
    expect(psql(`select previous_status || '>' || new_status from consultation_status_events where consultation_id = '${id}' and reason like '상담 결과 기록%'`)).toBe("scheduled>completed");
  });
});

describe("B3 — 거절·취소는 진행 전 상담만", () => {
  it("completed·cancelled 상담은 거절/취소할 수 없다(결과·수업권 보존)", () => {
    const done = newConsultation("b3-done", { status: "completed", startH: 230, outcome: "on_hold" });
    const canc = newConsultation("b3-canc", { status: "cancelled" });
    for (const id of [done, canc]) {
      expect(psqlErr(asUser(ADMIN, `select admin_cancel_consultation('${id}', 'x');`))).toContain("진행 전(신청·확정) 상담만");
      expect(psqlErr(asUser(ADMIN, `select admin_reject_consultation('${id}', 'x');`))).toContain("진행 전(신청·확정) 상담만");
    }
    expect(psql(`select status from consultations where id = '${done}'`)).toBe("completed");
  });

  it("requested·scheduled 는 담당 컨설턴트가 거절하고 관리자가 취소할 수 있다", () => {
    const a = newConsultation("b3-a", {});
    const b = newConsultation("b3-b", { status: "scheduled", startH: 240 });
    expect(psql(asUser(CONS_A, `select status from admin_reject_consultation('${a}', 'x');`)).split("\n")[0]).toBe("cancelled");
    expect(psql(asUser(ADMIN, `select status from admin_cancel_consultation('${b}', 'x');`)).split("\n")[0]).toBe("cancelled");
  });
});

describe("B4/B5/B6 — 예약 링크 슬롯·확정 가드", () => {
  it("컨설턴트 휴무(time off)와 닫힌 예외 시간은 슬롯에서 빠지고 확정도 거절된다", () => {
    const id = newConsultation("b4", {});
    const token = newLink(id, CONS_A);
    const slots = psql(`select slot_starts_at::text from list_consultant_open_slots('${token}', ${RANGE(300, 300 + 48)})`).split("\n").filter(Boolean);
    expect(slots.length).toBeGreaterThan(2);
    const [s1, s2] = slots;
    psql(`insert into consultant_time_off (consultant_id, starts_at, ends_at, all_day) values ('${CONS_A}', '${s1}'::timestamptz - interval '10 minutes', '${s1}'::timestamptz + interval '50 minutes', false);`);
    const after = psql(`select slot_starts_at::text from list_consultant_open_slots('${token}', ${RANGE(300, 300 + 48)})`).split("\n").filter(Boolean);
    expect(after).not.toContain(s1);
    expect(after).toContain(s2);
    expect(psqlErr(`select redeem_consultation_scheduling_link('${token}', '${s1}')`)).toContain("The consultant is not available at that time. Please choose a different time.");
    // 닫힌 예외(종일 휴무)도 확정 단계에서 막힌다.
    psql(`insert into consult_availability_exceptions (consultant_id, exception_date, is_closed, reason)
      values ('${CONS_A}', ('${s2}'::timestamptz at time zone 'America/Los_Angeles')::date, true, '${TAG}');`);
    expect(psqlErr(`select redeem_consultation_scheduling_link('${token}', '${s2}')`)).toContain("The consultant is not available at that time. Please choose a different time.");
    expect(psql(`select status from consultations where id = '${id}'`)).toBe("requested");
  });

  it("미팅 슬롯 목록도 휴무·닫힌 예외를 제외한다", () => {
    const list = (from: number, to: number) =>
      psql(`select slot_starts_at::text from list_open_consultant_meeting_slots('${CONS_B}', ${RANGE(from, to)})`).split("\n").filter(Boolean);
    const before = list(400, 448);
    expect(before.length).toBeGreaterThan(2);
    psql(`insert into consultant_time_off (consultant_id, starts_at, ends_at, all_day) values ('${CONS_B}', '${before[0]}'::timestamptz, '${before[0]}'::timestamptz + interval '1 hour', false);`);
    psql(`insert into consult_availability_exceptions (consultant_id, exception_date, is_closed, start_time, end_time, reason)
      values ('${CONS_B}', ('${before[1]}'::timestamptz at time zone 'America/Los_Angeles')::date, true,
        (('${before[1]}'::timestamptz at time zone 'America/Los_Angeles')::time), (('${before[1]}'::timestamptz at time zone 'America/Los_Angeles')::time + interval '1 hour'), '${TAG}');`);
    const after = list(400, 448);
    expect(after).not.toContain(before[0]);
    expect(after).not.toContain(before[1]);
    expect(after).toContain(before[2]);
  });

  it("지난 시각은 확정할 수 없다", () => {
    const id = newConsultation("b5", {});
    const token = newLink(id, CONS_A);
    expect(psqlErr(`select redeem_consultation_scheduling_link('${token}', now() - interval '2 hours')`)).toContain("in the past");
    expect(psql(`select status from consultations where id = '${id}'`)).toBe("requested");
  });

  it("담당 컨설턴트가 바뀐 옛 링크·이미 처리된 상담의 링크는 슬롯 조회부터 무효다", () => {
    const id = newConsultation("b6", {});
    const token = newLink(id, CONS_A);
    expect(Number(psql(`select count(*) from list_consultant_open_slots('${token}', ${RANGE(500, 548)})`))).toBeGreaterThan(0);
    psql(asUser(ADMIN, `select assign_consultation_owner('${id}', 'admissions_consultant', '${CONS_B}', 'qa');`));
    expect(psqlErr(`select * from list_consultant_open_slots('${token}', ${RANGE(500, 548)})`)).toContain("invalid or has expired");
    expect(psqlErr(`select redeem_consultation_scheduling_link('${token}', '${at(505)}')`)).toContain("The assigned consultant has changed, so this link can no longer be used.");
    // 새 컨설턴트 링크는 정상, 취소된 상담의 링크는 무효.
    const token2 = newLink(id, CONS_B);
    expect(Number(psql(`select count(*) from list_consultant_open_slots('${token2}', ${RANGE(500, 548)})`))).toBeGreaterThan(0);
    psql(asUser(ADMIN, `select admin_reject_consultation('${id}', 'qa');`));
    expect(psqlErr(`select * from list_consultant_open_slots('${token2}', ${RANGE(500, 548)})`)).toContain("invalid or has expired");
  });
});

describe("동시 배정 — 두 관리자가 같은 상담을 서로 다른 컨설턴트에게 배정", () => {
  it("둘 다 성공하지 않고 순서가 직렬화되며, 이력의 이전 담당자가 끊기지 않는다", async () => {
    const id = newConsultation("race", { consultant: null });
    const assign = (c: string) => psqlAsync(asUser(ADMIN, `select assign_consultation_owner('${id}', 'admissions_consultant', '${c}', 'race');`));
    const results = await Promise.allSettled([assign(CONS_A), assign(CONS_B)]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const finalOwner = psql(`select admissions_consultant_id::text from consultations where id = '${id}'`);
    expect([CONS_A, CONS_B]).toContain(finalOwner);
    const hist = psql(
      `select coalesce(prior_owner_id::text,'-') || '>' || new_owner_id::text from consultation_assignment_history
       where consultation_id = '${id}' and field = 'admissions_consultant'`
    ).split("\n");
    expect(hist).toHaveLength(2);
    // changed_at 은 트랜잭션 시작 시각이라 락 대기한 쪽이 더 이를 수 있다 — 순서 대신 사슬로 검증한다.
    const rows = hist.map((h) => h.split(">"));
    const first = rows.find((r) => r[0] === "-")!;
    const second = rows.find((r) => r[0] !== "-")!;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second[0]).toBe(first[1]); // 두 번째 배정의 이전 담당자 = 첫 번째 배정의 새 담당자
    expect(second[1]).toBe(finalOwner);
  });
});

describe("계약 자동 발송 큐잉(트리거) — 중복·순서", () => {
  const jobs = (child: string) => psql(`select trigger_type || ':' || status from contract_dispatch_jobs where child_id = '${child}' order by trigger_type`).split("\n").filter(Boolean);

  it("자녀가 없을 때 regular_recommended 를 기록하면 큐잉되지 않고, 자녀가 연결되는 순간 1건만 큐잉된다", () => {
    const id = newConsultation("q1", { status: "scheduled", startH: 600 });
    psql(asUser(ADMIN, `select admin_record_consultation_outcome('${id}', 'regular_recommended', null, '요약');`));
    expect(jobs(KID)).toEqual([]);
    psql(`update consultations set child_id = '${KID}' where id = '${id}'`);
    expect(jobs(KID)).toEqual(["regular_recommended:queued"]);
    // 같은 결과를 다시 기록하거나 무관한 컬럼을 고쳐도, 다른 상담이 같은 자녀를 가리켜도 중복 큐잉되지 않는다.
    psql(asUser(ADMIN, `select admin_record_consultation_outcome('${id}', 'regular_recommended', 'again', '요약2');`));
    psql(`update consultations set concerns = 'x' where id = '${id}'`);
    const other = newConsultation("q1b", { status: "completed", startH: 610, childId: KID, outcome: "regular_recommended" });
    expect(other).toBeTruthy();
    expect(jobs(KID)).toEqual(["regular_recommended:queued"]);
  });

  it("체험 수업 완료는 completed_trial 을 큐잉하고, 같은 자녀의 regular_recommended 와 별개 행으로 공존한다(발송 중복은 워커의 already_sent 로 흡수)", () => {
    psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD}', '${KID2}', 'draft') on conflict do nothing;`);
    const contractId = psql(`select id from contracts where child_id = '${KID2}' limit 1`);
    const enrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status)
       values ('${KID2}', 'eeeeeeee-0000-0000-0000-000000000001', '${contractId}', 'planned') returning id;`
    );
    const trialType = psql(`select id from lesson_types where code = 'trial'`);
    const reservationId = insertReservationInBand(psql, { band: "contract-dispatch-outbox", enrollmentId, teacherId: TEACHER_ID });
    // 상담 결과가 먼저(정규 바로 진행), 이어서 체험 완료가 들어오는 순서.
    newConsultation("q2", { status: "completed", startH: 620, childId: KID2, outcome: "regular_recommended" });
    expect(jobs(KID2)).toEqual(["regular_recommended:queued"]);
    psql(`insert into sessions (reservation_id, teacher_id, subject_enrollment_id, lesson_type_id, final_status, scheduled_duration_minutes)
      values ('${reservationId}', '${TEACHER_ID}', '${enrollmentId}', '${trialType}', 'completed', 60);`);
    expect(jobs(KID2)).toEqual(["completed_trial:queued", "regular_recommended:queued"]);
    // 정규 수업 세션의 완료는 큐잉하지 않는다.
    const regularType = psql(`select id from lesson_types where code = 'regular'`);
    const reservation2 = insertReservationInBand(psql, { band: "contract-dispatch-outbox", enrollmentId, teacherId: TEACHER_ID });
    psql(`insert into sessions (reservation_id, teacher_id, subject_enrollment_id, lesson_type_id, final_status, scheduled_duration_minutes)
      values ('${reservation2}', '${TEACHER_ID}', '${enrollmentId}', '${regularType}', 'completed', 60);`);
    expect(jobs(KID2)).toEqual(["completed_trial:queued", "regular_recommended:queued"]);
  });

  it("claim RPC 는 서비스 역할 전용이며 같은 행을 두 번 집지 않는다", () => {
    const claimed1 = psql(`select count(*) from claim_contract_dispatch_jobs(1000) where child_id in ('${KID}','${KID2}')`);
    const claimed2 = psql(`select count(*) from claim_contract_dispatch_jobs(1000) where child_id in ('${KID}','${KID2}')`);
    expect(Number(claimed1)).toBe(3);
    expect(claimed2).toBe("0");
    expect(psqlErr(asUser(ADMIN, `select * from claim_contract_dispatch_jobs(1);`))).toContain("permission denied");
    psql(`update contract_dispatch_jobs set status = 'queued' where child_id in ('${KID}','${KID2}')`);
  });
});

describe("체험수업권 — 자녀당 1회", () => {
  it("같은 자녀의 두 번째 trial_recommended 는 새 수업권을 만들지 않고 기존 수업권을 가리킨다(소진 여부와 무관)", () => {
    const c1 = newConsultation("t1", { status: "scheduled", startH: 700, childId: KID });
    const c2 = newConsultation("t2", { status: "scheduled", startH: 710, childId: KID });
    psql(asUser(ADMIN, `select admin_record_consultation_outcome('${c1}', 'trial_recommended', null, '요약');`));
    psql(asUser(ADMIN, `select admin_record_consultation_outcome('${c2}', 'trial_recommended', null, '요약');`));
    const ids = psql(`select trial_entitlement_grant_id::text from consultations where id in ('${c1}','${c2}') order by contact_name`).split("\n");
    expect(ids[0]).toBe(ids[1]);
    expect(psql(`select count(*) from entitlement_grants g join entitlement_products p on p.id = g.entitlement_product_id where g.child_id = '${KID}' and p.code = 'trial_lesson_grant'`)).toBe("1");
  });

  it("자녀가 아직 없으면 지급은 failed 로 남고(막지 않음), 자녀 연결 후 재처리로 지급된다", () => {
    const id = newConsultation("t3", { status: "scheduled", startH: 720 });
    expect(psql(asUser(ADMIN, `select trial_entitlement_grant_status from admin_record_consultation_outcome('${id}', 'trial_recommended', null, '요약');`)).split("\n")[0]).toBe("failed");
    psql(`update consultations set child_id = '${KID2}' where id = '${id}'`);
    psql(asUser(ADMIN, `select admin_retry_trial_entitlement_grant('${id}');`));
    expect(psql(`select trial_entitlement_grant_status from consultations where id = '${id}'`)).toBe("granted");
  });
});

describe("B7 — 취소된 상담에는 온보딩 링크를 발급하지 않는다", () => {
  it("cancelled 는 거절, 진행된 상담은 체험 확정 후 발급된다", () => {
    const canc = newConsultation("b7-c", { status: "cancelled", outcome: "regular_recommended" });
    const prospect = randomUUID();
    psql(`insert into prospect_contacts (id, full_name, primary_email) values ('${prospect}', '${TAG}-b7', '${EMAIL("b7")}');
      update consultations set prospect_contact_id = '${prospect}' where id = '${canc}';`);
    const students = `'[{"name":"학생","email":"${EMAIL("b7s")}","grade":"10"}]'::jsonb`;
    expect(psqlErr(`select * from create_trial_onboarding_link_multi('${canc}', '${EMAIL("b7g")}', '보호자', ${students}, '${ADMIN}')`)).toContain("취소된 상담에는");
    const ok = newConsultation("b7-ok", { status: "completed", startH: 800, outcome: "regular_recommended" });
    psql(`update consultations set prospect_contact_id = '${prospect}' where id = '${ok}'`);
    expect(Number(psql(`select count(*) from create_trial_onboarding_link_multi('${ok}', '${EMAIL("b7g")}', '보호자', ${students}, '${ADMIN}')`))).toBe(1);
    psql(`set session_replication_role = replica;
      delete from trial_onboarding_link_events where link_id in (select id from trial_onboarding_links where prospect_contact_id = '${prospect}');
      delete from trial_onboarding_link_students where link_id in (select id from trial_onboarding_links where prospect_contact_id = '${prospect}');
      delete from trial_onboarding_links where prospect_contact_id = '${prospect}';
      update consultations set prospect_contact_id = null where prospect_contact_id = '${prospect}';
      delete from prospect_contacts where id = '${prospect}';`);
  });
});

describe("B8 — 온보딩 학생 카드는 원 상담의 담당 컨설턴트를 이어받는다", () => {
  it("카드에 담당 컨설턴트가 복사되어 컨설턴트가 카드를 읽고 결과를 기록할 수 있다(다른 컨설턴트는 못 읽는다)", () => {
    const prospect = randomUUID();
    const link = randomUUID();
    const linkStudent = randomUUID();
    const root = randomUUID();
    psql(`insert into prospect_contacts (id, full_name, primary_email) values ('${prospect}', '${TAG}-b8', '${EMAIL("b8")}');
      insert into consultations (id, contact_name, contact_email, status, admissions_consultant_id, intake_owner_id, prospect_contact_id,
        outcome, starts_at, ends_at, completed_at, trial_intent_confirmed_at)
      values ('${root}', '${TAG}-b8', '${EMAIL("b8")}', 'completed', '${CONS_A}', '${CONS_A}', '${prospect}', 'regular_recommended',
        '${at(900)}', '${at(901)}', '${at(901)}', now());
      insert into trial_onboarding_links (id, consultation_id, prospect_contact_id, guardian_email, guardian_name, student_name, student_email, token_hash, expires_at)
      values ('${link}', '${root}', '${prospect}', '${EMAIL("b8")}', 'g', 'k', '${EMAIL("b8k")}', 'h${randomUUID()}', now() + interval '1 day');
      insert into trial_onboarding_link_students (id, link_id, student_name, student_email, student_grade) values ('${linkStudent}', '${link}', '${TAG}-b8kid', '${EMAIL("b8k")}', '10');`);
    psql(`select _create_student_kanban_card('${root}', '${linkStudent}', '${KID}', '${HOUSEHOLD}');`);
    const card = psql(`select id::text || '|' || coalesce(admissions_consultant_id::text,'NULL') from consultations where family_root_consultation_id = '${root}'`).split("|");
    expect(card[1]).toBe(CONS_A);
    // 담당 컨설턴트는 RLS 로 카드를 읽고, 다른 컨설턴트는 읽지 못한다.
    expect(psql(asUser(CONS_A, `select count(*) from consultations where id = '${card[0]}';`)).split("\n")[0]).toBe("1");
    expect(psql(asUser(CONS_B, `select count(*) from consultations where id = '${card[0]}';`)).split("\n")[0]).toBe("0");
    // 정규 바로 진행 카드는 자녀가 확정된 채 생성되므로 계약 큐잉도 카드 생성 시점에 1건.
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id = '${KID}' and trigger_type = 'regular_recommended'`)).toBe("1");
    // 정리(감사 이력 트리거 우회 — 로컬 실행 ID 행만).
    psql(`set session_replication_role = replica;
      delete from consultations where family_root_consultation_id = '${root}';
      delete from trial_onboarding_link_students where id = '${linkStudent}';
      delete from trial_onboarding_links where id = '${link}';
      delete from consultations where id = '${root}';
      delete from prospect_contacts where id = '${prospect}';`);
  });
});

describe("B9 — 담당자는 컨설턴트 역할만", () => {
  it("학부모 계정을 담당자로 지정하면 거절되고, 담당자 해제(null)는 허용된다", () => {
    const id = newConsultation("b9", { consultant: null });
    expect(psqlErr(asUser(ADMIN, `select assign_consultation_owner('${id}', 'admissions_consultant', '${GUARDIAN}', 'qa');`))).toContain("컨설턴트 계정만");
    expect(() => psql(asUser(ADMIN, `select assign_consultation_owner('${id}', 'admissions_consultant', '${CONS_A}', 'qa');`))).not.toThrow();
    expect(() => psql(asUser(ADMIN, `select assign_consultation_owner('${id}', 'admissions_consultant', null, 'qa');`))).not.toThrow();
  });
});
