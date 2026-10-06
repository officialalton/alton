"use server";

// Phase B(5, 2026-09-23) — 관리자 정산 > 컨설턴트.
// 계좌 정책(2026-10-06 오너, 교사와 동일): 목록·조회에는 끝 4자리만 담고, 컨설턴트는 최초 1회만 본인이 등록한다.
// 이후 변경은 마스터 관리자·정산권한 보유자가 대신 입력하며(이력·본인 알림), 전체 번호는 감사되는 '전체 번호 보기'로만 본다. 지급 기간·금액은 상담 건수로 자동
// 계산하지 않고 관리자가 직접 입력·확정한다(사용자 확정 정책) — 금액 변경·
// 상태 변경은 전부 consultant_payout_period_events에 기록한다.

import { listConsultantsAction } from "./consultant-assignment-actions";
import { requireAdminOrCapability, requirePayoutAccountStaff } from "@/lib/admin-auth";
import { PAYOUT_ACCOUNT_ERROR_KO, validatePayoutAccountInput, type PayoutAccountInputRaw } from "@/lib/payout/account-validation";
import { createAdminClient } from "@/lib/supabase-admin";
import { maskAccountNumber } from "@/app/teacher/settlement-data";
import { selectInChunks } from "@/lib/select-in-chunks";

const PAYOUT_CAPABILITY = "정산권한";

export type ConsultantPayoutAccountAdminView = {
  consultantId: string;
  consultantName: string;
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  country: string | null;
  enteredByAdmin: boolean;
  updatedAt: string;
} | null;

export type ConsultantPayoutPeriodAdmin = {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: "draft" | "confirmed" | "paid";
  note: string | null;
  createdAt: string;
  confirmedAt: string | null;
  paidAt: string | null;
};

export type ConsultantPayoutPeriodEvent = {
  id: string;
  eventType: string;
  actorName: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
};

