"use server";

// Phase B(5, 2026-09-23) — 관리자 정산 > 컨설턴트. app/admin/teacher-payout-
// accounts-actions.ts와 같은 마스킹 원칙(전체 계좌번호는 절대 응답에 넣지
// 않음)을 계좌 조회에 그대로 적용한다. 지급 기간·금액은 상담 건수로 자동
// 계산하지 않고 관리자가 직접 입력·확정한다(사용자 확정 정책) — 금액 변경·
// 상태 변경은 전부 consultant_payout_period_events에 기록한다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { maskAccountNumber } from "@/app/teacher/settlement-data";

const PAYOUT_CAPABILITY = "정산권한";

export type ConsultantPayoutAccountAdminView = {
  consultantId: string;
  consultantName: string;
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  country: string | null;
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
      .select("account_holder_name, bank_name, account_number_last4, currency, country, updated_at")
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
    updatedAt: account.updated_at,
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
    ? await admin.from("profiles").select("id, name").in("id", actorIds)
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
