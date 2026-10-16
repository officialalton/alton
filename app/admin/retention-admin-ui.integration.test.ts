import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 보존 관리자 화면(20262100000180) — 삭제 큐 재시도 권한 매트릭스·이벤트 기록·hold 검사, 보류/삭제 큐 RLS.
// BEGIN…ROLLBACK, 실행 ID 라벨, 테스트 계정은 트랜잭션 안에서 생성(공식 계정·기존 데이터 불변).
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `ru-${Date.now()}`;
const HOLDER = "aaaaaaaa-0000-0000-0000-000000000001";
const PLAIN = "00000000-0000-0000-0000-0000000f3001"; // 일반 관리자
const MASTER = "00000000-0000-0000-0000-0000000f3002"; // 마스터(비지정자)
const STUDENT = "00000000-0000-0000-0000-0000000f3003"; // 비관리자
const T_FAILED = "00000000-0000-0000-0000-0000000f3101";
const T_PENDING = "00000000-0000-0000-0000-0000000f3102";
const T_HELD = "00000000-0000-0000-0000-0000000f3103";
const SESSION_HELD = "00000000-0000-0000-0000-0000000f3201";
const IDS = new Set([HOLDER, PLAIN, MASTER, STUDENT]);

const lines = (o: string) =>
  o.trim().split("\n").filter((l) => l !== "" && l !== "service_role" && !IDS.has(l) && !/^(BEGIN|SET|ROLLBACK|INSERT .*|UPDATE .*|DELETE .*)$/.test(l));
function run(sql: string): string {
  const user = (id: string, role: string, tier: string | null) => `
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000','${id}','authenticated','authenticated','${RUN}-${id.slice(-4)}@example.com','x',now(),'{}','{}',now(),now());
    insert into profiles (id, role, name, admin_tier) values ('${id}','${role}','${RUN} ${id.slice(-4)}', ${tier ? `'${tier}'` : "null"});`;
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
    encoding: "utf-8",
    input: `begin;
      insert into supervisor_capabilities (profile_id, capability) values ('${HOLDER}','legal_hold_holder') on conflict do nothing;
      ${user(PLAIN, "admin", "full")} ${user(MASTER, "admin", "master")} ${user(STUDENT, "student", null)}
      set local session_replication_role = replica;
      insert into retention_deletion_targets (id, category, source_table, source_id, drive_file_id, due_at, status, attempts, last_error, first_failed_at) values
        ('${T_FAILED}','lesson_ai_artifacts','session_smart_notes','${RUN}-a','${RUN}-fileA', now(), 'failed', 3, 'boom', now() - interval '2 days'),
        ('${T_PENDING}','lesson_ai_artifacts','session_smart_notes','${RUN}-b','${RUN}-fileB', now(), 'pending', 0, null, null),
        ('${T_HELD}','lesson_ai_artifacts','session_smart_notes','${RUN}-c','${RUN}-fileC', now(), 'failed', 1, 'x', now());
      update retention_deletion_targets set session_id = '${SESSION_HELD}' where id = '${T_HELD}';
      ${sql} rollback;`,
  });
}
const as = (id: string) => `select set_config('request.jwt.claim.sub','${id}',true); set local role authenticated;`;

