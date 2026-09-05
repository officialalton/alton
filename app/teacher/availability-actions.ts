"use server";

// R6 6/N — 선생님 본인의 반복 가능 시간·날짜별 예외 관리. teacher_availability_rules/
// teacher_availability_exceptions의 RLS(`teacher_id = auth.uid() or is_admin() or
// current_user_has_capability('manage_bookings')`, R6 1/N)가 실제 접근 제어를 담당하므로
// 여기서는 RLS-scoped 세션 클라이언트를 그대로 쓴다(admin 클라이언트 불필요 — R6 1/N
// 마이그레이션의 다른 테이블들과 달리 이 두 테이블은 본인 쓰기가 정책으로 이미 허용됨).

import { requireUser } from "@/lib/auth";

export type AvailabilityRuleInput = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function periodsOverlap(
  aFrom: string,
  aUntil: string | null,
  bFrom: string,
  bUntil: string | null
): boolean {
  const aEnd = aUntil ?? "9999-12-31";
  const bEnd = bUntil ?? "9999-12-31";
  return aFrom <= bEnd && bFrom <= aEnd;
}

export async function addTeacherAvailabilityRule(input: AvailabilityRuleInput): Promise<string> {
  const { user, supabase } = await requireUser();

  // teacher_availability_rules에는 DB exclusion constraint가 없다(같은 선생님이 공유하는
  // 통합 테스트 픽스처와의 락 경합 문제로 서버 액션 검증을 택함 — 마이그레이션 주석 참고).
  // 겹치는 시간대 등록은 여기서 막는다: 같은 요일 + 겹치는 유효기간 안에서 시간대가
  // 겹치면 에러.
  const { data: existingRules, error: existingError } = await supabase
    .from("teacher_availability_rules")
    .select("start_time_local, end_time_local, effective_from, effective_until")
    .eq("teacher_id", user.id)
    .eq("day_of_week", input.dayOfWeek);
  if (existingError) throw new Error(existingError.message);

  const newStart = timeToMinutes(input.startTimeLocal);
  const newEnd = timeToMinutes(input.endTimeLocal);
  const hasOverlap = (existingRules ?? []).some((r) => {
    if (!periodsOverlap(input.effectiveFrom, input.effectiveUntil ?? null, r.effective_from as string, (r.effective_until as string) ?? null)) {
      return false;
    }
    return rangesOverlap(newStart, newEnd, timeToMinutes(r.start_time_local as string), timeToMinutes(r.end_time_local as string));
  });
  if (hasOverlap) {
    throw new Error("같은 요일에 겹치는 시간대가 이미 등록되어 있습니다.");
  }

  const { data, error } = await supabase
    .from("teacher_availability_rules")
    .insert({
      teacher_id: user.id,
      day_of_week: input.dayOfWeek,
      start_time_local: input.startTimeLocal,
      end_time_local: input.endTimeLocal,
      timezone: input.timezone,
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    // teacher_availability_rules_no_overlap exclusion 제약(23P01) — 같은 요일·겹치는
    // 유효기간 안에서 시간대가 겹치는 규칙을 등록하려 한 경우.
    if (error.code === "23P01") {
      throw new Error("같은 요일에 겹치는 시간대가 이미 등록되어 있습니다.");
    }
    throw new Error(error.message);
  }
  return data.id as string;
}

export async function removeTeacherAvailabilityRule(ruleId: string): Promise<void> {
  const { user, supabase } = await requireUser();
  const { error } = await supabase
    .from("teacher_availability_rules")
    .delete()
    .eq("id", ruleId)
    .eq("teacher_id", user.id);
  if (error) throw new Error(error.message);
}

export type AvailabilityExceptionInput = {
  exceptionDate: string;
  kind: "blocked" | "available";
  startTimeLocal?: string | null;
  endTimeLocal?: string | null;
  timezone: string;
  reason?: string | null;
};

export async function addTeacherAvailabilityException(input: AvailabilityExceptionInput): Promise<string> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_availability_exceptions")
    .insert({
      teacher_id: user.id,
      exception_date: input.exceptionDate,
      kind: input.kind,
      start_time_local: input.startTimeLocal ?? null,
      end_time_local: input.endTimeLocal ?? null,
      timezone: input.timezone,
      reason: input.reason ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export type AvailabilityExceptionRow = {
  id: string;
  exceptionDate: string;
  kind: "blocked" | "available";
  reason: string | null;
};

/** R6 11/N — 선생님 본인 캘린더에 기존 날짜별 예외를 표시하기 위한 조회. */
export async function listTeacherAvailabilityExceptions(): Promise<AvailabilityExceptionRow[]> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_availability_exceptions")
    .select("id, exception_date, kind, reason")
    .eq("teacher_id", user.id)
    .order("exception_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    exceptionDate: r.exception_date as string,
    kind: r.kind as "blocked" | "available",
    reason: (r.reason as string) ?? null,
  }));
}

export async function removeTeacherAvailabilityException(exceptionId: string): Promise<void> {
  const { user, supabase } = await requireUser();
  const { error } = await supabase
    .from("teacher_availability_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("teacher_id", user.id);
  if (error) throw new Error(error.message);
}

export type TeacherAvailabilityRuleRow = {
  id: string;
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export async function listMyAvailabilityRules(): Promise<TeacherAvailabilityRuleRow[]> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_availability_rules")
    .select("id, day_of_week, start_time_local, end_time_local, timezone, effective_from, effective_until")
    .eq("teacher_id", user.id)
    .order("day_of_week", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    dayOfWeek: r.day_of_week as number,
    startTimeLocal: r.start_time_local as string,
    endTimeLocal: r.end_time_local as string,
    timezone: r.timezone as string,
    effectiveFrom: r.effective_from as string,
    effectiveUntil: (r.effective_until as string) ?? null,
  }));
}
