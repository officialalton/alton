import { execFile, execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-09-29 온보딩 정책 라운드(F1·D3b·B5·B7·B2·E1/E2/E4·F2·H2) 회귀 테스트.
// 로컬 DB(psql)만 사용한다. 실행 ID 가 붙은 전용 사용자·상담·가족만 만들고 afterAll 에서 그 행만 정리한다.
// 외부 서비스(Google·DocuSign·메일) 호출은 없다.

const execFileAsync = promisify(execFile);
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = randomUUID().slice(0, 8);
const TAG = `pol-round-${RUN}`;
const EMAIL = (n: string) => `${TAG}-${n}@example.com`;
const ADMIN = randomUUID();
const CONS_A = randomUUID();
const CONS_B = randomUUID();
const CONS_C = randomUUID();
const GUARDIAN = randomUUID();
const OTHER_GUARDIAN = randomUUID();
const KID = randomUUID();
const KID2 = randomUUID();
const KID3 = randomUUID();
const HOUSEHOLD = randomUUID();
const OTHER_HOUSEHOLD = randomUUID();
const ALL_USERS = [ADMIN, CONS_A, CONS_B, CONS_C, GUARDIAN, OTHER_GUARDIAN, KID, KID2, KID3];

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlErr(sql: string): string {
  const r = spawnSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  if (r.status === 0) throw new Error(`expected failure but succeeded: ${sql.slice(0, 120)}`);
  return r.stderr;
}
async function psqlAsync(sql: string): Promise<string> {
  const { stdout } = await execFileAsync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" });
  return stdout.trim();
}
// RLS 를 적용하는 사용자 세션(PostgREST 가 authenticated 롤 + JWT claims 로 실행하는 것과 동일).
const asUser = (userId: string, sql: string) =>
  `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'; ${sql} commit;`;
const asService = (sql: string) =>
  `begin; set local role service_role; set local request.jwt.claims = '{"role":"service_role"}'; ${sql} commit;`;
const lastLine = (out: string) => out.split("\n").filter((l) => l && l !== "COMMIT" && !l.startsWith("BEGIN") && l !== "SET").pop() ?? "";

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
  createUser(CONS_C, "cc", "consultant");
  createUser(GUARDIAN, "g", "parent");
  createUser(OTHER_GUARDIAN, "og", "parent");
  createUser(KID, "k1", "student");
  createUser(KID2, "k2", "student");
  createUser(KID3, "k3", "student");
  psql(`insert into parents (id) values ('${GUARDIAN}'), ('${OTHER_GUARDIAN}');
    insert into households (id, primary_guardian_id) values ('${HOUSEHOLD}', '${GUARDIAN}'), ('${OTHER_HOUSEHOLD}', '${OTHER_GUARDIAN}');
    insert into household_members (household_id, profile_id, role, is_primary) values
      ('${HOUSEHOLD}', '${GUARDIAN}', 'guardian', true), ('${HOUSEHOLD}', '${KID}', 'child', false), ('${HOUSEHOLD}', '${KID2}', 'child', false),
      ('${OTHER_HOUSEHOLD}', '${OTHER_GUARDIAN}', 'guardian', true), ('${OTHER_HOUSEHOLD}', '${KID3}', 'child', false);
    insert into students (id, grade, status) values ('${KID}', '10', 'pending'), ('${KID2}', '11', 'pending'), ('${KID3}', '9', 'pending');`);
});

