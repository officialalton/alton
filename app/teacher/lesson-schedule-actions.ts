"use server";

// R6 11/N — 선생님이 본인의 정규수업(v3 예약) 목록을 조회·취소하는 서버 액션. 조회는
// RLS(`sessions_v3 조회`/`reservations 조회`가 teacher_id=auth.uid()/owner_profile_id=auth.uid()를
// 이미 허용)가 접근 제어를 담당하므로 RLS-scoped 세션 클라이언트를 그대로 쓴다. 취소는
// 다른 R6 취소 경로와 동일하게 lib/booking/create-booking.ts의 cancelLessonBooking()
// (admin 클라이언트, cancelledByRole='teacher')을 그대로 재사용한다.

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadTeacherLessonSchedule, type TeacherLessonScheduleItem } from "./lesson-schedule-data";
import { cancelLessonBooking } from "@/lib/booking/create-booking";
import { listTeacherExternalBusyBlocks, type ExternalBusyBlock } from "@/lib/booking/external-busy";

export type { TeacherLessonScheduleItem, ExternalBusyBlock };

/**
 * 2026-09-06(#441 마스킹 버그 수정) — 선생님 포털 "수업" 탭에서 "수업 종료(완료)" 버튼을
 * 누르면 화면에 "Minified React error #441"이 그대로 뜨던 버그의 원인: 이 아래 여러
 * 서버 액션이 검증 실패·RPC 에러를 throw했고, Next.js가 production에서 Server Action의
 * 미처리 예외를 이 일반화된 문구로 마스킹한다(app/admin/trial-onboarding-actions.ts의
 * 2026-09-06 실측 사례, workspace-actions.ts의 2026-09-01 실측 사례와 동일 패턴). 게다가
 * 이 화면(TeacherLessonScheduleTab)은 조기 종료처럼 "예상된" 에러의 메시지 문자열을
 * 클라이언트에서 매칭해 확인 다이얼로그를 띄우는데, production에서 그 메시지 자체가
 * 마스킹되면 이 분기도 절대 동작하지 않는다. 항상 { ok, error } 형태로 반환해 예외를
 * 전파하지 않는다(Next.js 공식 권장 패턴).
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function listMyLessonSchedule(): Promise<TeacherLessonScheduleItem[]> {
  const { user, supabase } = await requireUser();
  return loadTeacherLessonSchedule(supabase, user.id);
}

/**
 * R6 12/N — 선생님 본인의 Google 외부 개인 일정을 "바쁨 블록"으로만 조회한다(제목·내용·
 * 참석자 없음, FreeBusy API 자체가 구조적으로 그 이상을 반환하지 않는다). 본인만 호출할
 * 수 있고(requireUser로 본인 확인 후 본인 workspace_email만 사용), 보호자·학생·다른
 * 선생님에게는 이 액션 자체가 노출되지 않는다(호출부가 이 화면들에서만 쓰임).
 */
export async function listMyExternalBusyBlocks(params: { rangeStart: string; rangeEnd: string }): Promise<ExternalBusyBlock[]> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data: teacher } = await admin.from("teachers").select("workspace_email").eq("id", user.id).maybeSingle();
  if (!teacher?.workspace_email) return [];
  return listTeacherExternalBusyBlocks({
    teacherWorkspaceEmail: teacher.workspace_email as string,
    rangeStart: new Date(params.rangeStart),
    rangeEnd: new Date(params.rangeEnd),
  });
}

export type MyRescheduleRequest = {
  id: string;
  reservationId: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  proposedStartsAt: string;
  proposedEndsAt: string;
  reason: string | null;
  createdAt: string;
};

/**
 * 2026-09-22(사용자 지시) — 확정된 예약에 재조정을 요청한다. 소유권·상태
 * 검증은 RPC(request_reservation_reschedule)가 한다.
 */
