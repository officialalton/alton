import { describe, expect, it } from "vitest";
import { csvCell, formatMinor, mercuryKrwInputListCsv, reconciliationCsv, type PayoutListRow } from "./reconciliation-csv";
import { applyMercuryTransaction, attemptStatusForMercury, verifyMercuryWebhookSignature, type EventStore } from "./mercury-events";

const base: PayoutListRow = {
  settlement_id: "s1", attempt_id: "a1", recipient_kind: "teacher", recipient_profile_id: "p1", period_start: "2026-10-01", period_end: "2026-10-15",
  payment_deadline: "2026-10-26", scheduled_transfer_date: "2026-10-19", provider: "mercury", rail: "international_wire", kind: "normal", attempt_no: 1,
  contractual_amount_minor: 1500000, contractual_currency: "KRW", requested_amount_minor: 1500000, requested_currency: "KRW", status: "sent",
  provider_transaction_id: "tx1", payout_request_id: null, sent_at: null, received_confirmed_at: null, actual_usd_principal_minor: 1100000, actual_usd_fee_minor: 11000,
  actual_usd_total_debit_minor: 1111000, quoted_fx_rate: 1350.5, final_fx_rate: 1351.1, received_amount_minor: null, received_currency: null, return_transaction_id: null,
  returned_usd_minor: null, needs_review_reasons: [], reconciliation_flag: "ok", import_into_books: false,
  recipient_name: "=HYPERLINK(\"x\")", bank_name: "KB", account_last4: "1234", recipient_status: "verified",
};

describe("CSV", () => {
  it("수식 주입을 막고 따옴표를 이스케이프한다", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("KRW는 정수, USD는 소수 둘째 자리로 표시하고 서로 환산하지 않는다", () => {
    expect(formatMinor(1500000, "KRW")).toBe("1500000");
    expect(formatMinor(1111000, "USD")).toBe("11110.00");
  });
  it("대사 CSV는 KRW 계약액과 USD 출금을 별도 열로 두고 import_into_books=false", () => {
    const csv = reconciliationCsv([base]);
    const [h, r] = csv.trim().split("\r\n");
    const cols = h.split(","), vals = r.split(",");
    expect(vals[cols.indexOf("contractual_amount")]).toBe("1500000");
    expect(vals[cols.indexOf("contractual_currency")]).toBe("KRW");
    expect(vals[cols.indexOf("actual_usd_total_debit")]).toBe("11110.00");
    expect(vals[cols.indexOf("import_into_books")]).toBe("false");
    expect(csv).not.toMatch(/stripe/i);
  });
  it("Mercury KRW 입력표에는 KRW 행만, USD 환산액·전체 계좌번호 없음", () => {
    const usdRow = { ...base, attempt_id: "a2", requested_currency: "USD" as const, requested_amount_minor: 100 };
    const csv = mercuryKrwInputListCsv([base, usdRow]);
    expect(csv.trim().split("\r\n")).toHaveLength(2);
    expect(csv).toContain("1500000");
    expect(csv).toContain("ALTON:a1");
    expect(csv.split("\r\n")[0]).not.toMatch(/usd|account_number/i);
  });
});

describe("Mercury 이벤트 반영", () => {
  function mkEvents(status: "awaiting_mercury_approval" | "processing" | "sent" = "awaiting_mercury_approval", cur: "USD" | "KRW" = "USD") {
    const log: string[] = [];
    const store: EventStore = {
      async findByTransactionId() { return null; },
      async findByRequestId(id) { return id === "r1" ? { id: "a1", status, requested_currency: cur } : null; },
      async linkTransaction(_a, tx) { log.push(`link:${tx}`); },
      async applyTransition(_a, to) { log.push(`to:${to}`); },
      async recordActuals(_a, p, f) { log.push(`actuals:${p}:${f}`); },
      async recordReturn(_a, tx, usd) { log.push(`return:${tx}:${usd}`); },
    };
    return { store, log };
  }
  it("sent 이벤트는 sent(지급 완료)까지 반영한다 — 수취 확인 전이는 없다", async () => {
    const { store, log } = mkEvents();
    await applyMercuryTransaction(store, { transactionId: "t1", status: "sent", requestId: "r1", amountMinorUsd: 50000, feeMinorUsd: 0 });
    expect(log).toEqual(["link:t1", "actuals:50000:0", "to:processing", "to:sent"]);
    expect(log).not.toContain("to:receipt_confirmed");
  });
  it("알 수 없는 거래는 무시한다", async () => {
    const { store, log } = mkEvents();
    expect(await applyMercuryTransaction(store, { transactionId: "zz", status: "sent", requestId: "nope" })).toBe("ignored_unknown");
    expect(log).toEqual([]);
  });
  it("reversed는 반환 거래로 기록하고 실패/반환 매핑이 정확하다", async () => {
    const { store, log } = mkEvents("processing");
    await applyMercuryTransaction(store, { transactionId: "t1", status: "reversed", requestId: "r1", amountMinorUsd: 50000 }, "ret-1");
    expect(log).toContain("return:ret-1:50000");
    expect(attemptStatusForMercury("blocked")).toBe("failed");
    expect(attemptStatusForMercury("pending")).toBe("processing");
  });
  it("웹훅 서명 방식이 미확정이라 검증은 항상 거부(fail closed)", () => {
    expect(() => verifyMercuryWebhookSignature()).toThrow();
  });
});