afterAll(() => {
  const cids = `(select id from consultations where contact_name like '${TAG}%')`;
  const kids = `('${KID}','${KID2}','${KID3}')`;
  const users = `(${ALL_USERS.map((u) => `'${u}'`).join(",")})`;
  psql(`set session_replication_role = replica;
    delete from child_contract_send_locks where child_id in ${kids};
    delete from trial_entitlement_regrants where child_id in ${kids};
    delete from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id in ${kids});
    delete from entitlement_grants where child_id in ${kids};
    delete from consultation_classification_tags where consultation_id in ${cids};
    delete from classification_tags where label like '${TAG}%';
    delete from consultation_assignment_history where consultation_id in ${cids};
    delete from consultant_assignment_history where student_id in ${kids};
    delete from consultant_assignments where student_id in ${kids};
    delete from consultation_scheduling_links where consultation_id in ${cids};
    delete from consultation_status_events where consultation_id in ${cids};
    delete from trial_onboarding_link_students where link_id in (select id from trial_onboarding_links where guardian_name like '${TAG}%');
    delete from trial_onboarding_links where guardian_name like '${TAG}%';
    delete from contract_dispatch_jobs where child_id in ${kids};
    delete from consultations where contact_name like '${TAG}%' or contact_name = '[비식별화됨]' and contact_email = '${EMAIL("anon")}';
    delete from prospect_contacts where full_name like '${TAG}%';
    delete from consultant_settings where consultant_id in ('${CONS_A}','${CONS_B}','${CONS_C}');
    delete from household_members where household_id in ('${HOUSEHOLD}','${OTHER_HOUSEHOLD}');
    delete from households where id in ('${HOUSEHOLD}','${OTHER_HOUSEHOLD}');
    delete from students where id in ${kids};
    delete from parents where id in ('${GUARDIAN}','${OTHER_GUARDIAN}');
    delete from profiles where id in ${users};
    delete from auth.users where id in ${users};`);
});

function newConsultation(label: string, o: { consultant?: string | null; status?: string; startH?: number | null; childId?: string | null; outcome?: string | null; googleEvent?: string | null; extra?: string }): string {
  const id = randomUUID();
  const consultant = o.consultant === undefined ? CONS_A : o.consultant;
  const startH = o.startH === undefined ? null : o.startH;
  psql(`insert into consultations (id, contact_name, contact_email, status, admissions_consultant_id, starts_at, ends_at, child_id, outcome, google_event_id,
      admin_review_summary, outcome_notes)
    values ('${id}', '${TAG}-${label}', '${EMAIL(label)}', '${o.status ?? "requested"}', ${consultant ? `'${consultant}'` : "null"},
    ${startH === null ? "null" : `'${at(startH)}'`}, ${startH === null ? "null" : `'${at(startH + 1)}'`},
    ${o.childId ? `'${o.childId}'` : "null"}, ${o.outcome ? `'${o.outcome}'` : "null"}, ${o.googleEvent ? `'${o.googleEvent}'` : "null"},
    '내부 검토 메모 ${label}', '내부 결과 메모 ${label}');`);
  return id;
}

describe("F1 — 보호자·학생은 consultations 내부 메모를 읽을 수 없다", () => {
  let consultationId: string;
  beforeAll(() => {
    consultationId = newConsultation("f1", { consultant: CONS_A, status: "completed", childId: KID, outcome: "trial_recommended" });
    psql(`update consultations set closure_type = 'no_trial', closure_review_text = '종료 검토 메모', closed_at = now() where id = '${consultationId}'`);
  });

  it("보호자·자녀 본인·다른 가족·무관한 컨설턴트는 행을 볼 수 없다", () => {
    for (const viewer of [GUARDIAN, KID, OTHER_GUARDIAN, CONS_B]) {
      expect(lastLine(psql(asUser(viewer, `select count(*) from consultations where id = '${consultationId}';`)))).toBe("0");
      expect(lastLine(psql(asUser(viewer, `select count(admin_review_summary) from consultations where child_id = '${KID}';`)))).toBe("0");
    }
  });

  it("관리자와 담당 컨설턴트는 그대로 읽는다", () => {
    for (const viewer of [ADMIN, CONS_A]) {
      expect(lastLine(psql(asUser(viewer, `select admin_review_summary from consultations where id = '${consultationId}';`)))).toContain("내부 검토 메모");
    }
  });

  it("가족 조회 정책(태그)은 헬퍼로 계속 동작한다 — 내 가족 상담 태그는 보이고 다른 가족·무관한 사용자에게는 안 보인다", () => {
    const label = `${TAG}-tag`;
    const tagId = psql(`insert into classification_tags (label) values ('${label}') returning id;`).split("\n")[0];
    psql(`insert into consultation_classification_tags (consultation_id, tag_id) values ('${consultationId}', '${tagId}');`);
    const count = (u: string) => lastLine(psql(asUser(u, `select count(*) from consultation_classification_tags where consultation_id = '${consultationId}';`)));
    expect(count(GUARDIAN)).toBe("1");
    expect(count(KID)).toBe("1");
    expect(count(OTHER_GUARDIAN)).toBe("0");
    expect(count(CONS_B)).toBe("0");
  });

  it("가족 화면이 쓰던 값(자녀의 최근 종료 유형)은 함수로만 받는다 — 본인 가족만", () => {
    const closure = (u: string, child: string) => lastLine(psql(asUser(u, `select coalesce(family_child_latest_closure_type('${child}'), 'null');`)));
    expect(closure(GUARDIAN, KID)).toBe("no_trial");
    expect(closure(KID, KID)).toBe("no_trial");
    expect(closure(OTHER_GUARDIAN, KID)).toBe("null");
    expect(lastLine(psql(asUser(GUARDIAN, `select is_family_consultation('${consultationId}');`)))).toBe("t");
    expect(lastLine(psql(asUser(OTHER_GUARDIAN, `select is_family_consultation('${consultationId}');`)))).toBe("f");
  });
});

