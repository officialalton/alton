import type { SupabaseClient } from "@supabase/supabase-js";

export type PayoutPeriod = { periodStart: string; periodEnd: string };

export type TeacherPayoutAmount = {
  teacherId: string;
  teacherName: string;
  amountKrw: number;
  totalMinutes: number;
};

export type MissingRatePayoutSkip = { teacherId: string; teacherName: string };

export type PayoutListItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  amountKrw: number;
  periodStart: string;
  periodEnd: string;
  // DB의 payout_status enum은 'pending' | 'approved' | 'paid' 세 값을 갖지만
  // (supabase/migrations/20260827120000_initial_schema.sql), 이번 스코프에서는
  // 승인(approved) 단계를 쓰지 않고 pending -> paid 2단계만 다룬다.
  status: "pending" | "paid";
  paidAt: string | null;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function previousMonthRange(now: Date): PayoutPeriod {
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(
    Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1)
  );
  return {
    periodStart: toDateOnly(firstOfPrevMonth),
    periodEnd: toDateOnly(lastOfPrevMonth),
  };
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

// sessions 테이블에는 teacher_id 컬럼이 없다 (선생님은 enrollments.teacher_id를 통해서만
// 연결된다 — supabase/migrations/20260827120000_initial_schema.sql 참고). 실제 쿼리는
// enrollment:enrollments(teacher_id) 조인으로 중첩된 값만 받아온다.
function extractTeacherId(row: { enrollment?: unknown }): string {
  const rel = Array.isArray(row.enrollment) ? row.enrollment[0] : row.enrollment;
  return (rel as { teacher_id?: string } | null)?.teacher_id ?? "";
}

export async function computePayoutAmounts(
  supabase: SupabaseClient,
  period: PayoutPeriod
): Promise<{ amounts: TeacherPayoutAmount[]; skipped: MissingRatePayoutSkip[] }> {
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, hourly_rate_krw, profile:profiles(name)");

  const { data: sessions } = await supabase
    .from("legacy_sessions")
    .select("duration_minutes, enrollment:enrollments(teacher_id)")
    .eq("status", "completed")
    .gte("scheduled_at", period.periodStart)
    .lte("scheduled_at", `${period.periodEnd}T23:59:59`);

  const minutesByTeacher = new Map<string, number>();
  for (const s of (sessions ?? []) as {
    duration_minutes: number;
    enrollment?: unknown;
  }[]) {
    const teacherId = extractTeacherId(s);
    if (!teacherId) continue;
    minutesByTeacher.set(teacherId, (minutesByTeacher.get(teacherId) ?? 0) + s.duration_minutes);
  }

  const amounts: TeacherPayoutAmount[] = [];
  const skipped: MissingRatePayoutSkip[] = [];

  for (const t of (teachers ?? []) as {
    id: string;
    hourly_rate_krw: number | null;
    profile: unknown;
  }[]) {
    const totalMinutes = minutesByTeacher.get(t.id) ?? 0;
    if (totalMinutes === 0) continue;
    const teacherName = extractName(t.profile);
    if (t.hourly_rate_krw == null) {
      skipped.push({ teacherId: t.id, teacherName });
      continue;
    }
    amounts.push({
      teacherId: t.id,
      teacherName,
      amountKrw: Math.round((t.hourly_rate_krw * totalMinutes) / 60),
      totalMinutes,
    });
  }

  return { amounts, skipped };
}

export async function loadPayouts(supabase: SupabaseClient): Promise<PayoutListItem[]> {
  const { data: payouts } = await supabase
    .from("teacher_payouts")
    .select("id, teacher_id, amount_krw, period_start, period_end, status, paid_at")
    .order("period_start", { ascending: false });
  if (!payouts || payouts.length === 0) return [];

  const teacherIds = Array.from(new Set(payouts.map((p) => p.teacher_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", teacherIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return payouts.map((p) => ({
    id: p.id,
    teacherId: p.teacher_id,
    teacherName: nameById.get(p.teacher_id) ?? "알 수 없음",
    amountKrw: p.amount_krw,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    status: p.status,
    paidAt: p.paid_at,
  }));
}
