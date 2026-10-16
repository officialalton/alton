"use server";

// Phase B(5, 2026-09-23) — 컨설턴트 본인 정산 화면 서버 액션.
// 정책(2026-10-06 오너): 수취 계좌는 **최초 1회만 본인이 등록**하고 이후 수정은 정산권한·마스터 관리자만 한다
// (서버·DB가 막는다 — 화면 숨김만이 아니다). 번호는 암호화 저장되고 본인 화면에는 끝 4자리만 내려간다.
// 지급 기간·금액은 상담 건수로 자동 계산하지 않는다 — 관리자가 입력·확정한 값을 조회만 한다(confirmed/paid만 RLS가 보여준다).

import { requireConsultant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { validatePayoutAccountInput } from "@/lib/payout/account-validation";
import { last4Of, maskLast4 } from "@/lib/payout/account-mask";

const ACCOUNT_LOCKED_MESSAGE = "To change your account details, contact ALTON staff.";

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

export type ConsultantPayoutNotice = { id: string; kind: string; message: string; createdAt: string; read: boolean };

export async function getMyPayoutAccountAction(): Promise<MaskedPayoutAccount | null> {
  const { user } = await requireConsultant();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultant_payout_accounts")
    .select("account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing_last4, updated_at")
    .eq("consultant_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    accountHolderName: data.account_holder_name,
    bankName: data.bank_name,
    accountNumberMasked: maskLast4(data.account_number_last4),
    currency: data.currency,
    country: data.country,
    swiftOrRouting: data.swift_or_routing_last4 ? maskLast4(data.swift_or_routing_last4) : null,
    updatedAt: data.updated_at,
  };
}

export type SavePayoutAccountResult =
  | { status: "saved"; account: MaskedPayoutAccount }
  | { status: "invalid"; message: string };

/** 컨설턴트의 **최초 1회** 수취 계좌 등록. 이미 있으면 서버에서 거절하고 DB 함수도 같은 규칙으로 막는다. */
export async function saveMyPayoutAccountAction(input: PayoutAccountInput): Promise<SavePayoutAccountResult> {
  const { user } = await requireConsultant();
  const validated = validatePayoutAccountInput(input);
  if (!validated.ok) return { status: "invalid", message: validated.message };
  const v = validated.value;

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("consultant_payout_accounts")
    .select("id")
    .eq("consultant_id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { status: "invalid", message: ACCOUNT_LOCKED_MESSAGE };

  const { error } = await admin.rpc("save_consultant_payout_account", {
    p_consultant_id: user.id,
    p_actor_id: user.id,
    p_by_admin: false,
    p_holder: v.accountHolderName,
    p_bank: v.bankName,
    p_number: v.accountNumber,
    p_currency: v.currency,
    p_country: v.country,
    p_swift: v.swiftOrRouting,
  });
  if (error) {
    if (/LOCKED/.test(error.message)) return { status: "invalid", message: ACCOUNT_LOCKED_MESSAGE };
    throw new Error(error.message);
  }
  return {
    status: "saved",
    account: {
      accountHolderName: v.accountHolderName,
      bankName: v.bankName,
      accountNumberMasked: maskLast4(last4Of(v.accountNumber)),
      currency: v.currency,
      country: v.country,
      swiftOrRouting: v.swiftOrRouting ? maskLast4(last4Of(v.swiftOrRouting)) : null,
      updatedAt: new Date().toISOString(),
    },
  };
}

/** 본인에게 온 정산 알림 최근 3건(계좌 변경 알림 포함). */
export async function listMyPayoutNoticesAction(): Promise<ConsultantPayoutNotice[]> {
  const { user } = await requireConsultant();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payout_teacher_notices")
    .select("id, kind, message, created_at, read_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({ id: n.id as string, kind: n.kind as string, message: n.message as string, createdAt: n.created_at as string, read: n.read_at != null }));
}

/** 본인 알림만 읽음 처리(소유자 스코프). */
export async function markMyPayoutNoticeReadAction(noticeId: string): Promise<{ ok: boolean }> {
  const { user } = await requireConsultant();
  if (!/^[0-9a-f-]{36}$/i.test(noticeId)) return { ok: false };
  const admin = createAdminClient();
  const { error } = await admin
    .from("payout_teacher_notices")
    .update({ read_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("teacher_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return { ok: true };
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