describe("D3b — 같은 자녀 계약 발송은 동시에 하나만", () => {
  it("동시 획득은 정확히 한 쪽만 성공하고, 해제 후 다시 잡을 수 있다", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => psqlAsync(`select coalesce(try_acquire_child_contract_send_lock('${KID}', 60)::text, 'busy');`))
    );
    const winners = results.filter((r) => r !== "busy");
    expect(winners).toHaveLength(1);
    const token = winners[0];
    expect(psql(`select coalesce(try_acquire_child_contract_send_lock('${KID}', 60)::text, 'busy');`)).toBe("busy");
    psql(`select release_child_contract_send_lock('${KID}', '${token}');`);
    expect(psql(`select coalesce(try_acquire_child_contract_send_lock('${KID}', 60)::text, 'busy');`)).not.toBe("busy");
  });

  it("다른 자녀는 서로 막지 않고, 만료된 임대는 다음 호출이 가져간다(죽은 워커 복구)", () => {
    expect(psql(`select coalesce(try_acquire_child_contract_send_lock('${KID2}', 60)::text, 'busy');`)).not.toBe("busy");
    psql(`update child_contract_send_locks set expires_at = now() - interval '1 second' where child_id = '${KID}'`);
    expect(psql(`select coalesce(try_acquire_child_contract_send_lock('${KID}', 60)::text, 'busy');`)).not.toBe("busy");
  });

  it("다른 사람의 토큰으로는 해제되지 않는다", () => {
    psql(`delete from child_contract_send_locks where child_id = '${KID3}'`);
    const token = psql(`select try_acquire_child_contract_send_lock('${KID3}', 60);`);
    psql(`select release_child_contract_send_lock('${KID3}', '${randomUUID()}');`);
    expect(psql(`select count(*) from child_contract_send_locks where child_id = '${KID3}'`)).toBe("1");
    psql(`select release_child_contract_send_lock('${KID3}', '${token}');`);
    expect(psql(`select count(*) from child_contract_send_locks where child_id = '${KID3}'`)).toBe("0");
  });

  it("일반 사용자(authenticated)는 잠금 함수를 호출할 수 없다", () => {
    expect(psqlErr(asUser(GUARDIAN, `select try_acquire_child_contract_send_lock('${KID}', 60);`))).toContain("permission denied");
  });
});

describe("B5 — 확정+Google 일정이 있는 상담은 담당자 재배정 거절", () => {
  it("확정·일정 있음 → 거절(취소 후 새 링크 안내), 일정 없는 확정·requested → 허용", () => {
    const withEvent = newConsultation("b5-ev", { status: "scheduled", startH: 300, googleEvent: `evt-${RUN}` });
    const err = psqlErr(asUser(ADMIN, `select assign_consultation_owner('${withEvent}', 'admissions_consultant', '${CONS_B}', 'x');`));
    expect(err).toContain("취소한 뒤 새 예약 링크");
    expect(psql(`select admissions_consultant_id from consultations where id = '${withEvent}'`)).toBe(CONS_A);
    // 미배정으로 되돌리는 것도 같은 이유로 거절.
    expect(psqlErr(asUser(ADMIN, `select assign_consultation_owner('${withEvent}', 'admissions_consultant', null, 'x');`))).toContain("취소한 뒤 새 예약 링크");

    const noEvent = newConsultation("b5-noev", { status: "scheduled", startH: 310 });
    psql(asUser(ADMIN, `select assign_consultation_owner('${noEvent}', 'admissions_consultant', '${CONS_B}', 'x');`));
    expect(psql(`select admissions_consultant_id from consultations where id = '${noEvent}'`)).toBe(CONS_B);

    const req = newConsultation("b5-req", { status: "requested" });
    psql(asUser(ADMIN, `select assign_consultation_owner('${req}', 'admissions_consultant', '${CONS_B}', 'x');`));
    expect(psql(`select admissions_consultant_id from consultations where id = '${req}'`)).toBe(CONS_B);
  });

  it("같은 담당자로의 재지정은 거절하지 않는다(멱등)", () => {
    const withEvent = newConsultation("b5-same", { status: "scheduled", startH: 320, googleEvent: `evt2-${RUN}` });
    psql(asUser(ADMIN, `select assign_consultation_owner('${withEvent}', 'admissions_consultant', '${CONS_A}', 'same');`));
  });
});

