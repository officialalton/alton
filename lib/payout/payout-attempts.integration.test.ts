import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { ATTEMPT_STATUSES, ATTEMPT_TRANSITIONS, canTransition } from "./attempt-state";
import { KR_BANK_HOLIDAYS, krwTransferDate } from "./kr-bank-holidays";
import { transferRequestDate } from "./payout-schedule";

// Mercury 지급 통합(2026-10-07) — 시도 모델·상태 기계·멱등·승인 무효화·직무 분리·대사를 로컬 DB에서 검증한다.
// 실제 송금·외부 호출 없음. 실행 ID(RUN) 전용 교사·관리자·정산 데이터만 쓴다. 지급 게이트는 한 트랜잭션 안에서만 열고
// 같은 트랜잭션에서 닫는다. payout_attempt_events는 INSERT 전용이라 시도 행은 지울 수 없다(실행 ID 접두 교사로 식별 가능,
// 기존 정산 통합 테스트와 동일하게 승인된 정산 흔적은 남는다).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `pm${Date.now().toString(36)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").filter((l) => l !== "UPDATE 1" && !l.startsWith("UPDATE")).pop() ?? "";
}
/** 게이트를 이 트랜잭션 안에서만 연다. 마지막 문장의 결과를 돌려준다. */
function gated(sql: string): string {
  const out = execFileSync(
    "psql",
    [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", `update payout_disbursement_gate set real_disbursement_enabled = true where id; ${sql}; update payout_disbursement_gate set real_disbursement_enabled = false where id;`],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return out.trim().split("\n").filter((l) => !/^UPDATE \d+$/.test(l)).pop() ?? "";
}
function fails(fn: () => unknown, pattern: RegExp) {
  let err = "";
  try {
    fn();
  } catch (e) {
    err = String((e as { stderr?: Buffer | string }).stderr ?? e);
  }
  expect(err).toMatch(pattern);
}
function mkUser(label: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
}
function mkAdmin(label: string, tier: string | null, capability?: string): string {
  const id = mkUser(label);
  psql(`insert into profiles (id, role, name, admin_tier) values ('${id}', 'admin', '${RUN}${label}', ${tier ? `'${tier}'` : "null"});`);
  if (capability) psql(`insert into supervisor_capabilities (profile_id, capability) values ('${id}', '${capability}');`);
  return id;
}
function mkTeacher(): string {
  const id = mkUser("t");
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '${RUN}교사');`);
  psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  return id;
}
/** 승인된 정산 묶음 + 항목 1개(금액 합계 = amount). 정산 승인자는 settlementApprover. */
function mkApprovedBatch(teacher: string, currency: "USD" | "KRW", amount: number, deadline: string, settlementApprover: string): string {
  const b = psql(
    `insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at, scheduled_payout_date)
     values ('${teacher}', '2026-10-01', '2026-10-15', '${currency}', 'approved', now(), '${deadline}') returning id;`
  );
  psql(
    `insert into payout_items (batch_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency, payable_minutes, amount_minor, status)
     values ('${b}', '${teacher}', 'regular', 1000, '${currency}', 60, ${amount}, 'approved');`
  );
  psql(`insert into payout_batch_audit_log (batch_id, action, actor_id) values ('${b}', 'approved', '${settlementApprover}');`);
  return b;
}
function mkVerifiedLink(teacher: string, currency: "USD" | "KRW") {
  psql(
    `insert into payout_recipient_links (provider, recipient_kind, profile_id, provider_recipient_id, payout_currency, payout_country, bank_name, account_last4, status, verified_at)
     values ('mercury', 'teacher', '${teacher}', 'rcp-${RUN}-${teacher.slice(0, 8)}', '${currency}', '${currency === "USD" ? "US" : "KR"}', 'Test Bank', '1234', 'verified', now());`
  );
}
const attempt = (id: string, col: string) => psql(`select ${col} from payout_attempts where id = '${id}';`);

// 직무 분리용 사람들
const settler = mkAdmin("settler", "master");        // 정산 승인자
const requester = mkAdmin("requester", null, "payout_request_mercury"); // 시도 생성·거래 연결
const approver = mkAdmin("approver", null, "payout_approve_mercury");   // 지급 승인
const plainAdmin = mkAdmin("plain", null);           // capability 없음

afterAll(() => {
  // 시도·이벤트는 INSERT 전용 감사 기록이라 지우지 않는다. 승인 전 정산 흔적도 실행 ID로 식별된다.
});

describe("지급 시도 생성 — 정산 ↔ 시도 연결", () => {
  it("USD: 정산 금액·통화·기한이 시도에 스냅샷되고 송금 예정일은 기한보다 앞이다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 123456, "2026-10-26", settler);
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    expect(attempt(a, "settlement_batch_id")).toBe(b);
    expect(attempt(a, "recipient_profile_id")).toBe(t);
    expect(attempt(a, "contractual_amount_minor || ':' || contractual_currency || ':' || rail || ':' || manual_execution")).toBe("123456:USD:ach:false");
    expect(attempt(a, "payment_deadline::text")).toBe("2026-10-26");
    expect(attempt(a, "scheduled_transfer_date::text")).toBe(transferRequestDate("2026-10-26"));
    expect(Number(psql(`select (scheduled_transfer_date < payment_deadline)::int from payout_attempts where id='${a}'`))).toBe(1);
    expect(attempt(a, "status")).toBe("queued");
  });

  it("정산당 normal 시도는 하나 — 중복 클릭·재호출은 같은 시도를 돌려주고 직접 INSERT는 막힌다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 5000, "2026-10-26", settler);
    const a1 = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    const a2 = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    expect(a2).toBe(a1);
    expect(Number(psql(`select count(*) from payout_attempts where settlement_batch_id='${b}'`))).toBe(1);
    fails(
      () =>
        psql(`insert into payout_attempts (settlement_batch_id, recipient_profile_id, recipient_kind, period_start, period_end, provider, rail, contractual_amount_minor, contractual_currency, requested_amount_minor, requested_currency, payment_deadline, scheduled_transfer_date)
              values ('${b}', '${t}', 'teacher', '2026-10-01', '2026-10-15', 'mercury', 'ach', 5000, 'USD', 5000, 'USD', '2026-10-26', '2026-10-21');`),
      /payout_attempts_one_active_normal_batch/
    );
  });

  it("승인되지 않은 정산에는 시도를 만들 수 없고, capability 없는 사람은 만들 수 없다", () => {
    const t = mkTeacher();
    const draft = psql(`insert into payout_batches (teacher_id, period_start, period_end, currency, status) values ('${t}', '2026-10-01', '2026-10-15', 'USD', 'draft') returning id;`);
    fails(() => psql(`select create_payout_attempt('${draft}', null, 'normal', null, '${requester}', 'mercury');`), /approved\) 정산만/);
    const b = mkApprovedBatch(mkTeacher(), "USD", 100, "2026-10-26", settler);
    fails(() => psql(`select create_payout_attempt('${b}', null, 'normal', null, '${plainAdmin}', 'mercury');`), /권한이 없습니다/);
  });

  it("KRW: 원금(KRW)은 요청 통화로, USD 실비용은 별도 열로 — 수수료(회사 부담)는 원금에 섞이지 않는다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "KRW", 1500000, "2026-10-26", settler);
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    expect(attempt(a, "rail || ':' || manual_execution || ':' || requested_currency || ':' || requested_amount_minor")).toBe("international_wire:true:KRW:1500000");
    expect(attempt(a, "actual_usd_total_debit_minor is null")).toBe("t");
    psql(`select record_payout_attempt_actuals('${a}', 1100000, 11000, 1350.5, 1351.1, now(), '${requester}');`);
    expect(attempt(a, "actual_usd_principal_minor || ':' || actual_usd_fee_minor || ':' || actual_usd_total_debit_minor")).toBe("1100000:11000:1111000");
    expect(attempt(a, "contractual_amount_minor || ':' || contractual_currency")).toBe("1500000:KRW");
    expect(attempt(a, "quoted_fx_rate || ':' || final_fx_rate")).toBe("1350.50000000:1351.10000000");
    // KRW 계약과 USD 원금은 비교하지 않는다 → 불일치 플래그 없음
    expect(attempt(a, "'usd_principal_differs_from_contract' = any(needs_review_reasons)")).toBe("f");
    // 총 출금이 원금+수수료와 다르게 들어갈 수 없다(체크 제약)
    fails(() => psql(`update payout_attempts set actual_usd_total_debit_minor = 1 where id = '${a}';`), /payout_attempts_check/);
  });

  it("기한과 송금 예정일은 별개 컬럼이고 SQL·TS 일정 규칙이 같다(주말·미국/한국 휴일 포함)", () => {
    for (const deadline of ["2026-10-26", "2026-10-12", "2026-09-28", "2026-10-09", "2026-12-25", "2026-02-18"]) {
      const sqlKrw = psql(`select payout_krw_transfer_date('${deadline}');`);
      expect(sqlKrw, `KRW ${deadline}`).toBe(krwTransferDate(deadline).date);
      const sqlUsd = psql(`select payout_transfer_request_date('${deadline}');`);
      expect(sqlUsd, `USD ${deadline}`).toBe(transferRequestDate(deadline));
      expect(sqlKrw <= deadline).toBe(true);
    }
    // 한국 추석(9/24–26)·미국 컬럼버스데이(10/12)는 도착 목표일이 될 수 없다
    expect(psql(`select payout_joint_business_day_on_or_before('2026-09-26');`)).toBe("2026-09-23");
  });

  it("검증되지 않은 연도의 KRW 기한은 unverified_calendar 플래그가 붙는다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "KRW", 100000, "2027-02-26", settler);
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    expect(attempt(a, "'unverified_calendar' = any(needs_review_reasons)")).toBe("t");
  });
});

describe("승인·직무 분리·상태 전이", () => {
  function setup(currency: "USD" | "KRW" = "USD", amount = 50000) {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, currency, amount, "2026-10-26", settler);
    if (currency === "USD") mkVerifiedLink(t, "USD");
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    return { t, b, a };
  }

  it("정산 승인자·시도 생성자는 같은 건을 지급 승인할 수 없고, 권한 없는 사람도 못 한다", () => {
    const { a } = setup();
    fails(() => psql(`select approve_payout_attempt('${a}', '${settler}');`), /직무 분리/);
    fails(() => psql(`select approve_payout_attempt('${a}', '${plainAdmin}');`), /권한이 없습니다/);
    // requester는 capability(payout_approve_mercury)가 없어 막힌다 — 생성자 = 승인자 차단은 별도 확인
    const both = mkAdmin("both", null, "payout_approve_mercury");
    psql(`insert into supervisor_capabilities (profile_id, capability) values ('${both}', 'payout_request_mercury');`);
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 7000, "2026-10-26", settler);
    const a2 = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${both}', 'mercury');`);
    fails(() => psql(`select approve_payout_attempt('${a2}', '${both}');`), /직무 분리/);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    expect(attempt(a, "approved_by")).toBe(approver);
    psql(`select approve_payout_attempt('${a}', '${approver}');`); // 멱등
  });

  it("승인 없이·게이트가 닫힌 채로는 요청 단계로 갈 수 없고, 수취인이 verified여야 한다", () => {
    const { a, t } = setup();
    fails(() => gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`), /승인되지 않았/);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    fails(() => psql(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}');`), /real_disbursement_enabled/);
    psql(`update payout_recipient_links set status = 'invited' where profile_id = '${t}';`);
    fails(() => gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`), /검증\(verified\)되지 않았/);
    psql(`update payout_recipient_links set status = 'verified' where profile_id = '${t}';`);
    expect(gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`)).toBe("awaiting_mercury_approval");
    // 같은 상태 재호출은 무동작(멱등)
    expect(gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`)).toBe("awaiting_mercury_approval");
    expect(Number(psql(`select count(*) from payout_attempt_events where attempt_id='${a}' and event_type='transition'`))).toBe(1);
  });

  it("허용 전이 표가 TS와 SQL에서 모든 쌍에서 일치한다", () => {
    for (const from of ATTEMPT_STATUSES) {
      for (const to of ATTEMPT_STATUSES) {
        expect(psql(`select payout_attempt_transition_allowed('${from}', '${to}');`) === "t", `${from}->${to}`).toBe(canTransition(from, to));
      }
    }
    expect(Object.keys(ATTEMPT_TRANSITIONS)).toHaveLength(ATTEMPT_STATUSES.length);
  });

  it("sent ≠ 수취 확인: sent는 거래 ID 필요, receipt_confirmed는 증빙·확인자 필요, 증빙 없이는 제약이 막는다", () => {
    const { a } = setup();
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${a}', 'processing', null)`);
    fails(() => gated(`select payout_attempt_transition('${a}', 'sent', null)`), /거래 ID가 필요/);
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-1', '${requester}');`);
    gated(`select payout_attempt_transition('${a}', 'sent', null)`);
    expect(attempt(a, "status")).toBe("sent");
    expect(attempt(a, "received_confirmed_at is null")).toBe("t");
    fails(() => psql(`select confirm_payout_attempt_receipt('${a}', '${approver}', 50000, 'USD', '  ', now());`), /증빙/);
    fails(() => psql(`update payout_attempts set status = 'receipt_confirmed' where id='${a}';`), /payout_attempts_check/);
    psql(`select confirm_payout_attempt_receipt('${a}', '${approver}', 50000, 'USD', 'Teacher confirmed by email 10/20', now());`);
    expect(attempt(a, "status")).toBe("receipt_confirmed");
    expect(attempt(a, "received_confirmed_by")).toBe(approver);
    psql(`select confirm_payout_attempt_receipt('${a}', '${approver}', 50000, 'USD', 'Teacher confirmed by email 10/20', now());`); // 멱등
  });

  it("부족 수취·기한 경과 도착은 플래그로 남는다", () => {
    const { a } = setup("USD", 100000);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${a}', 'processing', null)`);
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-short', '${requester}');`);
    gated(`select payout_attempt_transition('${a}', 'sent', null)`);
    psql(`select confirm_payout_attempt_receipt('${a}', '${approver}', 99000, 'USD', 'Bank statement shows 990.00', '2026-10-28T12:00:00Z');`);
    expect(attempt(a, "needs_review_reasons::text")).toMatch(/short_received/);
    expect(attempt(a, "needs_review_reasons::text")).toMatch(/late/);
  });

  it("거래 ID는 한 번만 연결되고 다른 시도와 중복될 수 없다", () => {
    const { a } = setup();
    const other = setup();
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-dup', '${requester}');`);
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-dup', '${requester}');`); // 멱등
    fails(() => psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-other', '${requester}');`), /이미 다른 거래 ID/);
    fails(() => psql(`select link_payout_attempt_transaction('${other.a}', 'tx-${RUN}-dup', '${requester}');`), /payout_attempts_provider_tx_uq/);
  });

  it("응답 유실: 불확실 표시 → 요청 ID 복구, 다른 요청 ID로 덮어쓸 수 없다", () => {
    const { a } = setup();
    psql(`select record_payout_attempt_request('${a}', null, '${requester}', true);`);
    expect(attempt(a, "request_uncertain")).toBe("t");
    psql(`select record_payout_attempt_request('${a}', 'req-${RUN}', '${requester}', false);`);
    expect(attempt(a, "request_uncertain || ':' || payout_request_id")).toBe(`false:req-${RUN}`);
    fails(() => psql(`select record_payout_attempt_request('${a}', 'req-other', '${requester}', false);`), /이미 다른 payout_request_id/);
  });
});

