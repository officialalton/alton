import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

// 컨설턴트 수취 계좌 — 교사와 같은 정책: 암호화 저장·최초 1회 잠금·관리자 대리 입력·reveal 권한 매트릭스·감사(번호 미포함).
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `cacct${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
  return id;
}
const save = (c: string, actor: string, byAdmin: boolean, number = NUMBER) =>
  psql(`select save_consultant_payout_account('${c}'::uuid, '${actor}'::uuid, ${byAdmin}, 'Kim', 'Kookmin', '${number}', 'KRW', 'KR', null);`);

afterAll(() => {
  psql(
    `begin;
     alter table consultant_payout_account_events disable trigger consultant_payout_account_events_no_update;
     alter table consultant_payout_account_reveals disable trigger consultant_payout_account_reveals_no_update;
     delete from consultant_payout_account_events where consultant_id in (select id from profiles where name like '${RUN}-%') or actor_id in (select id from profiles where name like '${RUN}-%');
     delete from consultant_payout_account_reveals where consultant_id in (select id from profiles where name like '${RUN}-%') or actor_id in (select id from profiles where name like '${RUN}-%');
     delete from consultant_payout_accounts where consultant_id in (select id from profiles where name like '${RUN}-%');
     delete from profiles where name like '${RUN}-%';
     alter table consultant_payout_account_events enable trigger consultant_payout_account_events_no_update;
     alter table consultant_payout_account_reveals enable trigger consultant_payout_account_reveals_no_update;
     delete from auth.users where email like '${RUN}-%';
     commit;`
  );
});

describe("컨설턴트 계좌 — 암호화·최초 1회 잠금", () => {
  it("본인 최초 저장은 암호문으로만 저장되고 평문 컬럼은 비어 있다", () => {
    const c = createProfile("consultant", "c1");
    save(c, c, false);
    expect(psql(`select account_number is null, account_number_enc is not null, account_number_last4 from consultant_payout_accounts where consultant_id = '${c}';`)).toBe("t|t|6789");
    expect(psql(`select position('${NUMBER}' in encode(account_number_enc, 'escape')) from consultant_payout_accounts where consultant_id = '${c}';`)).toBe("0");
    expect(psql(`select action, entered_by_admin from consultant_payout_account_events where consultant_id = '${c}';`)).toBe("created|f");
  });

  it("이미 등록한 뒤 본인이 다시 저장하면 DB가 LOCKED로 거절한다", () => {
    const c = createProfile("consultant", "c2");
    save(c, c, false);
    expect(psqlError(`select save_consultant_payout_account('${c}'::uuid, '${c}'::uuid, false, 'Kim', 'K', '${NEW_NUMBER}', 'KRW', 'KR', null);`)).toMatch(/LOCKED/);
    expect(psql(`select account_number_last4 from consultant_payout_accounts where consultant_id = '${c}';`)).toBe("6789");
  });

  it("컨설턴트가 아닌 계정(교사)은 컨설턴트 계좌를 만들 수 없다", () => {
    const t = createProfile("teacher", "tt");
    expect(psqlError(`select save_consultant_payout_account('${t}'::uuid, '${t}'::uuid, false, 'K', 'K', '${NUMBER}', 'KRW', 'KR', null);`)).toMatch(/컨설턴트 계정이 아닙니다/);
  });

  it("authenticated 역할은 암호문 컬럼을 직접 select할 수 없다", () => {
    const c = createProfile("consultant", "c3");
    save(c, c, false);
    expect(psqlError(`set role authenticated; select account_number_enc from consultant_payout_accounts where consultant_id = '${c}';`)).toMatch(/permission denied/i);
  });
});

describe("컨설턴트 계좌 — 관리자 대리 입력·알림·권한 매트릭스·reveal 감사", () => {
  it("마스터가 대신 수정하면 이력(관리자 입력, 끝 4자리)과 본인 영문 알림이 남고 번호 전체는 어디에도 없다", () => {
    const c = createProfile("consultant", "c4");
    const master = createProfile("admin", "m", "master");
    save(c, c, false);
    save(c, master, true, NEW_NUMBER);
    expect(psql(`select action, entered_by_admin, previous_last4, new_last4 from consultant_payout_account_events where consultant_id = '${c}' order by created_at desc limit 1;`)).toBe("updated|t|6789|4321");
    expect(psql(`select message from payout_teacher_notices where teacher_id = '${c}' and kind = 'payout_account_updated';`)).toBe(
      "Your payout account details were updated by ALTON staff. If this was not expected, contact us."
    );
    for (const table of ["consultant_payout_account_events", "payout_teacher_notices"]) {
      const col = table === "payout_teacher_notices" ? "teacher_id" : "consultant_id";
      expect(psql(`select count(*) from ${table} t where t.${col} = '${c}' and t::text like '%${NEW_NUMBER}%';`)).toBe("0");
    }
  });

  it("권한 없는 관리자·정산권한 없는 supervisor·교사는 대리 입력과 reveal이 거절된다", () => {
    const c = createProfile("consultant", "c5");
    const full = createProfile("admin", "f", "full");
    const sup = createProfile("admin", "s", "supervisor");
    const teacher = createProfile("teacher", "tt2");
    save(c, c, false);
    for (const actor of [full, sup, teacher]) {
      expect(psqlError(`select save_consultant_payout_account('${c}'::uuid, '${actor}'::uuid, true, 'K', 'K', '${NUMBER}', 'KRW', 'KR', null);`)).toMatch(/권한/);
      expect(psqlError(`select * from reveal_consultant_payout_account('${c}'::uuid, '${actor}'::uuid);`)).toMatch(/권한/);
    }
    expect(psql(`select count(*) from consultant_payout_account_reveals where consultant_id = '${c}';`)).toBe("0");
  });

  it("마스터·정산권한 보유자는 reveal 가능하고 호출마다 감사 행(번호 제외)이 남는다", () => {
    const c = createProfile("consultant", "c6");
    const master = createProfile("admin", "m2", "master");
    const cap = createProfile("admin", "cap", "supervisor");
    psql(`insert into supervisor_capabilities (profile_id, capability) values ('${cap}', '정산권한');`);
    save(c, c, false);
    expect(psql(`select account_number from reveal_consultant_payout_account('${c}'::uuid, '${master}'::uuid, '수동 송금');`)).toBe(NUMBER);
    expect(psql(`select account_number from reveal_consultant_payout_account('${c}'::uuid, '${cap}'::uuid, '정산 대조 확인');`)).toBe(NUMBER);
    expect(psqlError(`select * from reveal_consultant_payout_account('${c}'::uuid, '${master}'::uuid);`)).toMatch(/5자 이상/);
    expect(psql(`select count(*) from consultant_payout_account_reveals where consultant_id = '${c}';`)).toBe("2");
    expect(psql(`select count(*) from consultant_payout_account_reveals r where r.consultant_id = '${c}' and r::text like '%${NUMBER}%';`)).toBe("0");
    expect(psqlError(`update consultant_payout_account_reveals set reason = 'x' where consultant_id = '${c}';`)).toMatch(/INSERT-only/);
  });

  it("authenticated 역할은 reveal 함수를 직접 호출할 수 없다", () => {
    const c = createProfile("consultant", "c7");
    save(c, c, false);
    expect(psqlError(`set role authenticated; select * from reveal_consultant_payout_account('${c}'::uuid, '${c}'::uuid);`)).toMatch(/permission denied/i);
  });
});