describe("B7 — 컨설턴트 비활성화", () => {
  let reqTimed: string;
  let reqPlain: string;
  let scheduled: string;
  let token: string;

  beforeAll(() => {
    reqTimed = newConsultation("b7-timed", { consultant: CONS_C, status: "requested", startH: 400 });
    reqPlain = newConsultation("b7-plain", { consultant: CONS_C, status: "requested" });
    scheduled = newConsultation("b7-sched", { consultant: CONS_C, status: "scheduled", startH: 410, googleEvent: `evt3-${RUN}` });
    token = `tok-${RUN}-b7`;
    psql(`insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at)
      values ('${reqPlain}', '${CONS_C}', '${token}', now() + interval '1 day');`);
  });

  it("관리자만 비활성화할 수 있다", () => {
    expect(psqlErr(asUser(CONS_C, `select admin_set_consultant_active('${CONS_C}', false, 'x');`))).toContain("관리자만");
    expect(psqlErr(asUser(GUARDIAN, `select admin_set_consultant_active('${CONS_C}', false, 'x');`))).toContain("관리자만");
  });

  it("비활성화하면 미확정 상담은 미배정(시간·링크 회수)되고 확정 상담은 남아 관리자 큐에 오른다", () => {
    const out = psql(asUser(ADMIN, `select admin_set_consultant_active('${CONS_C}', false, '퇴사');`));
    expect(out).toContain('"unassigned": 2');
    expect(out).toContain('"scheduled_remaining": 1');

    for (const id of [reqTimed, reqPlain]) {
      expect(psql(`select coalesce(admissions_consultant_id::text,'null') || '|' || coalesce(starts_at::text,'null') || '|' || unassigned_from_consultant_id from consultations where id = '${id}'`)).toBe(`null|null|${CONS_C}`);
      expect(psql(`select count(*) from consultation_assignment_history where consultation_id = '${id}' and prior_owner_id = '${CONS_C}' and new_owner_id is null`)).toBe("1");
    }
    expect(psql(`select expires_at <= now() from consultation_scheduling_links where token = '${token}'`)).toBe("t");
    // 링크가 죽었으니 고객이 슬롯을 고를 수 없다.
    expect(psqlErr(`select * from redeem_consultation_scheduling_link('${token}', '${at(420)}');`)).toBeTruthy();
    expect(psql(`select admissions_consultant_id from consultations where id = '${scheduled}'`)).toBe(CONS_C);

    const queue = JSON.parse(lastLine(psql(asUser(ADMIN, `select admin_onboarding_attention_queue();`))));
    const ids = (k: string) => (queue[k] as { consultation_id: string }[]).map((r) => r.consultation_id);
    expect(ids("unassigned_inactive_consultant")).toEqual(expect.arrayContaining([reqTimed, reqPlain]));
    expect(ids("scheduled_inactive_consultant")).toContain(scheduled);
    // 비관리자는 큐를 볼 수 없다.
    expect(psqlErr(asUser(GUARDIAN, `select admin_onboarding_attention_queue();`))).toContain("관리자만");
  });

  it("비활성 컨설턴트에게는 배정(RPC·직접 UPDATE)·링크 발송이 막힌다", () => {
    expect(psqlErr(asUser(ADMIN, `select assign_consultation_owner('${reqPlain}', 'admissions_consultant', '${CONS_C}', 'x');`))).toContain("비활성화된 컨설턴트");
    expect(psqlErr(`update consultations set admissions_consultant_id = '${CONS_C}' where id = '${reqPlain}'`)).toContain("deactivated consultant");
    expect(
      psqlErr(`insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at) values ('${reqPlain}', '${CONS_C}', 'tok-${RUN}-x', now() + interval '1 day')`)
    ).toContain("비활성화된 컨설턴트");
  });

  it("컨설턴트가 스스로 활성 상태를 되돌리거나 새 업무를 켤 수 없다", () => {
    expect(psqlErr(asUser(CONS_C, `select set_consultant_accepting_new_work(true);`))).toContain("비활성화된 계정");
    expect(psqlErr(asUser(CONS_C, `update consultant_settings set deactivated_at = null where consultant_id = '${CONS_C}';`))).toContain("관리자만");
  });

  it("다른 컨설턴트에게 재배정하면 미배정 표시가 사라지고, 재활성화하면 다시 배정할 수 있다", () => {
    psql(asUser(ADMIN, `select assign_consultation_owner('${reqTimed}', 'admissions_consultant', '${CONS_B}', 'reassign');`));
    expect(psql(`select coalesce(unassigned_reason,'cleared') from consultations where id = '${reqTimed}'`)).toBe("cleared");
    psql(asUser(ADMIN, `select admin_set_consultant_active('${CONS_C}', true, null);`));
    psql(asUser(ADMIN, `select assign_consultation_owner('${reqPlain}', 'admissions_consultant', '${CONS_C}', 'back');`));
    expect(psql(`select admissions_consultant_id from consultations where id = '${reqPlain}'`)).toBe(CONS_C);
    expect(psql(`select accepting_new_work from consultant_settings where consultant_id = '${CONS_C}'`)).toBe("t");
  });
});

