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

export type SettlementStatus = "scheduled" | "confirmed" | "paid";

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

export type SettlementMonth = {
  /** 수업이 있었던 월 — 'YYYY-MM' */
  settlementMonth: string;
  /** 지급 예정 월 — 수업 월의 익월, 'YYYY-MM' */
  payoutMonth: string;
  currency: string;
  status: SettlementStatus;
  totalAmountMinor: number;
  lessonCount: number;
  paidAt: string | null;
  lines: SettlementLine[];
};

export type TeacherSettlement = {
  months: SettlementMonth[];
  /** 아직 배치에 담기지 않아 변동될 수 있는 금액(통화별). */
  scheduledTotalsByCurrency: Record<string, number>;
  /** 배치에 담겼지만 아직 지급되지 않은 금액(통화별). */
  confirmedTotalsByCurrency: Record<string, number>;
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
    confirmedTotalsByCurrency: {},
    paidTotalsByCurrency: {},
    nextPayoutMonth: null,
    refreshedAt,
  };

  const { data: items, error } = await supabase
    .from("payout_items")
    .select(
      "id, batch_id, session_id, item_type, amount_minor, currency, payable_minutes, hourly_rate_snapshot_minor, status"
    )
    .eq("teacher_id", teacherId);
  if (error) throw new Error(error.message);
  if (!items?.length) return empty;

  const batchIds = Array.from(new Set(items.map((i) => i.batch_id as string | null).filter(Boolean) as string[]));
  const sessionIds = Array.from(new Set(items.map((i) => i.session_id as string | null).filter(Boolean) as string[]));

  const [{ data: batches }, { data: sessions }] = await Promise.all([
    batchIds.length
      ? supabase.from("payout_batches").select("id, status, paid_at").in("id", batchIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sessionIds.length
      ? supabase.from("sessions").select("id, reservation_id, subject_enrollment_id").in("id", sessionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

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
  const confirmedTotalsByCurrency: Record<string, number> = {};
  const paidTotalsByCurrency: Record<string, number> = {};

  for (const item of items) {
    const session = item.session_id ? sessionById.get(item.session_id as string) : undefined;
    const startsAt = session?.reservation_id
      ? startsAtByReservation.get(session.reservation_id as string) ?? null
      : null;
    const batch = item.batch_id ? batchById.get(item.batch_id as string) : undefined;

    // 지급 상태 3분류. paid 전이는 이번 범위 밖이며 여기서는 읽기만 한다.
    const status: SettlementStatus =
      batch?.status === "paid" || item.status === "paid"
        ? "paid"
        : item.batch_id
          ? "confirmed"
          : "scheduled";

    // 예약 시작일을 모르면(세션·예약이 정리된 예외적 데이터) 월로 묶을 수 없다 —
    // 금액이 화면에서 사라지지 않도록 'unknown' 버킷에 남긴다.
    const settlementMonth = startsAt ? monthKey(startsAt) : "unknown";
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
      existing.lessonCount += 1;
      existing.lines.push(line);
    } else {
      byMonthCurrency.set(key, {
        settlementMonth,
        payoutMonth: settlementMonth === "unknown" ? "unknown" : nextMonthKey(settlementMonth),
        currency,
        status,
        totalAmountMinor: line.amountMinor,
        lessonCount: 1,
        paidAt: (batch?.paid_at as string | null) ?? null,
        lines: [line],
      });
    }

    const bucket =
      status === "scheduled"
        ? scheduledTotalsByCurrency
        : status === "confirmed"
          ? confirmedTotalsByCurrency
          : paidTotalsByCurrency;
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
    confirmedTotalsByCurrency,
    paidTotalsByCurrency,
    nextPayoutMonth,
    refreshedAt,
  };
}
