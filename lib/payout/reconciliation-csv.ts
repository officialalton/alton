// 지급 목록·Mercury 입력표·대사 CSV 생성(2026-10-07). 순수 함수. CSV 수식 주입(=,+,-,@) 방지. 은행 계좌번호는 어떤 파일에도 넣지 않는다.
export type ReconRow = {
  settlement_id: string;
  attempt_id: string;
  recipient_kind: string;
  recipient_profile_id: string;
  period_start: string;
  period_end: string;
  payment_deadline: string;
  scheduled_transfer_date: string;
  provider: string;
  rail: string;
  kind: string;
  attempt_no: number;
  contractual_amount_minor: number;
  contractual_currency: "USD" | "KRW";
  requested_amount_minor: number;
  requested_currency: "USD" | "KRW";
  status: string;
  provider_transaction_id: string | null;
  payout_request_id: string | null;
  sent_at: string | null;
  received_confirmed_at: string | null;
  actual_usd_principal_minor: number | null;
  actual_usd_fee_minor: number | null;
  actual_usd_total_debit_minor: number | null;
  quoted_fx_rate: number | null;
  final_fx_rate: number | null;
  received_amount_minor: number | null;
  received_currency: string | null;
  return_transaction_id: string | null;
  returned_usd_minor: number | null;
  needs_review_reasons: string[];
  reconciliation_flag: string;
  import_into_books: boolean;
};

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
/** 소수 둘째 자리(USD) 또는 정수(KRW) 문자열. 통화를 섞어 더하지 않는다. */
export function formatMinor(minor: number | null, currency: "USD" | "KRW" | string | null): string {
  if (minor === null || minor === undefined) return "";
  return currency === "USD" ? (minor / 100).toFixed(2) : String(minor);
}

export function reconciliationCsv(rows: ReconRow[]): string {
  const header = [
    "settlement_id", "attempt_id", "attempt_no", "kind", "recipient_kind", "recipient_profile_id", "period_start", "period_end",
    "payment_deadline", "scheduled_transfer_date", "provider", "rail",
    "contractual_amount", "contractual_currency", "requested_amount", "requested_currency",
    "status", "mercury_transaction_id", "payout_request_id", "sent_at", "received_confirmed_at",
    "actual_usd_principal", "actual_usd_fee", "actual_usd_total_debit", "quoted_fx_rate", "final_fx_rate",
    "received_amount", "received_currency", "return_transaction_id", "returned_usd", "flags", "reconciliation_flag", "import_into_books",
  ];
  return toCsv(
    header,
    rows.map((r) => [
      r.settlement_id, r.attempt_id, r.attempt_no, r.kind, r.recipient_kind, r.recipient_profile_id, r.period_start, r.period_end,
      r.payment_deadline, r.scheduled_transfer_date, r.provider, r.rail,
      formatMinor(r.contractual_amount_minor, r.contractual_currency), r.contractual_currency,
      formatMinor(r.requested_amount_minor, r.requested_currency), r.requested_currency,
      r.status, r.provider_transaction_id, r.payout_request_id, r.sent_at, r.received_confirmed_at,
      formatMinor(r.actual_usd_principal_minor, "USD"), formatMinor(r.actual_usd_fee_minor, "USD"), formatMinor(r.actual_usd_total_debit_minor, "USD"),
      r.quoted_fx_rate, r.final_fx_rate,
      formatMinor(r.received_amount_minor, r.received_currency), r.received_currency, r.return_transaction_id, formatMinor(r.returned_usd_minor, "USD"),
      r.needs_review_reasons.join("|"), r.reconciliation_flag, "false",
    ])
  );
}

export type PayoutListRow = ReconRow & { recipient_name: string | null; bank_name: string | null; account_last4: string | null; recipient_status: string | null };

/** 지급 목록(관리자용): 수취인 표시 정보만, 전체 계좌번호 없음. */
export function payoutListCsv(rows: PayoutListRow[]): string {
  const header = ["recipient", "kind", "currency", "amount", "period", "payment_deadline", "scheduled_transfer_date", "bank_name", "account_last4", "bank_info_status", "status", "provider", "mercury_transaction_id", "flags"];
  return toCsv(
    header,
    rows.map((r) => [
      r.recipient_name ?? r.recipient_profile_id, r.recipient_kind, r.requested_currency, formatMinor(r.requested_amount_minor, r.requested_currency),
      `${r.period_start}..${r.period_end}`, r.payment_deadline, r.scheduled_transfer_date, r.bank_name, r.account_last4, r.recipient_status ?? "unknown",
      r.status, r.provider, r.provider_transaction_id, r.needs_review_reasons.join("|"),
    ])
  );
}

/** KRW 수동 송금용 Mercury 입력표: 관리자가 Mercury 화면에서 KRW 송금을 만들 때 보는 목록. USD로 환산한 금액은 넣지 않는다. */
export function mercuryKrwInputListCsv(rows: PayoutListRow[]): string {
  const header = ["settlement_id", "attempt_id", "recipient", "bank_name", "account_last4", "amount_krw", "payment_deadline", "scheduled_transfer_date", "memo"];
  return toCsv(
    header,
    rows
      .filter((r) => r.requested_currency === "KRW")
      .map((r) => [
        r.settlement_id, r.attempt_id, r.recipient_name ?? r.recipient_profile_id, r.bank_name, r.account_last4,
        formatMinor(r.requested_amount_minor, "KRW"), r.payment_deadline, r.scheduled_transfer_date, `ALTON:${r.attempt_id}`,
      ])
  );
}
