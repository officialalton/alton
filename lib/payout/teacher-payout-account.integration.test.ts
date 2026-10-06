import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

// 교사 수취 계좌 — 암호화 저장·최초 1회 등록 잠금·관리자 대리 입력·reveal 권한 매트릭스·감사(번호 미포함).
// 실행 ID(RUN)가 붙은 계정만 만들고 afterAll에서 그 계정만 지운다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `acct${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NUMBER = "110123456789";
const NEW_NUMBER = "220987654321";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    return (e as { stderr?: Buffer }).stderr?.toString() ?? String(e);
  }
  throw new Error("expected failure");
}

let seq = 0;
function createProfile(role: string, label: string, tier: string | null = null): string {
  const email = `${RUN}-${label}-${seq++}@example.com`;
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name${tier ? ", admin_tier" : ""}) values ('${id}', '${role}', '${RUN}-${label}'${tier ? `, '${tier}'` : ""});`);
  if (role === "teacher") psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  return id;
}
function grantCapability(profileId: string): void {
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${profileId}', '정산권한');`);
}
function save(teacher: string, actor: string, byAdmin: boolean, number = NUMBER, holder = "Kim"): string {
  return psql(
    `select save_teacher_payout_account('${teacher}'::uuid, '${actor}'::uuid, ${byAdmin}, '${holder}', 'Kookmin', '${number}', 'KRW', 'KR', null);`
  );
}

afterAll(() => {
  // INSERT-only 이력 트리거가 cascade 삭제도 막으므로, 이 실행 ID의 행을 지울 때만 한 트랜잭션 안에서 잠시 끈다.
  psql(
    `begin;
     alter table teacher_payout_account_events disable trigger teacher_payout_account_events_no_update;
     alter table teacher_payout_account_reveals disable trigger teacher_payout_account_reveals_no_update;
     delete from teacher_payout_account_events where teacher_id in (select id from profiles where name like '${RUN}-%') or actor_id in (select id from profiles where name like '${RUN}-%');
     delete from teacher_payout_account_reveals where teacher_id in (select id from profiles where name like '${RUN}-%') or actor_id in (select id from profiles where name like '${RUN}-%');
     delete from teacher_payout_accounts where teacher_id in (select id from profiles where name like '${RUN}-%');
     delete from profiles where name like '${RUN}-%';
     alter table teacher_payout_account_events enable trigger teacher_payout_account_events_no_update;
     alter table teacher_payout_account_reveals enable trigger teacher_payout_account_reveals_no_update;
     delete from auth.users where email like '${RUN}-%';
     commit;`
  );
});

