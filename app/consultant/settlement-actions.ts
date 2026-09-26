"use server";

// Phase B(5, 2026-09-23) — 컨설턴트 본인 정산 화면 서버 액션.
// app/teacher/settlement-actions.ts의 계좌 마스킹·변경 이력 패턴을 그대로
// 따른다(teacher_payout_accounts → consultant_payout_accounts). 지급 기간·
// 금액은 상담 건수로 자동 계산하지 않는다 — 관리자가 입력·확정한 값을
// 그대로 조회만 한다(confirmed/paid만 RLS가 보여준다 — draft는 안 보임).

import { requireConsultant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export type MaskedPayoutAccount = {
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  country: string | null;
  swiftOrRouting: string | null;
  updatedAt: string;
};

export type PayoutAccountInput = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  country?: string;
  swiftOrRouting?: string;
};

export type ConsultantPayoutPeriod = {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: "confirmed" | "paid";
  note: string | null;
  confirmedAt: string | null;
  paidAt: string | null;
};

function maskAccountNumber(last4: string): string {
  return `****${last4}`;
}

function last4Of(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  const source = digits.length > 0 ? digits : accountNumber;
  return source.slice(-4);
}

export async function getMyPayoutAccountAction(): Promise<MaskedPayoutAccount | null> {
  const { user } = await requireConsultant();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultant_payout_accounts")
    .select("account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing, updated_at")
    .eq("consultant_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    accountHolderName: data.account_holder_name,
    bankName: data.bank_name,
    accountNumberMasked: maskAccountNumber(data.account_number_last4),
    currency: data.currency,
    country: data.country,
    swiftOrRouting: data.swift_or_routing,
    updatedAt: data.updated_at,
  };
}

export type SavePayoutAccountResult =
  | { status: "saved"; account: MaskedPayoutAccount }
  | { status: "invalid"; message: string };

export async function saveMyPayoutAccountAction(input: PayoutAccountInput): Promise<SavePayoutAccountResult> {
  const { user } = await requireConsultant();

  const accountHolderName = input.accountHolderName.trim();
  const bankName = input.bankName.trim();
  const accountNumber = input.accountNumber.trim();
  const currency = (input.currency || "KRW").trim().toUpperCase();
  if (!accountHolderName) return { status: "invalid", message: "예금주를 입력해주세요." };
  if (!bankName) return { status: "invalid", message: "은행명을 입력해주세요." };
  if (accountNumber.replace(/\D/g, "").length < 4) {
    return { status: "invalid", message: "계좌번호를 정확히 입력해주세요(숫자 4자리 이상)." };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { status: "invalid", message: "통화 코드는 3자리 영문이어야 합니다(예: KRW)." };
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("consultant_payout_accounts")
    .select("id, account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing")
    .eq("consultant_id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const next = {
    consultant_id: user.id,
    account_holder_name: accountHolderName,
    bank_name: bankName,
    account_number: accountNumber,
    account_number_last4: last4Of(accountNumber),
    currency,
    country: input.country?.trim() || null,
    swift_or_routing: input.swiftOrRouting?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const changedFields: string[] = [];
  if (existing) {
    if (existing.account_holder_name !== next.account_holder_name) changedFields.push("account_holder_name");
    if (existing.bank_name !== next.bank_name) changedFields.push("bank_name");
    if (existing.account_number_last4 !== next.account_number_last4) changedFields.push("account_number");
    if (existing.currency !== next.currency) changedFields.push("currency");
    if ((existing.country ?? null) !== next.country) changedFields.push("country");
    if ((existing.swift_or_routing ?? null) !== next.swift_or_routing) changedFields.push("swift_or_routing");
  }

  const { error: upsertError } = await admin.from("consultant_payout_accounts").upsert(next, { onConflict: "consultant_id" });
  if (upsertError) throw new Error(upsertError.message);

  await admin.from("consultant_payout_account_events").insert({
    consultant_id: user.id,
    action: existing ? "updated" : "created",
    actor_id: user.id,
    changed_fields: existing ? changedFields : ["account_holder_name", "bank_name", "account_number", "currency"],
    previous_last4: existing?.account_number_last4 ?? null,
    new_last4: next.account_number_last4,
  });

  return {
    status: "saved",
    account: {
      accountHolderName: next.account_holder_name,
      bankName: next.bank_name,
      accountNumberMasked: maskAccountNumber(next.account_number_last4),
      currency: next.currency,
      country: next.country,
      swiftOrRouting: next.swift_or_routing,
      updatedAt: next.updated_at,
    },
  };
}

/** confirmed/paid만 반환된다 — draft는 본인 세션 클라이언트로도 RLS가 가려준다. */
export async function listMyPayoutPeriodsAction(): Promise<ConsultantPayoutPeriod[]> {
  const { user, supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultant_payout_periods")
    .select("id, period_start, period_end, amount_minor, currency, status, note, confirmed_at, paid_at")
    .eq("consultant_id", user.id)
    .order("period_start", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    status: r.status as "confirmed" | "paid",
    note: r.note,
    confirmedAt: r.confirmed_at,
    paidAt: r.paid_at,
  }));
}