describe("B2 — 컨설턴트가 체험을 확정하면 관리자 '온보딩 안내 발송 대기' 큐에 오른다", () => {
  it("안내가 나가기 전에는 큐에 있고, 발송되면 사라진다", () => {
    const id = newConsultation("b2", { consultant: CONS_A, status: "completed", outcome: "trial_recommended" });
    psql(`update consultations set trial_intent_confirmed_at = now(), trial_intent_confirmed_by = '${CONS_A}' where id = '${id}'`);
    const fetchQueue = () => JSON.parse(lastLine(psql(asUser(ADMIN, `select admin_onboarding_attention_queue();`))));
    const row = (fetchQueue().onboarding_send_pending as { consultation_id: string; confirmed_by_consultant: boolean }[]).find((r) => r.consultation_id === id);
    expect(row?.confirmed_by_consultant).toBe(true);

    psql(`insert into trial_onboarding_links (consultation_id, guardian_email, guardian_name, token_hash, expires_at, notice_delivery_status, notice_sent_at)
      values ('${id}', '${EMAIL("b2g")}', '${TAG}-b2g', 'h-${RUN}', now() + interval '72 hours', 'sent', now())`);
    expect((fetchQueue().onboarding_send_pending as { consultation_id: string }[]).some((r) => r.consultation_id === id)).toBe(false);
  });
});

