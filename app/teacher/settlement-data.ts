import type { SupabaseClient } from "@supabase/supabase-js";

// P4-2 — 교사 본인 정산 조회 데이터 계층.
// 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
//
// 원본은 기존 R10 정산 원장(payout_items/payout_batches)뿐이다 — 금액을 앱에서
// 다시 계산하지 않고 payout_items.amount_minor를 그대로 쓴다. payout_items는
// 세션 최종 판정 시 upsert_session_payout_item()이 만들고 재판정·조정 때마다
// 갱신하므로, 이 화면은 "현재 원장 상태"를 그대로 비춘다.
//
// 권한: payout_items/payout_batches RLS 조회 정책이 이미 `teacher_id = auth.uid()`를
// 허용한다(20260830070000 이후) — 사용자 스코프 클라이언트로 본인 행만 읽는다.
// admin 클라이언트를 쓰지 않는다.
//
// 정산 월 기준: generate_payout_batches()가 예약 시작일(reservations.starts_at)
// 기준으로 기간을 묶으므로 여기서도 같은 기준을 쓴다. 지급 예정 월은 그 익월이다.

// 저장된 계좌번호의 표시 규칙 — 서버가 내려보내는 유일한 형태다.
// "use server" 파일은 async 함수만 export할 수 있어 동기 헬퍼는 여기에 둔다
// (교사 액션과 관리자 목록이 같은 함수를 쓴다 — 마스킹 규칙이 갈라지지 않게).
export function maskAccountNumber(last4: string): string {
  return `****${last4}`;
}

// 2026-09-12(제품 오너 확정 흐름) — 정산 상태는 아래 4단계로만 말한다.
//   예정(scheduled)      : 최종 판정되어 정산 항목이 생긴 수업의 실시간 합계.
//                          예약만 된 미진행 수업은 포함하지 않는다. 재판정·조정에
//                          따라 변동될 수 있다. 아직 정산 묶음(batch)이 없다.
//   검토 중(in_review)   : 정산 대상 월이 끝나 월별 정산 묶음이 만들어졌고
//                          관리자가 산출 근거·조정 내역·계좌를 확인하는 단계.
//   송금 승인됨(approved): 송금 권한을 가진 운영자가 실제 지급 대상으로 최종
//                          승인한 상태. **사람의 유일한 승인 지점**이다.
//                          이후 송금 요청됨/금융사 처리 중도 실행 단계일 뿐이라
//                          교사 화면에서는 이 묶음으로 함께 보여준다.
//   지급 완료(paid)      : 금융사 처리까지 끝난 상태.
// 사람이 예정액을 수기로 계산하거나 임의로 확정하는 경로는 만들지 않는다 —
// 금액은 언제나 payout_items(정산 원장)에서 온다.
export type SettlementStatus = "scheduled" | "in_review" | "approved" | "paid";

// payout_batches.status(= DB 어휘) → 교사에게 보여줄 4단계 매핑.
// batch가 아직 없으면(= 월 마감 전) 'scheduled'다.
export function settlementStatusOf(
  batchStatus: string | null | undefined,
  itemStatus: string | null | undefined
): SettlementStatus {
  if (!batchStatus) return itemStatus === "paid" ? "paid" : "scheduled";
  if (batchStatus === "paid" || itemStatus === "paid") return "paid";
  // approved 이후(dispatch_requested/provider_pending/processing)는 사람이 다시
  // 판단하는 단계가 아니라 실행 단계다 — 교사에게는 '송금 승인됨'으로 묶는다.
  if (["approved", "dispatch_requested", "provider_pending", "processing"].includes(batchStatus)) {
    return "approved";
  }
  // draft/calculated/reviewing/reviewed와 failed(실행 실패로 관리자에게 되돌아온
  // 상태)는 전부 아직 관리자 손에 있다.
  return "in_review";
}

export type SettlementLine = {
  payoutItemId: string;
  sessionDate: string | null;
  studentName: string | null;
  subjectName: string | null;
  itemType: string;
  payableMinutes: number;
  hourlyRateSnapshotMinor: number;
  amountMinor: number;
  currency: string;
};

export type SettlementAdjustment = {
  id: string;
  amountMinor: number;
  currency: string;
  reason: string;
  createdAt: string;
};