describe("승인 무효화 — 금액·수취인 변경", () => {
  it("승인 뒤 정산 금액이 바뀌면 승인이 무효화되고 재승인은 막힌다(새 시도 필요)", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 20000, "2026-10-26", settler);
    mkVerifiedLink(t, "USD");
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    psql(`update payout_items set amount_minor = 25000 where batch_id = '${b}';`);
    expect(attempt(a, "status")).toBe("needs_review");
    expect(attempt(a, "approved_by is null and approval_invalidated_at is not null")).toBe("t");
    expect(attempt(a, "needs_review_reasons::text")).toMatch(/amount_changed/);
    fails(() => psql(`select approve_payout_attempt('${a}', '${approver}');`), /금액이 시도 생성 이후 바뀌었습니다/);
    fails(() => gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`), /허용되지 않는 전이/);
  });

  it("수취 계좌 변경은 링크를 재검증 필요로 바꾸고 미실행 시도의 승인을 무효화하며, 재검증 전 재승인은 막힌다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 30000, "2026-10-26", settler);
    mkVerifiedLink(t, "USD");
    psql(`insert into teacher_payout_accounts (teacher_id, account_holder_name, bank_name, account_number_last4, currency, country) values ('${t}', 'Test', 'Bank A', '1111', 'USD', 'US');`);
    psql(`update payout_recipient_links set status = 'verified' where profile_id = '${t}'`); // 최초 등록 직후 검증 완료로 간주
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    psql(`update teacher_payout_accounts set bank_name = 'Bank B', account_number_enc = '\\x0102'::bytea where teacher_id = '${t}';`);
    expect(psql(`select status from payout_recipient_links where profile_id='${t}'`)).toBe("reverify_required");
    expect(attempt(a, "status")).toBe("needs_review");
    expect(attempt(a, "needs_review_reasons::text")).toMatch(/recipient_changed/);
    fails(() => psql(`select approve_payout_attempt('${a}', '${approver}');`), /재검증이 필요/);
    psql(`update payout_recipient_links set status = 'verified' where profile_id='${t}'`);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    expect(attempt(a, "status || ':' || (approval_invalidated_at is null)")).toBe("queued:true");
  });

  it("이미 송금된(sent) 시도는 상태를 바꾸지 않고 사후 플래그만 남긴다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 40000, "2026-10-26", settler);
    mkVerifiedLink(t, "USD");
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${a}', 'processing', null)`);
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-exec', '${requester}');`);
    gated(`select payout_attempt_transition('${a}', 'sent', null)`);
    psql(`update payout_items set amount_minor = 45000 where batch_id = '${b}';`);
    expect(attempt(a, "status")).toBe("sent");
    expect(attempt(a, "needs_review_reasons::text")).toMatch(/amount_changed_after_execution/);
  });
});