describe("E1/E2/E4 — 체험권 소진·만료 후 재지급은 관리자 수동 1회씩", () => {
  it("상태 판정: 없음 → 활성 → 소진", () => {
    expect(psql(`select trial_entitlement_state('${KID2}')`)).toBe("none");
    const gid = psql(`select grant_trial_entitlement_for_student('${KID2}')`).split("\n")[0];
    expect(psql(`select trial_entitlement_state('${KID2}')`)).toBe("active");
    // 활성 중에는 재지급 불가
    expect(psqlErr(asUser(ADMIN, `select admin_regrant_trial_entitlement('${KID2}', '사유는 다섯 글자 이상');`))).toContain("아직 남아 있어");
    // 소진(ledger 에 차감)
    psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${gid}', 'expire', -1, 'test-exhaust:${RUN}')`);
    expect(psql(`select trial_entitlement_state('${KID2}')`)).toBe("exhausted");
  });

  it("관리자가 사유를 남기고 소진 1회 재지급 → 두 번째 소진 재지급은 거절, 이력은 append-only", () => {
    expect(psqlErr(asUser(GUARDIAN, `select admin_regrant_trial_entitlement('${KID2}', '사유는 다섯 글자 이상');`))).toContain("관리자만");
    expect(psqlErr(asUser(ADMIN, `select admin_regrant_trial_entitlement('${KID2}', '짧음');`))).toContain("5자 이상");

    const newGrant = lastLine(psql(asUser(ADMIN, `select admin_regrant_trial_entitlement('${KID2}', '체험 중 네트워크 장애로 미진행');`)));
    expect(newGrant).toMatch(/^[0-9a-f-]{36}$/);
    expect(psql(`select trial_entitlement_state('${KID2}')`)).toBe("active");
    expect(psql(`select kind || '|' || reason from trial_entitlement_regrants where child_id = '${KID2}'`)).toBe("exhausted|체험 중 네트워크 장애로 미진행");

    // 다시 소진 → 같은 종류는 재지급 불가(자동·반복 재지급 없음)
    psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${newGrant}', 'expire', -1, 'test-exhaust2:${RUN}')`);
    expect(psql(`select trial_entitlement_state('${KID2}')`)).toBe("exhausted");
    expect(psqlErr(asUser(ADMIN, `select admin_regrant_trial_entitlement('${KID2}', '한 번 더 부탁드립니다');`))).toContain("이미 \"소진\" 사유로");

    expect(psqlErr(`update trial_entitlement_regrants set reason = 'tamper' where child_id = '${KID2}'`)).toContain("append-only");
    expect(psqlErr(`delete from trial_entitlement_regrants where child_id = '${KID2}'`)).toContain("append-only");
  });

  it("만료는 별도로 1회 — 만료된 체험권(잔여 있음)은 expired 로 보이고 재지급된다", () => {
    const gid = psql(`select grant_trial_entitlement_for_student('${KID}')`).split("\n")[0];
    psql(`update entitlement_grants set expires_at = now() - interval '1 day' where id = '${gid}'`);
    expect(psql(`select trial_entitlement_state('${KID}')`)).toBe("expired");
    psql(asUser(ADMIN, `select admin_regrant_trial_entitlement('${KID}', '만료 직전 일정 조율 실패');`));
    expect(psql(`select kind from trial_entitlement_regrants where child_id = '${KID}'`)).toBe("expired");
    expect(psql(`select trial_entitlement_state('${KID}')`)).toBe("active");
    // 지급 조회는 가장 최근 체험권을 돌려준다.
    const cid = newConsultation("e4", { consultant: CONS_A, status: "completed", outcome: "trial_recommended", childId: KID });
    const latest = psql(`select id from entitlement_grants where child_id = '${KID}' order by created_at desc, id desc limit 1`);
    expect(psql(`select grant_trial_entitlement_for_consultation('${cid}')`)).toBe(latest);
  });

  it("두 번째 trial_recommended 가 소진·만료 자녀를 가리키면 관리자 큐에 '소진/만료'로 정직하게 올라온다", () => {
    const cid = newConsultation("e4q", { consultant: CONS_A, status: "completed", outcome: "trial_recommended", childId: KID2 });
    const queue = JSON.parse(lastLine(psql(asUser(ADMIN, `select admin_onboarding_attention_queue();`))));
    const row = (queue.trial_entitlement_unavailable as { consultation_id: string; state: string }[]).find((r) => r.consultation_id === cid);
    expect(row?.state).toBe("exhausted");
  });
});