export async function getConsultantPayoutAccountAction(consultantId: string): Promise<ConsultantPayoutAccountAdminView> {
  await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();
  const [{ data: account, error }, { data: profile }] = await Promise.all([
    admin
      .from("consultant_payout_accounts")
      .select("account_holder_name, bank_name, account_number_last4, currency, country, entered_by_admin, updated_at")
      .eq("consultant_id", consultantId)
      .maybeSingle(),
    admin.from("profiles").select("name").eq("id", consultantId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (!account) return null;
  return {
    consultantId,
    consultantName: profile?.name ?? "",
    accountHolderName: account.account_holder_name,
    bankName: account.bank_name,
    accountNumberMasked: maskAccountNumber(account.account_number_last4),
    currency: account.currency,
    country: account.country,
    enteredByAdmin: account.entered_by_admin === true,
    updatedAt: account.updated_at,
  };
}

/**
 * 정산 > 컨설턴트 선택 목록: 삭제된 계정(인증 사용자가 없는 프로필)과 컨설턴트 프로필이 아닌 잔여 행은 제외한다.
 * 컨설턴트에게는 계정 종료 상태 컬럼이 없어, "인증 계정이 존재하는 컨설턴트"를 활성으로 본다(신규 배정 중단(deactivated)은 남긴다 —
 * 이미 번 정산을 받을 수 있어야 한다).
 */
export async function listPayoutConsultantsAction() {
  const all = await listConsultantsAction();
  return all.filter((c) => c.email !== null);
}

export type ConsultantContractFee = { monthlyFeeMinor: number; currency: "KRW" | "USD"; startDate: string | null; signedAt: string | null } | null;

/**
 * 서명 완료된 컨설턴트 계약서(teacher_contracts.agreement_form='consultant_services', status='signed')의 월 보수·통화·시작일.
 * 계약 기준 금액 "제안"에만 쓰며 정산 금액을 자동으로 채우지 않는다. 서명 전·보수 미기재면 null.
 */
export async function getConsultantContractFeeAction(consultantId: string): Promise<ConsultantContractFee> {
  await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_contracts")
    .select("inputs_snapshot, signed_at")
    .eq("teacher_id", consultantId)
    .eq("agreement_form", "consultant_services")
    .eq("status", "signed")
    .order("signed_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  const snap = (row?.inputs_snapshot ?? null) as { monthly_fee_minor?: number | string | null; monthly_fee_currency?: string | null; start_date?: string | null } | null;
  const minor = snap?.monthly_fee_minor == null ? NaN : Number(snap.monthly_fee_minor);
  const currency = snap?.monthly_fee_currency;
  if (!snap || !Number.isInteger(minor) || minor <= 0 || (currency !== "KRW" && currency !== "USD")) return null;
  return { monthlyFeeMinor: minor, currency, startDate: snap.start_date ?? null, signedAt: (row?.signed_at as string | null) ?? null };
}

export type SaveConsultantAccountResult = { status: "saved"; changedFields: string[] } | { status: "invalid"; message: string };

/** 컨설턴트를 대신해 수취 계좌를 입력·수정한다(정산권한·마스터). 이력(끝 4자리만)과 본인 알림은 DB 함수가 남긴다. */
export async function saveConsultantPayoutAccountByAdminAction(consultantId: string, input: PayoutAccountInputRaw): Promise<SaveConsultantAccountResult> {
  const { actorUserId } = await requirePayoutAccountStaff();
  const validated = validatePayoutAccountInput(input);
  if (!validated.ok) return { status: "invalid", message: PAYOUT_ACCOUNT_ERROR_KO[validated.code] ?? validated.message };
  const v = validated.value;
  const admin = createAdminClient();
  // 서버에서 막는다: 삭제된(인증 계정이 없는) 컨설턴트에는 대신 입력할 수 없다.
  const { data: authUser } = await admin.auth.admin.getUserById(consultantId);
  if (!authUser?.user) return { status: "invalid", message: "삭제되었거나 존재하지 않는 계정에는 계좌를 입력할 수 없습니다." };
  const { data, error } = await admin.rpc("save_consultant_payout_account", {
    p_consultant_id: consultantId,
    p_actor_id: actorUserId,
    p_by_admin: true,
    p_holder: v.accountHolderName,
    p_bank: v.bankName,
    p_number: v.accountNumber,
    p_currency: v.currency,
    p_country: v.country,
    p_swift: v.swiftOrRouting,
  });
  if (error) {
    if (/컨설턴트 계정이 아닙니다/.test(error.message)) return { status: "invalid", message: "컨설턴트 계정이 아닙니다." };
    throw new Error(error.message);
  }
  return { status: "saved", changedFields: ((data as { changed_fields?: string[] } | null)?.changed_fields ?? []) as string[] };
}

export type RevealedConsultantAccount = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  swiftOrRouting: string | null;
  currency: string;
  country: string | null;
};

/** 전체 번호 보기 — 호출마다 DB가 감사 행(번호 제외)을 남긴 뒤 복호화한다. 화면은 일시적으로만 보여 준다. */
export async function revealConsultantPayoutAccountAction(consultantId: string, reason: string): Promise<RevealedConsultantAccount> {
  const { actorUserId } = await requirePayoutAccountStaff();
  const trimmedReason = reason?.trim() ?? "";
  if (trimmedReason.length < 5) throw new Error("전체 번호를 보는 사유를 5자 이상 입력해주세요.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reveal_consultant_payout_account", {
    p_consultant_id: consultantId,
    p_actor_id: actorUserId,
    p_reason: trimmedReason,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) throw new Error("등록된 수취 계좌가 없습니다.");
  return {
    accountHolderName: row.account_holder_name as string,
    bankName: row.bank_name as string,
    accountNumber: row.account_number as string,
    swiftOrRouting: (row.swift_or_routing as string | null) ?? null,
    currency: row.currency as string,
    country: (row.country as string | null) ?? null,
  };
}

export async function listConsultantPayoutPeriodsAction(consultantId: string): Promise<ConsultantPayoutPeriodAdmin[]> {
  await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultant_payout_periods")
    .select("id, period_start, period_end, amount_minor, currency, status, note, created_at, confirmed_at, paid_at")
    .eq("consultant_id", consultantId)
    .order("period_start", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    paidAt: r.paid_at,
  }));
}

export async function listConsultantPayoutPeriodEventsAction(periodId: string): Promise<ConsultantPayoutPeriodEvent[]> {
  await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultant_payout_period_events")
    .select("id, event_type, actor_id, previous_value, new_value, created_at")
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const actorIds = Array.from(new Set((data ?? []).map((e) => e.actor_id).filter((id): id is string => Boolean(id))));
  const { data: actors } = actorIds.length
    ? await selectInChunks(actorIds, (chunk) => admin.from("profiles").select("id, name").in("id", chunk))
    : { data: [] as { id: string; name: string | null }[] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.name ?? ""]));
  return (data ?? []).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    actorName: e.actor_id ? (nameById.get(e.actor_id) ?? null) : null,
    previousValue: e.previous_value,
    newValue: e.new_value,
    createdAt: e.created_at,
  }));
}

