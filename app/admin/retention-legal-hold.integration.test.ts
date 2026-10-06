import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// legal hold + Smart Notes Drive 삭제 큐(20262100000082/83). BEGIN…ROLLBACK 한 트랜잭션, FK 트리거 off.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `rh-${Date.now()}`;
const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001";

function run(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
    encoding: "utf-8",
    input: `begin; set local session_replication_role = replica; ${sql} rollback;`,
  });
}
const lines = (o: string) =>
  o.trim().split("\n").filter((l) => l !== "service_role" && l !== ADMIN && !/^(BEGIN|SET|ROLLBACK|INSERT .*|UPDATE .*|DELETE .*|TRUNCATE.*)$/.test(l));
const svc = `set local role service_role; select set_config('request.jwt.claim.role','service_role',true);`;
const asAdmin = `select set_config('request.jwt.claim.sub','${ADMIN}',true); set local role authenticated;`;

describe("legal hold", () => {
  it("review_by 필수·12개월 초과 거부, 등록·연장·해제는 이력에 남고 해제 전엔 자동 해제 없음", () => {
    const s = (rb: string) => `${asAdmin} select place_legal_hold('profile','00000000-0000-0000-0000-0000000c0001',array['all'],'${RUN} dispute hold', ${rb});`;
    expect(() => run(s("null"))).toThrow(/review_by/);
    expect(() => run(s("current_date + 400"))).toThrow(/12개월/);
    const out = lines(run(`
      ${asAdmin}
      select place_legal_hold('profile','00000000-0000-0000-0000-0000000c0001',array['all'],'${RUN} dispute hold', current_date + 30) is not null;
      select has_active_legal_hold('profile','00000000-0000-0000-0000-0000000c0001');
      select has_active_legal_hold('profile','00000000-0000-0000-0000-0000000c0002');
      select extend_legal_hold((select id from legal_holds where reason like '${RUN}%'), current_date + 200, 'extend: still in dispute');
      select release_legal_hold((select id from legal_holds where reason like '${RUN}%'), 'resolved');
      select has_active_legal_hold('profile','00000000-0000-0000-0000-0000000c0001');
      reset role;
      select string_agg(event_type, ',' order by created_at, event_type) from legal_hold_events where hold_id = (select id from legal_holds where reason like '${RUN}%');
    `));
    expect(out[0]).toBe("t");
    expect(out[1]).toBe("t");
    expect(out[2]).toBe("f");
    expect(out[out.length - 2]).toBe("f");
    expect(out[out.length - 1]).toContain("placed");
    expect(out[out.length - 1]).toContain("extended");
    expect(out[out.length - 1]).toContain("released");
  });

  it("hold가 걸린 알림 수신자는 90일 삭제에서 제외되고 review_by 도래 시 알림만 생성한다", () => {
    const out = lines(run(`
      insert into notifications (recipient_id, text, created_at) values
        ('00000000-0000-0000-0000-0000000d0001','${RUN} held', now() - interval '120 days'),
        ('00000000-0000-0000-0000-0000000d0002','${RUN} free', now() - interval '120 days');
      insert into legal_holds (subject_type, subject_id, reason, set_by, review_by)
        values ('profile','00000000-0000-0000-0000-0000000d0001','${RUN} hold overdue', '${ADMIN}', current_date - 1);
      ${svc}
      select retention_delete_expired_notifications(10000, false) >= 1;
      select legal_hold_notify_reviews_due() >= 1;
      reset role;
      select string_agg(text, '|' order by text) from notifications where text like '${RUN}%';
      select count(*) from legal_holds where reason like '${RUN}%' and released_at is null;
    `));
    expect(out[0]).toBe("t");
    expect(out[1]).toBe("t");
    expect(out[2]).toBe(`${RUN} held`);
    expect(out[3]).toBe("1"); // review_by 가 지나도 자동 해제되지 않는다
  });
});