describe("F2 — 상담 경로 자녀도 담당 컨설턴트를 이어받는다(그 자녀 한정)", () => {
  it("학생 카드 생성 시 consultant_assignments 가 생기고, 타 컨설턴트는 그 자녀에 접근할 수 없다", () => {
    const root = newConsultation("f2", { consultant: CONS_A, status: "completed", outcome: "regular_recommended" });
    const linkId = psql(`insert into trial_onboarding_links (consultation_id, guardian_email, guardian_name, token_hash, expires_at)
      values ('${root}', '${EMAIL("f2g")}', '${TAG}-f2g', 'h2-${RUN}', now() + interval '72 hours') returning id;`).split("\n")[0];
    const studentLink = psql(`insert into trial_onboarding_link_students (link_id, student_name, student_email)
      values ('${linkId}', '${TAG}-f2kid', '${EMAIL("f2k")}') returning id;`).split("\n")[0];

    psql(`select _create_student_kanban_card('${root}', '${studentLink}', '${KID3}', '${OTHER_HOUSEHOLD}');`);
    expect(psql(`select consultant_id from consultant_assignments where student_id = '${KID3}'`)).toBe(CONS_A);
    expect(psql(`select count(*) from consultant_assignment_history where student_id = '${KID3}' and new_consultant_id = '${CONS_A}'`)).toBe("1");
    // 멱등: 다시 불러도 중복·덮어쓰기 없음
    psql(`select _create_student_kanban_card('${root}', '${studentLink}', '${KID3}', '${OTHER_HOUSEHOLD}');`);
    expect(psql(`select count(*) from consultant_assignments where student_id = '${KID3}'`)).toBe("1");

    // 열람 범위: 담당 컨설턴트는 그 자녀 배정만, 다른 컨설턴트는 아무것도 못 본다.
    expect(lastLine(psql(asUser(CONS_A, `select count(*) from consultant_assignments where student_id = '${KID3}';`)))).toBe("1");
    expect(lastLine(psql(asUser(CONS_B, `select count(*) from consultant_assignments where student_id = '${KID3}';`)))).toBe("0");
    // 같은 가족의 다른 자녀(KID2는 다른 가구)·무관 자녀에는 배정이 생기지 않는다.
    expect(psql(`select count(*) from consultant_assignments where consultant_id = '${CONS_A}' and student_id <> '${KID3}' and student_id in ('${KID}','${KID2}')`)).toBe("0");
  });
});

describe("H2 — consultations·prospect_contacts 2년 익명화(기본 dryRun 지원)", () => {
  it("dryRun 은 세기만 하고, 실행하면 종료된 2년 지난 행만 익명화한다(진행 중·최근 행은 보존)", () => {
    const old = newConsultation("anon", { consultant: CONS_A, status: "completed", outcome: "on_hold" });
    psql(`update consultations set completed_at = now() - interval '3 years', contact_phone = '010-1111-2222', concerns = '고민', closure_review_text = '검토',
      contact_name = '${TAG}-anon' where id = '${old}'`);
    const recent = newConsultation("recent", { consultant: CONS_A, status: "completed", outcome: "on_hold" });
    psql(`update consultations set completed_at = now() - interval '1 month' where id = '${recent}'`);
    const open = newConsultation("open2y", { consultant: CONS_A, status: "requested" });
    psql(`set session_replication_role = replica; update consultations set updated_at = now() - interval '3 years', requested_at = now() - interval '3 years' where id = '${open}';`);
    const prospect = psql(`insert into prospect_contacts (full_name, primary_email, primary_phone) values ('${TAG}-pc', '${EMAIL("pc")}', '010') returning id;`).split("\n")[0];
    psql(`set session_replication_role = replica; update prospect_contacts set updated_at = now() - interval '3 years' where id = '${prospect}';`);

    const dry = JSON.parse(lastLine(psql(asService(`select run_data_retention_batch(500, true);`))));
    expect(dry.consultations).toBeGreaterThanOrEqual(1);
    expect(dry.prospectContacts).toBeGreaterThanOrEqual(1);
    expect(psql(`select contact_name from consultations where id = '${old}'`)).toBe(`${TAG}-anon`);

    const real = JSON.parse(lastLine(psql(asService(`select run_data_retention_batch(500, false);`))));
    expect(real.errors).toEqual([]);
    expect(psql(`select contact_name || '|' || contact_email || '|' || coalesce(contact_phone,'-') || '|' || coalesce(concerns,'-') || '|' || coalesce(closure_review_text,'-') || '|' || coalesce(admin_review_summary,'-') from consultations where id = '${old}'`)).toBe("[비식별화됨]|anonymized@example.invalid|-|-|-|-");
    expect(psql(`select status from consultations where id = '${old}'`)).toBe("completed");
    expect(psql(`select contact_name from consultations where id = '${recent}'`)).toBe(`${TAG}-recent`);
    expect(psql(`select contact_name from consultations where id = '${open}'`)).toBe(`${TAG}-open2y`);
    expect(psql(`select full_name || '|' || primary_email || '|' || coalesce(primary_phone,'-') from prospect_contacts where id = '${prospect}'`)).toBe("[비식별화됨]|anonymized@example.invalid|-");
    expect(psql(`select count(*) from retention_batch_runs where category in ('consultations_2y_pii','prospect_contacts_2y_pii') and dry_run`)).not.toBe("0");
  });
});