describe("암호화 저장 + 최초 1회 등록 잠금", () => {
  it("교사 최초 저장은 암호문으로만 저장되고 평문 컬럼은 비어 있으며 끝 4자리만 남는다", () => {
    const teacher = createProfile("teacher", "t-enc");
    save(teacher, teacher, false);
    expect(psql(`select account_number is null, swift_or_routing is null, account_number_enc is not null, account_number_last4 from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("t|t|t|6789");
    // 암호문 안에 평문 번호가 그대로 들어 있지 않다.
    expect(psql(`select position('${NUMBER}' in encode(account_number_enc, 'escape')) from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("0");
    expect(psql(`select entered_by_admin from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("f");
    expect(psql(`select action, entered_by_admin from teacher_payout_account_events where teacher_id = '${teacher}';`)).toBe("created|f");
  });

  it("교사가 이미 등록한 뒤 다시 저장하면 DB가 LOCKED로 거절한다(서버 액션을 우회해도)", () => {
    const teacher = createProfile("teacher", "t-lock");
    save(teacher, teacher, false);
    expect(psqlError(`select save_teacher_payout_account('${teacher}'::uuid, '${teacher}'::uuid, false, 'Kim', 'Kookmin', '${NEW_NUMBER}', 'KRW', 'KR', null);`)).toMatch(/LOCKED/);
    expect(psql(`select account_number_last4 from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("6789");
  });

  it("교사는 다른 교사의 계좌를 등록할 수 없다", () => {
    const a = createProfile("teacher", "t-a");
    const b = createProfile("teacher", "t-b");
    expect(psqlError(`select save_teacher_payout_account('${b}'::uuid, '${a}'::uuid, false, 'Kim', 'K', '${NUMBER}', 'KRW', 'KR', null);`)).toMatch(/본인 계좌만/);
  });

  it("authenticated 역할은 암호문·평문 컬럼을 직접 select할 수 없다(컬럼 권한)", () => {
    const teacher = createProfile("teacher", "t-col");
    save(teacher, teacher, false);
    const err = psqlError(
      `set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${teacher}', false); end $$; select account_number_enc from teacher_payout_accounts where teacher_id = '${teacher}';`
    );
    expect(err).toMatch(/permission denied/i);
    // 허용된 컬럼(끝 4자리)은 본인 것만 읽힌다.
    expect(psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${teacher}', false); end $$; select account_number_last4 from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("6789");
  });
});

describe("관리자 대리 입력 — 권한·이력·알림", () => {
  it("마스터 관리자가 대신 수정하면 이력(관리자 입력·바뀐 필드·끝 4자리)과 교사 영문 알림이 남고 번호 전체는 어디에도 없다", () => {
    const teacher = createProfile("teacher", "t-admin-edit");
    const master = createProfile("admin", "master", "master");
    save(teacher, teacher, false);
    const result = save(teacher, master, true, NEW_NUMBER, "Kim Teacher");
    expect(result).toContain("account_number");
    expect(psql(`select entered_by_admin, account_number_last4 from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("t|4321");
    expect(psql(`select action, entered_by_admin, previous_last4, new_last4, actor_id = '${master}' from teacher_payout_account_events where teacher_id = '${teacher}' order by created_at desc limit 1;`)).toBe("updated|t|6789|4321|t");
    expect(psql(`select changed_fields::text from teacher_payout_account_events where teacher_id = '${teacher}' order by created_at desc limit 1;`)).toContain("account_holder_name");
    expect(psql(`select message from payout_teacher_notices where teacher_id = '${teacher}' and kind = 'payout_account_updated';`)).toBe(
      "Your payout account details were updated by ALTON staff. If this was not expected, contact us."
    );
    for (const table of ["teacher_payout_account_events", "payout_teacher_notices", "teacher_payout_account_reveals"]) {
      expect(psql(`select count(*) from ${table} t where t.teacher_id = '${teacher}' and t::text like '%${NEW_NUMBER}%';`)).toBe("0");
    }
  });

  it("권한 없는 관리자·정산권한 없는 supervisor·컨설턴트는 대리 입력을 DB에서 거절한다", () => {
    const teacher = createProfile("teacher", "t-deny");
    const full = createProfile("admin", "full", "full");
    const supervisor = createProfile("admin", "sup", "supervisor");
    const consultant = createProfile("consultant", "cons");
    for (const actor of [full, supervisor, consultant]) {
      expect(psqlError(`select save_teacher_payout_account('${teacher}'::uuid, '${actor}'::uuid, true, 'Kim', 'K', '${NUMBER}', 'KRW', 'KR', null);`)).toMatch(/권한/);
    }
    expect(psql(`select count(*) from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("0");
  });

  it("정산권한을 가진 supervisor는 대신 입력할 수 있다", () => {
    const teacher = createProfile("teacher", "t-cap");
    const supervisor = createProfile("admin", "sup-cap", "supervisor");
    grantCapability(supervisor);
    save(teacher, supervisor, true);
    expect(psql(`select entered_by_admin from teacher_payout_accounts where teacher_id = '${teacher}';`)).toBe("t");
  });
});

describe("전체 번호 보기(reveal) — 권한 매트릭스와 감사", () => {
  it("마스터·정산권한 보유자는 복호화된 번호를 받고 호출마다 감사 행(사유 포함, 번호 제외)이 남는다", () => {
    const teacher = createProfile("teacher", "t-reveal");
    const master = createProfile("admin", "m2", "master");
    const capAdmin = createProfile("admin", "cap2", "full");
    grantCapability(capAdmin);
    save(teacher, teacher, false);

    expect(psql(`select account_number from reveal_teacher_payout_account('${teacher}'::uuid, '${master}'::uuid, '수동 송금');`)).toBe(NUMBER);
    expect(psql(`select account_number from reveal_teacher_payout_account('${teacher}'::uuid, '${capAdmin}'::uuid);`)).toBe(NUMBER);
    expect(psql(`select count(*) from teacher_payout_account_reveals where teacher_id = '${teacher}';`)).toBe("2");
    expect(psql(`select reason from teacher_payout_account_reveals where teacher_id = '${teacher}' and actor_id = '${master}';`)).toBe("수동 송금");
    expect(psql(`select count(*) from teacher_payout_account_reveals r where r.teacher_id = '${teacher}' and r::text like '%${NUMBER}%';`)).toBe("0");
  });

  it("권한 없는 관리자(full·capability 없음)·supervisor·교사·컨설턴트는 거절되고 감사 행도 만들어지지 않는다", () => {
    const teacher = createProfile("teacher", "t-reveal-deny");
    const other = createProfile("teacher", "t-other");
    const full = createProfile("admin", "full2", "full");
    const supervisor = createProfile("admin", "sup2", "supervisor");
    const consultant = createProfile("consultant", "cons2");
    save(teacher, teacher, false);
    for (const actor of [full, supervisor, teacher, other, consultant]) {
      expect(psqlError(`select * from reveal_teacher_payout_account('${teacher}'::uuid, '${actor}'::uuid);`)).toMatch(/권한/);
    }
    expect(psql(`select count(*) from teacher_payout_account_reveals where teacher_id = '${teacher}';`)).toBe("0");
  });

  it("reveal 감사 행은 INSERT-only다", () => {
    const teacher = createProfile("teacher", "t-reveal-immut");
    const master = createProfile("admin", "m3", "master");
    save(teacher, teacher, false);
    psql(`select 1 from reveal_teacher_payout_account('${teacher}'::uuid, '${master}'::uuid);`);
    expect(psqlError(`update teacher_payout_account_reveals set reason = 'x' where teacher_id = '${teacher}';`)).toMatch(/INSERT-only/);
    expect(psqlError(`delete from teacher_payout_account_reveals where teacher_id = '${teacher}';`)).toMatch(/INSERT-only/);
  });

  it("authenticated 역할은 reveal·save 함수를 직접 호출할 수 없다(service_role 전용)", () => {
    const teacher = createProfile("teacher", "t-direct");
    save(teacher, teacher, false);
    const err = psqlError(`set role authenticated; select * from reveal_teacher_payout_account('${teacher}'::uuid, '${teacher}'::uuid);`);
    expect(err).toMatch(/permission denied/i);
  });
});
