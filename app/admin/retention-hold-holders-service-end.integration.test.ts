import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 20262100000100 — legal hold 지정자·요청 흐름, tutoring_service_end, 삭제 큐 7일 에스컬레이션.
// BEGIN…ROLLBACK, 실행 ID 라벨. 일반 관리자는 테스트용 auth/profile 을 트랜잭션 안에서 만든다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `hh-${Date.now()}`;
const HOLDER = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-0000000f0001";
const lines = (o: string) =>
  o.trim().split("\n").filter((l) => l !== "service_role" && l !== HOLDER && l !== OTHER && !/^(BEGIN|SET|ROLLBACK|INSERT .*|UPDATE .*|DELETE .*)$/.test(l));
function run(sql: string, holder = true): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
    encoding: "utf-8",
    input: `begin;
      ${holder ? `insert into supervisor_capabilities (profile_id, capability) values ('${HOLDER}','legal_hold_holder') on conflict do nothing;` : ""}
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        values ('00000000-0000-0000-0000-000000000000','${OTHER}','authenticated','authenticated','${RUN}@example.com','x',now(),'{}','{}',now(),now());
      insert into profiles (id, role, name) values ('${OTHER}','admin','${RUN} other admin');
      set local session_replication_role = replica;
      ${sql} rollback;`,
  });
}
const as = (id: string) => `select set_config('request.jwt.claim.sub','${id}',true); set local role authenticated;`;
const svc = `set local role service_role; select set_config('request.jwt.claim.role','service_role',true);`;

describe("legal hold 지정자 제한과 요청", () => {
  it("지정자가 아닌 관리자는 설정·연장·해제 불가, 요청만 가능하며 지정자에게 알림이 간다", () => {
    expect(() => run(`${as(OTHER)} select place_legal_hold('global',null,array['all'],'${RUN} direct attempt', current_date+30);`)).toThrow(/지정된/);
    const out = lines(run(`
      ${as(OTHER)}
      select request_legal_hold('profile','00000000-0000-0000-0000-0000000f0009',array['all'],'${RUN} needs hold') is not null;
      reset role;
      select count(*) from notifications where recipient_id = '${HOLDER}' and text like 'Legal hold request pending%';
      ${as(OTHER)}
      select decide_legal_hold_request((select id from legal_hold_requests where reason like '${RUN}%'), true, 'x', current_date+30);
    `.replace(/select decide[^;]*;/, "")));
    expect(out[0]).toBe("t");
    expect(Number(out[1])).toBeGreaterThanOrEqual(1);
  });
  it("지정자가 요청을 승인하면 review_by 필수로 hold가 생기고 요청 상태가 기록된다", () => {
    expect(() => run(`${as(HOLDER)} select decide_legal_hold_request(null, true, 'n', null);`)).toThrow();
    const out = lines(run(`
      insert into legal_hold_requests (id, subject_type, subject_id, reason, requested_by)
        values ('00000000-0000-0000-0000-0000000f1001','student','00000000-0000-0000-0000-0000000f0009','${RUN} request reason','${OTHER}');
      ${as(HOLDER)}
      select decide_legal_hold_request('00000000-0000-0000-0000-0000000f1001', true, 'ok', current_date+60) is not null;
      reset role;
      select status from legal_hold_requests where id = '00000000-0000-0000-0000-0000000f1001';
      select has_active_legal_hold('student','00000000-0000-0000-0000-0000000f0009');
    `));
    expect(out).toEqual(["t", "approved", "t"]);
    expect(() => run(`
      insert into legal_hold_requests (id, subject_type, subject_id, reason, requested_by)
        values ('00000000-0000-0000-0000-0000000f1002','student','00000000-0000-0000-0000-0000000f0009','${RUN} request reason','${OTHER}');
      ${as(HOLDER)} select decide_legal_hold_request('00000000-0000-0000-0000-0000000f1002', true, 'ok', null);`)).toThrow(/review_by/);
  });
});

describe("tutoring_service_end", () => {
  const child = "00000000-0000-0000-0000-0000000f2001";
  const enr = (id: string, status: string, upd: string) =>
    `insert into subject_enrollments (id, child_id, subject_id, contract_id, status, updated_at) values ('${id}','${child}',gen_random_uuid(),gen_random_uuid(),'${status}', ${upd});`;
  it("진행 중 수강이 있으면 NULL, 모두 종료되면 가장 늦은 종료 시각, 재가입은 다시 NULL", () => {
    const e1 = "00000000-0000-0000-0000-0000000f2011";
    const e2 = "00000000-0000-0000-0000-0000000f2012";
    const out = lines(run(`
      ${enr(e1, "completed", "now() - interval '300 days'")}
      insert into sessions (id, subject_enrollment_id, actual_end_at, reservation_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
        values (gen_random_uuid(), '${e1}', now() - interval '200 days', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 30);
      ${svc}
      select (tutoring_service_end('${child}') between now() - interval '201 days' and now() - interval '199 days');
      reset role;
      ${enr(e2, "active", "now()")}
      ${svc}
      select tutoring_service_end('${child}') is null;
      reset role;
      update subject_enrollments set status = 'terminated', updated_at = now() - interval '10 days' where id = '${e2}';
      ${svc}
      select (tutoring_service_end('${child}') between now() - interval '11 days' and now() - interval '9 days');
      select tutoring_service_end('00000000-0000-0000-0000-0000000f2999') is null;
    `));
    expect(out).toEqual(["t", "t", "t", "t"]);
  });
});

describe("삭제 큐 7일 실패 에스컬레이션", () => {
  it("7일 이상 실패한 건은 failed 유지·file id 보존·담당자 알림, 완료 처리하지 않는다(1회만)", () => {
    const out = lines(run(`
      insert into retention_deletion_targets (category, source_table, source_id, drive_file_id, due_at, status, last_error, first_failed_at)
        values ('lesson_ai_artifacts','session_smart_notes','x1','${RUN}-f', now(), 'failed', 'Drive 500', now() - interval '8 days'),
               ('lesson_ai_artifacts','session_smart_notes','x2','${RUN}-g', now(), 'failed', 'Drive 500', now() - interval '2 days');
      ${svc}
      select retention_escalate_stuck_deletions() >= 1;
      select retention_escalate_stuck_deletions();
      reset role;
      select status || ':' || (escalated_at is not null) from retention_deletion_targets where drive_file_id = '${RUN}-f';
      select status || ':' || (escalated_at is not null) from retention_deletion_targets where drive_file_id = '${RUN}-g';
      select count(*) >= 1 from notifications where recipient_id = '${HOLDER}' and text like '%${RUN}-f%';
    `));
    expect(out).toEqual(["t", "0", "failed:true", "failed:false", "t"]);
  });
});
