import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 20262100000220 — 읽기 전용 리포트 + 아동 삭제 요청 데이터 모델. BEGIN…ROLLBACK, 삭제 없음.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `dm-${Date.now()}`;
const HOLDER = "aaaaaaaa-0000-0000-0000-000000000001";
const GUARD = "00000000-0000-0000-0000-0000000g0001".replace("g", "a");
const KID = "00000000-0000-0000-0000-0000000a0002";
const HH = "00000000-0000-0000-0000-0000000a0003";
const STRANGER = "00000000-0000-0000-0000-0000000a0004";
const lines = (o: string) =>
  o.trim().split("\n").filter((l) => !["service_role", HOLDER, GUARD, STRANGER].includes(l) && l !== "" && !/^(BEGIN|SET|ROLLBACK|INSERT .*|UPDATE .*|DELETE .*)$/.test(l));
function run(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
    encoding: "utf-8",
    input: `begin;
      insert into supervisor_capabilities (profile_id, capability) values ('${HOLDER}','legal_hold_holder') on conflict do nothing;
      set local session_replication_role = replica;
      insert into household_members (household_id, profile_id, role) values ('${HH}','${GUARD}','guardian'), ('${HH}','${KID}','child');
      ${sql} rollback;`,
  });
}
const as = (id: string) => `select set_config('request.jwt.claim.sub','${id}',true); set local role authenticated;`;
const svc = `set local role service_role; select set_config('request.jwt.claim.role','service_role',true);`;

describe("가족 메시지 건 보존 리포트(읽기 전용)", () => {
  it("건 종료+2년 경과 건만 eligible, hold 건은 held, 어떤 행도 삭제하지 않는다", () => {
    const out = lines(run(`
      insert into household_inquiries (id, household_id, status, opened_by, opened_by_role, closed_at, last_message_at) values
        ('00000000-0000-0000-0000-0000000a1001','${HH}','closed','${GUARD}','admin', now() - interval '3 years', now() - interval '3 years'),
        ('00000000-0000-0000-0000-0000000a1002','${HH}','open','${GUARD}','admin', null, now() - interval '1 month');
      insert into household_messages (household_id, sender_id, sender_role, body, inquiry_id) values
        ('${HH}','${GUARD}','guardian','${RUN}','00000000-0000-0000-0000-0000000a1001'),
        ('${HH}','${GUARD}','guardian','${RUN}','00000000-0000-0000-0000-0000000a1002');
      ${svc}
      select inquiry_id::text || ':' || eligible || ':' || held from household_message_case_retention_report() where household_id = '${HH}' order by 1;
      reset role;
      insert into legal_holds (subject_type, subject_id, reason, set_by, review_by) values ('household','${HH}','${RUN} hold reason','${HOLDER}', current_date+30);
      ${svc}
      select inquiry_id::text || ':' || eligible || ':' || held from household_message_case_retention_report() where household_id = '${HH}' order by 1;
      reset role;
      select count(*) from household_messages where body = '${RUN}';
    `));
    expect(out).toEqual([
      "00000000-0000-0000-0000-0000000a1001:true:false",
      "00000000-0000-0000-0000-0000000a1002:false:false",
      "00000000-0000-0000-0000-0000000a1001:false:true",
      "00000000-0000-0000-0000-0000000a1002:false:true",
      "2",
    ]);
  });
});

describe("레거시 채팅 리포트·무료회원 범위 데이터", () => {
  it("리포트 키가 있고 범위표에 delete/anonymize 정책이 들어 있다", () => {
    const out = lines(run(`
      ${svc}
      select legacy_chat_usage_report() ? 'chat_messages_last_write';
      select household_messages_without_case_count() >= 0;
      reset role;
      select count(*) filter (where action = 'delete') >= 3 from retention_free_member_scope;
    `));
    expect(out).toEqual(["t", "t", "t"]);
  });
});

describe("아동 삭제 요청 데이터 모델", () => {
  it("보호자만 요청 가능, 타 가구는 거부, 삭제는 일어나지 않고 archive 요청과 연동되지 않는다", () => {
    expect(() => run(`${as(STRANGER)} select request_child_deletion('${KID}','${HH}',array['all'],'${RUN} not a member');`)).toThrow(/guardian/);
    const out = lines(run(`
      ${as(GUARD)}
      select request_child_deletion('${KID}','${HH}',array['free_learning','messages'],'${RUN} parent request') is not null;
      reset role;
      insert into household_archive_requests (household_id, status, requested_by) values ('${HH}','processing','${GUARD}');
      select status from child_deletion_requests where reason like '${RUN}%';
    `));
    expect(out).toEqual(["t", "requested"]);
  });
  it("예외는 지정자만, 해당 아동의 활성 hold와 연결·사유·기간 필수", () => {
    const base = `
      insert into child_deletion_requests (id, child_id, household_id, requested_by, target_scope, reason)
        values ('00000000-0000-0000-0000-0000000a2001','${KID}','${HH}','${GUARD}',array['all'],'${RUN} parent request');
      insert into legal_holds (id, subject_type, subject_id, reason, set_by, review_by)
        values ('00000000-0000-0000-0000-0000000a2002','student','${KID}','${RUN} hold reason','${HOLDER}', current_date+30),
               ('00000000-0000-0000-0000-0000000a2003','student','${STRANGER}','${RUN} other kid hold','${HOLDER}', current_date+30);`;
    expect(() => run(`${base} ${as(GUARD)} select record_child_deletion_exception('00000000-0000-0000-0000-0000000a2001','00000000-0000-0000-0000-0000000a2002','${RUN} exception reason', current_date+30);`)).toThrow(/지정된/);
    expect(() => run(`${base} ${as(HOLDER)} select record_child_deletion_exception('00000000-0000-0000-0000-0000000a2001','00000000-0000-0000-0000-0000000a2003','${RUN} exception reason', current_date+30);`)).toThrow(/활성 legal hold/);
    expect(() => run(`${base} ${as(HOLDER)} select record_child_deletion_exception('00000000-0000-0000-0000-0000000a2001','00000000-0000-0000-0000-0000000a2002','short', current_date+30);`)).toThrow(/사유/);
    const out = lines(run(`${base} ${as(HOLDER)}
      select record_child_deletion_exception('00000000-0000-0000-0000-0000000a2001','00000000-0000-0000-0000-0000000a2002','${RUN} exception reason', current_date+30);
      reset role;
      select exception_hold_id::text from child_deletion_requests where id = '00000000-0000-0000-0000-0000000a2001';`));
    expect(out).toEqual(["00000000-0000-0000-0000-0000000a2002"]);
  });
});