describe("삭제 큐 재시도 권한 매트릭스", () => {
  it("일반 관리자는 거부, 지정자·마스터는 failed 건을 pending으로 되돌리고 이벤트가 남는다", () => {
    expect(() => run(`${as(PLAIN)} select retention_retry_deletion_target('${T_FAILED}', 'x');`)).toThrow(/지정된 legal hold 담당자 또는 마스터/);
    expect(() => run(`${as(STUDENT)} select retention_retry_deletion_target('${T_FAILED}', 'x');`)).toThrow();
    const out = lines(run(`
      ${as(HOLDER)}
      select retention_retry_deletion_target('${T_FAILED}', '${RUN} holder retry');
      reset role;
      select status, attempts from retention_deletion_targets where id = '${T_FAILED}';
      ${as(MASTER)}
      select retention_retry_deletion_target('${T_HELD}', '${RUN} master retry');
      reset role;
      select count(*) from retention_deletion_events where target_id in ('${T_FAILED}','${T_HELD}') and event_type = 'manual_retry';
      select string_agg(actor_id::text, ',' order by actor_id) from retention_deletion_events where target_id in ('${T_FAILED}','${T_HELD}');
    `));
    expect(out[0]).toBe("pending|3"); // 시도 횟수 보존
    expect(out[1]).toBe("2");
    expect(out[2]).toContain(HOLDER);
    expect(out[2]).toContain(MASTER);
  });

  it("failed가 아닌 건은 거부, 활성 hold(전체·세션)가 있으면 거부되고 상태·이벤트가 바뀌지 않는다", () => {
    expect(() => run(`${as(HOLDER)} select retention_retry_deletion_target('${T_PENDING}', 'x');`)).toThrow(/failed/);
    expect(() =>
      run(`insert into legal_holds (subject_type, subject_id, reason, set_by, review_by) values ('session','${SESSION_HELD}','${RUN} hold reason','${HOLDER}', current_date+30);
           ${as(HOLDER)} select retention_retry_deletion_target('${T_HELD}', 'x');`)
    ).toThrow(/legal hold/);
    expect(() =>
      run(`insert into legal_holds (subject_type, reason, set_by, review_by) values ('global','${RUN} global hold','${HOLDER}', current_date+30);
           ${as(HOLDER)} select retention_retry_deletion_target('${T_FAILED}', 'x');`)
    ).toThrow(/legal hold/);
  });

  it("이벤트는 직접 INSERT/UPDATE/DELETE 불가(함수로만, INSERT-only)", () => {
    expect(() => run(`${as(HOLDER)} insert into retention_deletion_events (target_id, event_type) values ('${T_FAILED}','manual_retry');`)).toThrow();
    expect(() =>
      run(`${as(HOLDER)} select retention_retry_deletion_target('${T_FAILED}', 'x'); reset role; set local session_replication_role = origin; update retention_deletion_events set note = 'tamper';`)
    ).toThrow(/INSERT-only/);
  });
});

describe("보존 화면 조회 RLS", () => {
  it("관리자는 보류·요청·이벤트·삭제 큐를 보고, 비관리자는 아무것도 보지 못한다", () => {
    const seed = `
      insert into legal_holds (id, subject_type, reason, set_by, review_by) values ('00000000-0000-0000-0000-0000000f3301','global','${RUN} global hold','${HOLDER}', current_date+30);
      insert into legal_hold_events (hold_id, event_type, actor_id) values ('00000000-0000-0000-0000-0000000f3301','placed','${HOLDER}');
      insert into legal_hold_requests (subject_type, reason, requested_by) values ('global','${RUN} request reason','${PLAIN}');`;
    const q = `select (select count(*) from legal_holds where reason like '${RUN}%'),
                      (select count(*) from legal_hold_events where hold_id = '00000000-0000-0000-0000-0000000f3301'),
                      (select count(*) from legal_hold_requests where reason like '${RUN}%'),
                      (select count(*) from retention_deletion_targets where source_id like '${RUN}%'),
                      (select count(*) from retention_deletion_events);`;
    const admin = lines(run(`${seed} ${as(PLAIN)} ${q}`));
    expect(admin[0]).toBe("1|1|1|3|0");
    const student = lines(run(`${seed} ${as(STUDENT)} ${q}`));
    expect(student[0]).toBe("0|0|0|0|0");
  });

  it("비지정 관리자는 보류 설정·연장·해제·요청 처리를 못 하고 요청은 할 수 있다", () => {
    expect(() => run(`${as(PLAIN)} select place_legal_hold('global',null,array['all'],'${RUN} direct attempt', current_date+30);`)).toThrow(/지정된/);
    expect(() => run(`${as(MASTER)} select place_legal_hold('global',null,array['all'],'${RUN} master attempt', current_date+30);`)).toThrow(/지정된/);
    const out = lines(run(`${as(PLAIN)} select request_legal_hold('global',null,array['all'],'${RUN} please hold') is not null;`));
    expect(out[0]).toBe("t");
  });
});