export async function createConsultantPayoutPeriodAction(params: {
  consultantId: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  note?: string;
}): Promise<{ id: string }> {
  const { actorUserId } = await requireAdminOrCapability(PAYOUT_CAPABILITY);
  if (params.amountMinor < 0) throw new Error("금액은 0 이상이어야 합니다.");
  if (new Date(params.periodEnd) < new Date(params.periodStart)) {
    throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultant_payout_periods")
    .insert({
      consultant_id: params.consultantId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      amount_minor: params.amountMinor,
      currency: params.currency,
      note: params.note?.trim() || null,
      status: "draft",
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("consultant_payout_period_events").insert({
    period_id: data.id,
    consultant_id: params.consultantId,
    actor_id: actorUserId,
    event_type: "created",
    previous_value: null,
    new_value: `${params.amountMinor} ${params.currency}`,
  });

  return { id: data.id };
}

export async function updateConsultantPayoutPeriodAmountAction(params: {
  periodId: string;
  amountMinor: number;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(PAYOUT_CAPABILITY);
  if (params.amountMinor < 0) throw new Error("금액은 0 이상이어야 합니다.");
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("consultant_payout_periods")
    .select("consultant_id, amount_minor, currency")
    .eq("id", params.periodId)
    .single();
  if (existingError) throw new Error(existingError.message);
  if (Number(existing.amount_minor) === params.amountMinor) return;

  const { error } = await admin
    .from("consultant_payout_periods")
    .update({ amount_minor: params.amountMinor, updated_at: new Date().toISOString() })
    .eq("id", params.periodId);
  if (error) throw new Error(error.message);

  await admin.from("consultant_payout_period_events").insert({
    period_id: params.periodId,
    consultant_id: existing.consultant_id,
    actor_id: actorUserId,
    event_type: "amount_changed",
    previous_value: `${existing.amount_minor} ${existing.currency}`,
    new_value: `${params.amountMinor} ${existing.currency}`,
  });
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["confirmed"],
  confirmed: ["paid", "draft"],
  paid: [],
};

export async function updateConsultantPayoutPeriodStatusAction(params: {
  periodId: string;
  status: "draft" | "confirmed" | "paid";
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("consultant_payout_periods")
    .select("consultant_id, status")
    .eq("id", params.periodId)
    .single();
  if (existingError) throw new Error(existingError.message);
  if (existing.status === params.status) return;
  if (!STATUS_TRANSITIONS[existing.status]?.includes(params.status)) {
    throw new Error(`${existing.status}에서 ${params.status}(으)로 바꿀 수 없습니다.`);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: params.status, updated_at: now };
  if (params.status === "confirmed") {
    patch.confirmed_by = actorUserId;
    patch.confirmed_at = now;
  }
  if (params.status === "paid") {
    patch.paid_by = actorUserId;
    patch.paid_at = now;
  }
  if (params.status === "draft") {
    patch.confirmed_by = null;
    patch.confirmed_at = null;
  }

  const { error } = await admin.from("consultant_payout_periods").update(patch).eq("id", params.periodId);
  if (error) throw new Error(error.message);

  await admin.from("consultant_payout_period_events").insert({
    period_id: params.periodId,
    consultant_id: existing.consultant_id,
    actor_id: actorUserId,
    event_type: "status_changed",
    previous_value: existing.status,
    new_value: params.status,
  });
}