export type SettlementMonth = {
  /** 수업이 있었던 월 — 'YYYY-MM' */
  settlementMonth: string;
  /** 지급 예정 월 — 수업 월의 익월, 'YYYY-MM' */
  payoutMonth: string;
  currency: string;
  status: SettlementStatus;
  /** 시스템이 수업별로 자동 산정한 합계(관리자가 고칠 수 없는 값). */
  autoCalculatedAmountMinor: number;
  /** 관리자가 송금 전 더하거나 뺀 금액의 합(가산 +, 감액 -). */
  adjustmentAmountMinor: number;
  /** 최종 금액 = 자동 산정 합계 + 조정액. 승인 단계면 이것이 송금 승인 금액이다. */
  totalAmountMinor: number;
  lessonCount: number;
  paidAt: string | null;
  lines: SettlementLine[];
  /** 관리자 조정 내역(사유·시각). 교사도 볼 수 있다. */
  adjustments: SettlementAdjustment[];
};

export type TeacherSettlement = {
  months: SettlementMonth[];
  /** 예정 — 아직 정산 묶음이 없고 변동될 수 있는 금액(통화별). */
  scheduledTotalsByCurrency: Record<string, number>;
  /** 검토 중 — 월별 묶음이 생겨 관리자가 확인 중인 금액(통화별). */
  inReviewTotalsByCurrency: Record<string, number>;
  /** 송금 승인됨 — 운영자가 지급 대상으로 최종 승인한 금액(통화별). */
  approvedTotalsByCurrency: Record<string, number>;
  /** 지급 완료 금액(통화별). */
  paidTotalsByCurrency: Record<string, number>;
  /** 다음 지급 예정 월 — 예정 금액이 있는 가장 이른 월의 익월. 없으면 null. */
  nextPayoutMonth: string | null;
  /** 이 화면이 원장을 읽은 시각(ISO). "마지막 갱신 시각"으로 표시한다. */
  refreshedAt: string;
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function extractName(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? null;
}

export async function loadTeacherSettlement(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherSettlement> {
  const refreshedAt = new Date().toISOString();
  const empty: TeacherSettlement = {
    months: [],
    scheduledTotalsByCurrency: {},
    inReviewTotalsByCurrency: {},
    approvedTotalsByCurrency: {},
    paidTotalsByCurrency: {},
    nextPayoutMonth: null,
    refreshedAt,
  };

  const { data: items, error } = await supabase
    .from("payout_items")
    .select(
      "id, batch_id, session_id, item_type, amount_minor, currency, payable_minutes, hourly_rate_snapshot_minor, status, created_at, adjustment_reason"
    )
    .eq("teacher_id", teacherId);
  if (error) throw new Error(error.message);
  if (!items?.length) return empty;

  const batchIds = Array.from(new Set(items.map((i) => i.batch_id as string | null).filter(Boolean) as string[]));
  const sessionIds = Array.from(new Set(items.map((i) => i.session_id as string | null).filter(Boolean) as string[]));

  const [{ data: batches }, { data: sessions }, { data: adjustmentRows }] = await Promise.all([
    batchIds.length
      ? supabase.from("payout_batches").select("id, status, paid_at").in("id", batchIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sessionIds.length
      ? supabase.from("sessions").select("id, reservation_id, subject_enrollment_id").in("id", sessionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    // 관리자 조정 내역(사유·시각). RLS가 본인 묶음만 보여준다.
    batchIds.length
      ? supabase
          .from("payout_batch_adjustments")
          .select("id, batch_id, amount_minor, currency, reason, created_at")
          .in("batch_id", batchIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const adjustmentsByBatch = new Map<string, SettlementAdjustment[]>();
  for (const a of adjustmentRows ?? []) {
    const list = adjustmentsByBatch.get(a.batch_id as string) ?? [];
    list.push({
      id: a.id as string,
      amountMinor: Number(a.amount_minor ?? 0),
      currency: a.currency as string,
      reason: a.reason as string,
      createdAt: a.created_at as string,
    });
    adjustmentsByBatch.set(a.batch_id as string, list);
  }

  const batchById = new Map((batches ?? []).map((b) => [b.id as string, b]));
  const reservationIds = Array.from(
    new Set((sessions ?? []).map((s) => s.reservation_id as string | null).filter(Boolean) as string[])
  );
  const enrollmentIds = Array.from(
    new Set((sessions ?? []).map((s) => s.subject_enrollment_id as string | null).filter(Boolean) as string[])
  );

  const [{ data: reservations }, { data: enrollments }] = await Promise.all([
    reservationIds.length
      ? supabase.from("reservations").select("id, starts_at").in("id", reservationIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    enrollmentIds.length
      ? supabase
          .from("subject_enrollments")
          .select("id, child:profiles!subject_enrollments_child_id_fkey(name), subject:subjects(name)")
          .in("id", enrollmentIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const startsAtByReservation = new Map(
    (reservations ?? []).map((r) => [r.id as string, r.starts_at as string])
  );
  const enrollmentById = new Map((enrollments ?? []).map((e) => [e.id as string, e]));
  const sessionById = new Map((sessions ?? []).map((s) => [s.id as string, s]));

  const byMonthCurrency = new Map<string, SettlementMonth>();
  const scheduledTotalsByCurrency: Record<string, number> = {};
  const inReviewTotalsByCurrency: Record<string, number> = {};
  const approvedTotalsByCurrency: Record<string, number> = {};
  const paidTotalsByCurrency: Record<string, number> = {};

  for (const item of items) {
    const session = item.session_id ? sessionById.get(item.session_id as string) : undefined;
    const startsAt = session?.reservation_id
      ? startsAtByReservation.get(session.reservation_id as string) ?? null
      : null;
    const batch = item.batch_id ? batchById.get(item.batch_id as string) : undefined;

    // 지급 상태 4분류. 실제 송금·paid 전이는 이번 범위 밖이며 여기서는 읽기만 한다.
    const status: SettlementStatus = settlementStatusOf(
      (batch?.status as string | undefined) ?? null,
      item.status as string
    );

    // 조정 항목은 수업에 매이지 않는다(session_id is null) — 발생한 달로 묶는다.
    // 그 외에 예약 시작일을 모르는 예외적 데이터는 금액이 화면에서 사라지지 않도록
    // 'unknown' 버킷에 남긴다.
    const isAdjustment = !item.session_id;
    const settlementMonth = startsAt
      ? monthKey(startsAt)
      : isAdjustment && item.created_at
        ? monthKey(item.created_at as string)
        : "unknown";
    const currency = item.currency as string;
    const key = `${settlementMonth}|${currency}|${status}`;

    const enrollment = session?.subject_enrollment_id
      ? enrollmentById.get(session.subject_enrollment_id as string)
      : undefined;

    const line: SettlementLine = {
      payoutItemId: item.id as string,
      sessionDate: startsAt,
      studentName: enrollment ? extractName(enrollment.child) : null,
      subjectName: enrollment ? extractName(enrollment.subject) : null,
      itemType: item.item_type as string,
      payableMinutes: Number(item.payable_minutes ?? 0),
      hourlyRateSnapshotMinor: Number(item.hourly_rate_snapshot_minor ?? 0),
      amountMinor: Number(item.amount_minor ?? 0),
      currency,
    };

    const existing = byMonthCurrency.get(key);
    if (existing) {
      existing.totalAmountMinor += line.amountMinor;
      if (isAdjustment) existing.adjustmentAmountMinor += line.amountMinor;
      else {
        existing.autoCalculatedAmountMinor += line.amountMinor;
        existing.lessonCount += 1;
        existing.lines.push(line);
      }
    } else {
      byMonthCurrency.set(key, {
        settlementMonth,
        payoutMonth: settlementMonth === "unknown" ? "unknown" : nextMonthKey(settlementMonth),
        currency,
        status,
        autoCalculatedAmountMinor: isAdjustment ? 0 : line.amountMinor,
        adjustmentAmountMinor: isAdjustment ? line.amountMinor : 0,
        totalAmountMinor: line.amountMinor,
        lessonCount: isAdjustment ? 0 : 1,
        paidAt: (batch?.paid_at as string | null) ?? null,
        lines: isAdjustment ? [] : [line],
        adjustments: item.batch_id ? adjustmentsByBatch.get(item.batch_id as string) ?? [] : [],
      });
    }

    const bucket = {
      scheduled: scheduledTotalsByCurrency,
      in_review: inReviewTotalsByCurrency,
      approved: approvedTotalsByCurrency,
      paid: paidTotalsByCurrency,
    }[status];
    bucket[currency] = (bucket[currency] ?? 0) + line.amountMinor;
  }

  const months = Array.from(byMonthCurrency.values()).sort((a, b) =>
    a.settlementMonth === b.settlementMonth
      ? a.currency.localeCompare(b.currency)
      : b.settlementMonth.localeCompare(a.settlementMonth)
  );
  for (const m of months) {
    m.lines.sort((a, b) => (a.sessionDate ?? "").localeCompare(b.sessionDate ?? ""));
  }

  // 다음 지급 예정 월 = 아직 확정되지 않은(예정) 금액이 있는 가장 이른 수업 월의 익월.
  const scheduledMonths = months
    .filter((m) => m.status === "scheduled" && m.settlementMonth !== "unknown")
    .map((m) => m.settlementMonth)
    .sort();
  const nextPayoutMonth = scheduledMonths.length ? nextMonthKey(scheduledMonths[0]) : null;

  return {
    months,
    scheduledTotalsByCurrency,
    inReviewTotalsByCurrency,
    approvedTotalsByCurrency,
    paidTotalsByCurrency,
    nextPayoutMonth,
    refreshedAt,
  };
}