describe("실패·반환·재송금 이력", () => {
  it("실패 → 재송금(원 시도 연결) → 반환은 별도 반환 거래로 기록되고 원 거래는 지워지지 않는다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 60000, "2026-10-26", settler);
    mkVerifiedLink(t, "USD");
    const a1 = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select approve_payout_attempt('${a1}', '${approver}');`);
    gated(`select payout_attempt_transition('${a1}', 'awaiting_mercury_approval', '${requester}')`);
    fails(() => gated(`select payout_attempt_transition('${a1}', 'failed', null, '')`), /실패 사유/);
    gated(`select payout_attempt_transition('${a1}', 'failed', null, 'Recipient bank rejected')`);
    expect(attempt(a1, "status || ':' || failure_reason")).toBe("failed:Recipient bank rejected");
    // 재송금: 원 시도를 가리키며 새 normal 시도와 별개로 살아남는다
    const a2 = psql(`select create_payout_attempt('${b}', null, 'resend', '${a1}', '${requester}', 'mercury');`);
    expect(attempt(a2, "kind || ':' || original_attempt_id || ':' || attempt_no")).toBe(`resend:${a1}:2`);
    fails(() => psql(`select create_payout_attempt('${b}', null, 'resend', '${a1}', '${requester}', 'mercury');`), /이미 진행 중인 재송금/);
    psql(`select approve_payout_attempt('${a2}', '${approver}');`);
    gated(`select payout_attempt_transition('${a2}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${a2}', 'processing', null)`);
    psql(`select link_payout_attempt_transaction('${a2}', 'tx-${RUN}-resend', '${requester}');`);
    psql(`select record_payout_attempt_actuals('${a2}', 60000, 0, null, null, null, '${requester}');`);
    gated(`select payout_attempt_transition('${a2}', 'sent', null)`);
    // 반환: USD 반환액이 원 출금과 다르면 차이 플래그
    psql(`select record_payout_attempt_return('${a2}', null, 'ret-${RUN}-1', 59985, 'ACH R03 no account');`);
    expect(attempt(a2, "status || ':' || return_transaction_id || ':' || returned_usd_minor")).toBe(`returned:ret-${RUN}-1:59985`);
    expect(attempt(a2, "needs_review_reasons::text")).toMatch(/returned_amount_mismatch/);
    expect(attempt(a2, "provider_transaction_id")).toBe(`tx-${RUN}-resend`); // 원 거래 ID 보존
    psql(`select record_payout_attempt_return('${a2}', null, 'ret-${RUN}-1', 59985, 'ACH R03 no account');`); // 멱등
    fails(() => psql(`select record_payout_attempt_return('${a2}', null, 'ret-other', 1, 'x');`), /이미 다른 반환 거래/);
    // 이력 보존: 이벤트가 쌓였고 수정·삭제는 막힌다
    expect(Number(psql(`select count(*) from payout_attempt_events where attempt_id in ('${a1}','${a2}')`))).toBeGreaterThan(6);
    fails(() => psql(`delete from payout_attempt_events where attempt_id = '${a1}';`), /INSERT 전용/);
  });

  it("부족분 보충(top_up)은 별도 시도로 원 시도·같은 정산에 연결된다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 80000, "2026-10-26", settler);
    const a1 = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    fails(() => psql(`select create_payout_attempt('${b}', null, 'top_up', '${a1}', '${requester}', 'mercury', null);`), /0보다 큰 금액/);
    const top = psql(`select create_payout_attempt('${b}', null, 'top_up', '${a1}', '${requester}', 'mercury', 1500);`);
    expect(attempt(top, "kind || ':' || requested_amount_minor || ':' || contractual_amount_minor || ':' || settlement_batch_id")).toBe(`top_up:1500:80000:${b}`);
    // 보충 시도는 승인 시 정산 총액과 비교하지 않는다(별도 금액)
    psql(`select approve_payout_attempt('${top}', '${approver}');`);
  });
});

describe("대사 뷰·회계 중복 기록 방지·권한", () => {
  it("대사 플래그: ok / awaiting_receipt / missing_actual_usd, USD만 계약-원금 비교, 모든 행 import_into_books=false", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 90000, "2026-10-26", settler);
    mkVerifiedLink(t, "USD");
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${a}', 'processing', null)`);
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-rec', '${requester}');`);
    gated(`select payout_attempt_transition('${a}', 'sent', null)`);
    const flag = () => psql(`select reconciliation_flag from payout_reconciliation_rows where attempt_id='${a}'`);
    expect(flag()).toBe("missing_actual_usd");
    psql(`select record_payout_attempt_actuals('${a}', 90000, 0, null, null, null, '${requester}');`);
    expect(flag()).toBe("awaiting_receipt");
    expect(psql(`select usd_principal_matches_contract from payout_reconciliation_rows where attempt_id='${a}'`)).toBe("t");
    psql(`select confirm_payout_attempt_receipt('${a}', '${approver}', 90000, 'USD', 'Teacher confirmed', now());`);
    expect(flag()).toBe("ok");
    expect(psql(`select count(*) from payout_reconciliation_rows where import_into_books`)).toBe("0");
    // KRW 정산은 USD 원금과 비교하는 열이 null
    const kt = mkTeacher();
    const kb = mkApprovedBatch(kt, "KRW", 700000, "2026-10-26", settler);
    const ka = psql(`select create_payout_attempt('${kb}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select record_payout_attempt_actuals('${ka}', 520000, 5200, null, null, null, '${requester}');`);
    expect(psql(`select usd_principal_matches_contract is null from payout_reconciliation_rows where attempt_id='${ka}'`)).toBe("t");
  });

  it("Stripe·Mercury 은행 거래는 공식 연결로만 들어가며 ALTON 파일 import 경로는 DB 제약으로 막혀 있다", () => {
    expect(psql(`select feed_method from accounting_feed_sources where source='stripe'`)).toBe("books_official_connection");
    expect(psql(`select feed_method from accounting_feed_sources where source='mercury_bank'`)).toBe("books_bank_feed");
    fails(() => psql(`update accounting_feed_sources set import_via_alton_file = true where source = 'stripe';`), /accounting_feed_sources_import_via_alton_file_check|check/);
    // 대사 뷰에는 결제(Stripe) 원천 열이 없다
    expect(psql(`select count(*) from information_schema.columns where table_name='payout_reconciliation_rows' and column_name ilike '%stripe%'`)).toBe("0");
  });

  it("계정과목 매핑 설정이 회계사 검토용으로 존재한다(미검토 상태)", () => {
    expect(Number(psql(`select count(*) from accounting_account_map where not reviewed_by_accountant`))).toBeGreaterThanOrEqual(11);
  });

  it("권한: 교사·무권한 관리자는 시도·수취인 링크를 읽을 수 없고, 마스터·capability 보유자는 읽을 수 있다", () => {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", 1000, "2026-10-26", settler);
    psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    const countAs = (uid: string, table: string) =>
      psql(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); select count(*) from ${table}; rollback;`);
    expect(countAs(t, "payout_attempts")).toBe("0");
    expect(countAs(plainAdmin, "payout_attempts")).toBe("0");
    expect(countAs(t, "payout_recipient_links")).toBe("0");
    expect(Number(countAs(settler, "payout_attempts"))).toBeGreaterThan(0);
    expect(Number(countAs(requester, "payout_attempts"))).toBeGreaterThan(0);
  });

  it("KR 휴일표가 SQL과 TS에서 같다", () => {
    const sqlDates = psql(`select string_agg(holiday_date::text, ',' order by holiday_date) from payout_kr_bank_holidays where holiday_date between '2026-01-01' and '2026-12-31'`);
    expect(sqlDates).toBe(Object.keys(KR_BANK_HOLIDAYS).sort().join(","));
  });
});

describe("정산 paid 동기화 — 수취 확인이 정산 총액을 채울 때만", () => {
  function sentAttempt(amount: number) {
    const t = mkTeacher();
    const b = mkApprovedBatch(t, "USD", amount, "2026-10-26", settler);
    mkVerifiedLink(t, "USD");
    const a = psql(`select create_payout_attempt('${b}', null, 'normal', null, '${requester}', 'mercury');`);
    psql(`select approve_payout_attempt('${a}', '${approver}');`);
    gated(`select payout_attempt_transition('${a}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${a}', 'processing', null)`);
    psql(`select link_payout_attempt_transaction('${a}', 'tx-${RUN}-${Math.random().toString(36).slice(2, 8)}', '${requester}');`);
    gated(`select payout_attempt_transition('${a}', 'sent', null)`);
    return { b, a };
  }
  it("게이트가 닫힌 채 수취 확인하면 정산은 paid가 되지 않고 플래그만 남는다", () => {
    const { b, a } = sentAttempt(11000);
    psql(`select confirm_payout_attempt_receipt('${a}', '${approver}', 11000, 'USD', 'Teacher confirmed', now());`);
    expect(psql(`select status from payout_batches where id='${b}'`)).toBe("approved");
    expect(attempt(a, "needs_review_reasons::text")).toMatch(/settlement_not_marked_paid/);
  });
  it("게이트가 열려 있고 총액을 채우면 기존 paid 가드를 거쳐 정산이 paid가 된다", () => {
    const { b, a } = sentAttempt(12000);
    gated(`select confirm_payout_attempt_receipt('${a}', '${approver}', 12000, 'USD', 'Teacher confirmed', now())`);
    expect(psql(`select status || ':' || provider || ':' || (provider_confirmed_at is not null) from payout_batches where id='${b}'`)).toBe("paid:mercury:true");
  });
  it("부족 수취는 정산을 paid로 만들지 않고, 보충(top-up) 수취까지 채워야 paid가 된다", () => {
    const { b, a } = sentAttempt(13000);
    gated(`select confirm_payout_attempt_receipt('${a}', '${approver}', 12900, 'USD', 'Bank shows 129.00', now())`);
    expect(psql(`select status from payout_batches where id='${b}'`)).toBe("approved");
    const top = psql(`select create_payout_attempt('${b}', null, 'top_up', '${a}', '${requester}', 'mercury', 100);`);
    psql(`select approve_payout_attempt('${top}', '${approver}');`);
    gated(`select payout_attempt_transition('${top}', 'awaiting_mercury_approval', '${requester}')`);
    gated(`select payout_attempt_transition('${top}', 'processing', null)`);
    psql(`select link_payout_attempt_transaction('${top}', 'tx-${RUN}-top', '${requester}');`);
    gated(`select payout_attempt_transition('${top}', 'sent', null)`);
    gated(`select confirm_payout_attempt_receipt('${top}', '${approver}', 100, 'USD', 'Bank shows 1.00 top-up', now())`);
    expect(psql(`select status from payout_batches where id='${b}'`)).toBe("paid");
  });
});