export async function requestMyLessonRescheduleAction(params: {
  reservationId: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("request_reservation_reschedule", {
      p_reservation_id: params.reservationId,
      p_proposed_starts_at: params.proposedStartsAt,
      p_proposed_ends_at: params.proposedEndsAt,
      p_reason: params.reason,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelMyRescheduleRequestAction(requestId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("cancel_my_reservation_reschedule_request", { p_request_id: requestId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listMyRescheduleRequestsAction(): Promise<MyRescheduleRequest[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("reservation_reschedule_requests")
    .select("id, reservation_id, status, proposed_starts_at, proposed_ends_at, reason, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    reservationId: r.reservation_id,
    status: r.status,
    proposedStartsAt: r.proposed_starts_at,
    proposedEndsAt: r.proposed_ends_at,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

/**
 * 선생님 본인 취소 — reservationId가 실제로 본인 소유(owner_profile_id)인지 admin
 * 클라이언트로 재확인한 뒤에만 취소한다(app/parent/booking-actions.ts의
 * assertReservationBelongsToChild와 동일한 목적, teacher_id 기준 변형).
 */
export async function cancelMyLessonScheduleBooking(params: { reservationId: string; reason: string }): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data } = await admin.from("reservations").select("owner_profile_id").eq("id", params.reservationId).maybeSingle();
    if (!data || data.owner_profile_id !== user.id) {
      return { ok: false, error: "본인 수업만 취소할 수 있습니다." };
    }
    await cancelLessonBooking({
      reservationId: params.reservationId,
      cancelledByRole: "teacher",
      cancelledById: user.id,
      reason: params.reason,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * M5-a — 수업 시작("진행중") 버튼. 본인 세션인지 admin 클라이언트로 재확인한 뒤
 * mark_lesson_session_started()(scheduled→live, actual_start_at 기록)를 호출한다.
 */
export async function startMyLessonSession(sessionId: string): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data } = await admin.from("sessions").select("teacher_id").eq("id", sessionId).maybeSingle();
    if (!data || data.teacher_id !== user.id) {
      return { ok: false, error: "본인 수업만 시작할 수 있습니다." };
    }
    const { error } = await admin.rpc("mark_lesson_session_started", { p_session_id: sessionId, p_actor_id: user.id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 2026-09-14 — 진행 중 수업을 지금 구성으로 다시 고정(repin_live_session_content). 담당 교사·관리자. */
export async function repinMyLiveLesson(sessionId: string): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const [{ data: session }, { data: profile }] = await Promise.all([
      admin.from("sessions").select("teacher_id").eq("id", sessionId).maybeSingle(),
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!session || (session.teacher_id !== user.id && profile?.role !== "admin")) {
      return { ok: false, error: "본인 수업만 다시 고정할 수 있습니다." };
    }
    const { error } = await admin.rpc("repin_live_session_content", { p_session_id: sessionId, p_actor_id: user.id });
    if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type TeacherLessonOutcome = "completed" | "student_no_show";

/**
 * M5-a — 수업 종료 버튼. 정상 완료 또는(15분 미접속 후) 학생 최종 노쇼 확정만 선생님이
 * 직접 할 수 있다(선생님 본인의 노쇼는 본인이 판정할 수 없으므로 관리자 전용 —
 * app/admin/booking-actions.ts의 adminFinalizeLessonSession). finalize_lesson_session()이
 * 1장 소진/release, payable_minutes, 정산 항목 적재를 단일 트랜잭션으로 처리한다.
 */
export async function finalizeMyLessonSession(params: {
  sessionId: string;
  outcome: TeacherLessonOutcome;
  reason: string;
  /** M5-b: 선생님 사유(지각 등)로 실제 제공 시간이 90분 미만이면 자동 QC 경고 대상 — 선택 입력. */
  teacherFaultProvidedMinutes?: number;
  /**
   * 2026-09-06: 예약 종료시각 전에 '정상 완료'를 확정하려는 경우에만 필요 — 학생 사유
   * 조기종료는 'student_reason'을 명시해야 한다(선생님/회사 귀책 조기종료는 이 함수가
   * 아니라 resolveMyLessonPartialInterruption 등 전용 경로를 써야 하며, DB가 강제한다).
   */
  earlyEndReason?: "student_reason";
}): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data } = await admin.from("sessions").select("teacher_id").eq("id", params.sessionId).maybeSingle();
    if (!data || data.teacher_id !== user.id) {
      return { ok: false, error: "본인 수업만 종료할 수 있습니다." };
    }
    const { error } = await admin.rpc("finalize_lesson_session", {
      p_session_id: params.sessionId,
      p_outcome: params.outcome,
      p_actor_id: user.id,
      p_reason: params.reason,
      p_teacher_fault_provided_minutes: params.teacherFaultProvidedMinutes ?? null,
      p_early_end_reason: params.earlyEndReason ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * M5-b — 선생님 지각의 당일 상호 합의 연장(요구사항 1) + 미이행분 보충시간 이관(요구사항 2).
 * 본인 세션인지 admin 클라이언트로 재확인한 뒤 resolve_teacher_lateness()를 호출한다.
 * p_agreed_extend_minutes만큼 예정 종료 시각을 뒤로 밀고(선생님 가능시간·기존 예약 충돌
 * 검사 통과 시에만), 나머지는 makeup_obligations(teacher_late)로 자동 이관된다.
 */
export async function resolveMyLessonLateness(params: {
  sessionId: string;
  lateMinutes: number;
  agreedExtendMinutes: number;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data } = await admin.from("sessions").select("teacher_id").eq("id", params.sessionId).maybeSingle();
    if (!data || data.teacher_id !== user.id) {
      return { ok: false, error: "본인 수업만 연장할 수 있습니다." };
    }
    const { error } = await admin.rpc("resolve_teacher_lateness", {
      p_session_id: params.sessionId,
      p_late_minutes: params.lateMinutes,
      p_agreed_extend_minutes: params.agreedExtendMinutes,
      p_actor_id: user.id,
      p_reason: params.reason,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