describe("Smart Notes 보존 큐", () => {
  const setup = `
    insert into sessions (id, subject_enrollment_id, actual_end_at, reservation_id, teacher_id, lesson_type_id, scheduled_duration_minutes) select v.id, v.e, v.t, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 30 from (values
      ('00000000-0000-0000-0000-0000000e0001'::uuid, '00000000-0000-0000-0000-0000000e00a1'::uuid, now() - interval '13 months'),
      ('00000000-0000-0000-0000-0000000e0002'::uuid, '00000000-0000-0000-0000-0000000e00a1'::uuid, now() - interval '2 months'),
      ('00000000-0000-0000-0000-0000000e0003'::uuid, '00000000-0000-0000-0000-0000000e00a2'::uuid, now() - interval '14 months')) as v(id, e, t);
    insert into session_smart_notes (session_id, drive_file_id) values
      ('00000000-0000-0000-0000-0000000e0001','${RUN}-old'),
      ('00000000-0000-0000-0000-0000000e0002','${RUN}-new'),
      ('00000000-0000-0000-0000-0000000e0003','${RUN}-held');
    insert into legal_holds (subject_type, subject_id, reason, set_by, review_by)
      values ('session','00000000-0000-0000-0000-0000000e0003','${RUN} hold session','${ADMIN}', current_date + 30);
  `;
  it("수업 종료 1년 지난 파일만 큐에 적재(수강 지속과 무관, hold 제외)하고 DB 행은 삭제 성공 전까지 남긴다", () => {
    const out = lines(run(`
      ${setup}
      ${svc}
      select retention_enqueue_expired_smart_notes(1000, false);
      select retention_enqueue_expired_smart_notes(1000, false);
      reset role;
      select string_agg(drive_file_id, ',') from retention_deletion_targets where drive_file_id like '${RUN}%';
      select count(*) from session_smart_notes where drive_file_id like '${RUN}%';
      ${svc}
      select retention_finalize_deleted_smart_notes(1000, false);
      reset role;
      select count(*) from session_smart_notes where drive_file_id like '${RUN}%';
    `));
    expect(out[1]).toBe("0"); // 두 번째 실행은 멱등
    expect(out[2]).toBe(`${RUN}-old`);
    expect(out[3]).toBe("3");
    expect(out[out.length - 1]).toBe("3"); // 아직 Drive 삭제 전 → DB 행 유지
  });
  it("Drive 삭제 성공 후에만 DB 행 정리, 실패는 failed로 남아 재시도 대상", () => {
    const out = lines(run(`
      ${setup}
      ${svc}
      select retention_enqueue_expired_smart_notes(1000, false);
      select count(*) from retention_claim_deletion_targets(50) where drive_file_id like '${RUN}%';
      select retention_mark_deletion_result((select id from retention_deletion_targets where drive_file_id='${RUN}-old'), false, 'Drive 500');
      reset role;
      select status || ':' || last_error from retention_deletion_targets where drive_file_id='${RUN}-old';
      update retention_deletion_targets set next_attempt_at = now() where drive_file_id='${RUN}-old';
      ${svc}
      select retention_mark_deletion_result((select id from retention_deletion_targets where drive_file_id='${RUN}-old'), true);
      select retention_finalize_deleted_smart_notes(1000, false);
      reset role;
      select count(*) from session_smart_notes where drive_file_id = '${RUN}-old';
      select count(*) from session_smart_notes where drive_file_id = '${RUN}-held';
    `));
    expect(out).toContain("failed:Drive 500");
    expect(out[out.length - 2]).toBe("0");
    expect(out[out.length - 1]).toBe("1");
  });
  it("hold가 걸린 파일은 워커가 가져가지 않는다", () => {
    const out = lines(run(`
      ${setup}
      insert into retention_deletion_targets (category, source_table, source_id, session_id, drive_file_id, due_at)
        values ('lesson_ai_artifacts','session_smart_notes','00000000-0000-0000-0000-0000000e0003','00000000-0000-0000-0000-0000000e0003','${RUN}-held', now());
      ${svc}
      select count(*) from retention_claim_deletion_targets(50) where drive_file_id = '${RUN}-held';
    `));
    expect(out[out.length - 1]).toBe("0");
  });
});
