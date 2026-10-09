import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 웹훅 이벤트 저장소·거래 상세 마이그레이션(320) 통합 검증. 모든 쓰기는 트랜잭션 안에서 ROLLBACK한다(실행 ID 데이터).
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `wh${Date.now().toString(36)}`;
function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function fails(sql: string, pattern: RegExp) {
  let err = "";
  try { psql(sql); } catch (e) { err = String((e as { stderr?: Buffer | string }).stderr ?? e); }
  expect(err).toMatch(pattern);
}

describe("payout_webhook_events / mercury 상세 컬럼", () => {
  it("event_id 중복은 거부되고(멱등 키), 롤백으로 흔적이 남지 않는다", () => {
    fails(`begin; insert into payout_webhook_events (event_id, payload_sha256) values ('${RUN}-e1','h'); insert into payout_webhook_events (event_id, payload_sha256) values ('${RUN}-e1','h'); rollback;`, /duplicate key|payout_webhook_events_pkey/);
    expect(psql(`select count(*) from payout_webhook_events where event_id like '${RUN}%'`)).toBe("0");
  });
  it("대시보드 링크 체크 제약과 상세 기록 함수가 있고 anon/authenticated는 실행할 수 없다", () => {
    expect(psql(`select pg_get_constraintdef(oid) from pg_constraint where conname='payout_attempts_mercury_dashboard_url_check'`)).toContain("mercury");
    expect(psql(`select has_function_privilege('anon','public.record_payout_attempt_mercury_details(uuid,text,date,timestamptz)','execute')::int::text || has_function_privilege('authenticated','public.record_payout_attempt_mercury_details(uuid,text,date,timestamptz)','execute')::int`)).toBe("00");
  });
  it("RLS가 켜져 있고 정책이 없어 서비스 역할만 접근한다", () => {
    expect(psql(`select relrowsecurity from pg_class where relname='payout_webhook_events'`)).toBe("t");
    expect(psql(`select count(*) from pg_policies where tablename='payout_webhook_events'`)).toBe("0");
  });

  // 웹훅 핸들러가 호출하는 DB 함수 경로(시스템 호출 actor=null)를 실제 지급 시도로 검증한다. 한 트랜잭션에서 게이트를 열고 ROLLBACK한다.
  function scenario(body: string): string {
    const sql = `begin;
update payout_disbursement_gate set real_disbursement_enabled = true where id;
do $$
declare uid uuid := gen_random_uuid(); tid uuid := gen_random_uuid(); b uuid; a uuid; n int; st text;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', '${RUN}-m@example.com', 'x', now(), '{}', '{}', now(), now());
  insert into profiles (id, role, name, admin_tier) values (uid, 'admin', '${RUN}master', 'master');
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', tid, 'authenticated', 'authenticated', '${RUN}-t@example.com', 'x', now(), '{}', '{}', now(), now());
  insert into profiles (id, role, name) values (tid, 'teacher', '${RUN}교사');
  insert into teachers (id, status) values (tid, 'pending');
  insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at, scheduled_payout_date)
    values (tid, '2026-10-01', '2026-10-15', 'USD', 'approved', now(), '2026-10-26') returning id into b;
  insert into payout_items (batch_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency, payable_minutes, amount_minor, status)
    values (b, tid, 'regular', 1000, 'USD', 60, 5000, 'approved');
  insert into payout_batch_audit_log (batch_id, action, actor_id) values (b, 'approved', uid);
  insert into payout_recipient_links (provider, recipient_kind, profile_id, provider_recipient_id, payout_currency, payout_country, bank_name, account_last4, status, verified_at)
    values ('mercury', 'teacher', tid, 'rcp-${RUN}', 'USD', 'US', 'Test Bank', '1234', 'verified', now());
  a := create_payout_attempt(b, null, 'normal', null, uid, 'mercury');
  perform approve_payout_attempt(a, uid);
  perform payout_attempt_transition(a, 'awaiting_mercury_approval', uid);
  perform payout_attempt_transition(a, 'processing', null);
  ${body}
end $$;
rollback;`;
    return psql(sql);
  }

  it("웹훅 sent: 거래 연결(actor null) → sent → 상세 저장, 반환은 returned로 기록되고 대시보드 링크 제약이 http를 거부한다", () => {
    scenario(`
      perform link_payout_attempt_transaction(a, 'tx-${RUN}', null);
      perform record_payout_attempt_mercury_details(a, 'https://app.mercury.com/transactions/x', '2026-10-12', null);
      perform payout_attempt_transition(a, 'sent', null);
      select status into st from payout_attempts where id = a; assert st = 'sent', 'sent expected';
      assert (select mercury_estimated_delivery_date::text from payout_attempts where id = a) = '2026-10-12';
      begin
        update payout_attempts set mercury_dashboard_url = 'http://app.mercury.com/x' where id = a;
        raise exception 'http url accepted';
      exception when check_violation then null; end;
      perform record_payout_attempt_return(a, null, 'rtx-${RUN}', 5000, 'Reversed by Mercury');
      select status into st from payout_attempts where id = a; assert st = 'returned', 'returned expected';
    `);
  });

  it("웹훅 failed: processing → failed(사유 기록), 불일치 플래그는 멱등이고 failed에서 sent 전이는 거부된다", () => {
    scenario(`
      perform link_payout_attempt_transaction(a, 'tx-${RUN}-f', null);
      perform payout_attempt_transition(a, 'failed', null, 'Insufficient funds');
      select status into st from payout_attempts where id = a; assert st = 'failed';
      assert (select failure_reason from payout_attempts where id = a) = 'Insufficient funds';
      perform payout_attempt_add_flag(a, 'mercury_webhook_status_mismatch');
      perform payout_attempt_add_flag(a, 'mercury_webhook_status_mismatch');
      assert (select cardinality(needs_review_reasons) from payout_attempts where id = a) = 1, 'flag must be idempotent';
      begin
        perform payout_attempt_transition(a, 'sent', null);
        raise exception 'failed->sent accepted';
      exception when others then
        if sqlerrm = 'failed->sent accepted' then raise; end if;
      end;
    `);
  });

  it("중복 이벤트: 같은 event_id 두 번째 INSERT는 unique_violation(핸들러는 duplicate 처리)", () => {
    scenario(`
      insert into payout_webhook_events (event_id, payload_sha256, attempt_id) values ('${RUN}-ev', 'h', a);
      begin
        insert into payout_webhook_events (event_id, payload_sha256) values ('${RUN}-ev', 'h');
        raise exception 'duplicate accepted';
      exception when unique_violation then null; end;
    `);
  });
});
