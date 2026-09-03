"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { syncOneConsultationCalendarEvent, cancelSyncedConsultationCalendarEvent, processPendingConsultationCalendarSyncs, retrySmartNotesConfigForConsultation, reprocessUnlinkedSmartNotesEvents } from "@/lib/consultation/calendar-sync";

// M1 — 관리자 상담 운영(요구사항 1·3·6). 홈페이지 신청은 app/consult-actions.ts,
// 슬롯/hold/상태전이의 소스오브트루스는 20261009000000_m1_consultation_unification.sql의
// SECURITY DEFINER 함수들이다 — 이 서버 액션은 인증(requireAdmin)만 앞단에서 확인하고
// 실제 상태 전이는 그 함수들에 위임한다(admin_accept_consultation 등이 내부에서 다시
// is_admin()을 검사하므로 이중 방어).

export type ConsultationListItem = {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  student_grade: string | null;
  concerns: string | null;
  status: string;
  source: string;
  starts_at: string | null;
  ends_at: string | null;
  scheduled_at: string | null;
  hold_expires_at: string | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  google_sync_status: string;
  google_sync_retry_count: number;
  google_sync_last_error: string | null;
  smart_notes_config_status: string;
  smart_notes_config_error: string | null;
  smart_notes_drive_file_id: string | null;
  admin_review_summary: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  prospect_contact_id: string | null;
  consent_version_id: string | null;
  consent_confirmed_at: string | null;
  /** M1 요구사항 3(2026-09-03, 2026-09-03 조건부 승인 보완으로 두 단계로 분리) —
   * "상담 진행 가능"(동의 확인 + Smart Notes ON)과 "상담 완료 가능"(그 위에 Smart Notes
   * 원본 자동 연결 + 비어있지 않은 관리자 검토 요약)은 서로 다른 시점의 서로 다른 기준이다
   * — 상담 시작 전에는 원본 연결·검토 요약이 존재할 수 없으므로 같은 게이트로 묶을 수 없다.
   * 서버(admin_record_consultation_outcome)가 "완료 가능" 4개 조건을 전부 다시 검사하므로,
   * 이 필드는 어디까지나 UI 안내용이다. */
  consultReadiness: "ready" | "consent_pending" | "smart_notes_pending" | "not_applicable";
  completionReadiness: "ready" | "consult_not_ready" | "smart_notes_not_linked" | "summary_missing" | "not_applicable";
};

function computeConsultReadiness(row: {
  status: string;
  consent_confirmed_at: string | null;
  smart_notes_config_status: string;
}): ConsultationListItem["consultReadiness"] {
  if (row.status !== "scheduled" && row.status !== "completed") return "not_applicable";
  if (!row.consent_confirmed_at) return "consent_pending";
  if (row.smart_notes_config_status !== "applied") return "smart_notes_pending";
  return "ready";
}

function computeCompletionReadiness(row: {
  status: string;
  consent_confirmed_at: string | null;
  smart_notes_config_status: string;
  smart_notes_drive_file_id: string | null;
  admin_review_summary: string | null;
}): ConsultationListItem["completionReadiness"] {
  if (row.status !== "scheduled" && row.status !== "completed") return "not_applicable";
  if (!row.consent_confirmed_at || row.smart_notes_config_status !== "applied") return "consult_not_ready";
  if (!row.smart_notes_drive_file_id) return "smart_notes_not_linked";
  if (!row.admin_review_summary || row.admin_review_summary.trim() === "") return "summary_missing";
  return "ready";
}

/** 관리자 "상담 운영" 화면 — 예정 상담 리스트 + 오늘/주간/월간 캘린더 조회(요구사항 3). */
export async function listConsultationsForAdmin(params: { from: string; to: string }): Promise<ConsultationListItem[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultations")
    .select(
      "id, contact_name, contact_email, contact_phone, student_grade, concerns, status, source, starts_at, ends_at, scheduled_at, hold_expires_at, google_event_id, google_meet_link, google_sync_status, google_sync_retry_count, google_sync_last_error, smart_notes_config_status, smart_notes_config_error, smart_notes_drive_file_id, admin_review_summary, outcome, outcome_notes, prospect_contact_id, consent_version_id, consent_confirmed_at"
    )
    .gte("starts_at", params.from)
    .lt("starts_at", params.to)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ConsultationListItem[]).map((row) => ({ ...row, consultReadiness: computeConsultReadiness(row), completionReadiness: computeCompletionReadiness(row) }));
}

/** 승인 대기(requested) 목록 — hold 만료 여부와 무관하게 전부 보여준다(관리자가 뒤늦게라도 처리 가능). */
export async function listPendingConsultationRequests(): Promise<ConsultationListItem[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultations")
    .select(
      "id, contact_name, contact_email, contact_phone, student_grade, concerns, status, source, starts_at, ends_at, scheduled_at, hold_expires_at, google_event_id, google_meet_link, google_sync_status, google_sync_retry_count, google_sync_last_error, smart_notes_config_status, smart_notes_config_error, smart_notes_drive_file_id, admin_review_summary, outcome, outcome_notes, prospect_contact_id, consent_version_id, consent_confirmed_at"
    )
    .eq("status", "requested")
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ConsultationListItem[]).map((row) => ({ ...row, consultReadiness: computeConsultReadiness(row), completionReadiness: computeCompletionReadiness(row) }));
}

/** M1 요구사항 3 — Smart Notes 확인·보정을 관리자가 수동으로 재시도(Meet space가 아직 없거나
 * 이전 시도가 실패했을 때). 성공 여부와 무관하게 readiness는 다음 listConsultationsForAdmin
 * 호출에서 다시 계산된다. */
export async function retryConsultationSmartNotesConfig(consultationId: string): Promise<void> {
  await requireAdmin();
  await retrySmartNotesConfigForConsultation(consultationId);
}

export async function acceptConsultationRequest(consultationId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: activeConsent } = await supabase
    .from("consult_consent_versions")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.rpc("admin_accept_consultation", {
    p_consultation_id: consultationId,
    p_consent_version_id: activeConsent?.id ?? null,
  });
  if (error) throw new Error(error.message);

  // 요구사항 3: 수락 시 Calendar·Meet 생성. 실패해도 위 RPC의 status='scheduled'
  // 전환 자체는 이미 커밋됐다 — google_sync_status만 재처리 대상으로 남는다.
  await syncOneConsultationCalendarEvent(consultationId);
}

export async function rejectConsultationRequest(consultationId: string, reason: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reject_consultation", {
    p_consultation_id: consultationId,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
}

export async function rescheduleConsultationRequest(consultationId: string, newStartsAtIso: string, reason: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reschedule_consultation", {
    p_consultation_id: consultationId,
    p_new_starts_at: newStartsAtIso,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);

  // ALTON과 Google Calendar가 최종 일치하도록 처리(요구사항 3) — 이미 Calendar
  // 이벤트가 있으면 patch, 없으면(아직 미확정 requested 건의 시간 변경 등) 스킵.
  await syncOneConsultationCalendarEvent(consultationId);
}

export async function cancelConsultationRequest(consultationId: string, reason: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_cancel_consultation", {
    p_consultation_id: consultationId,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);

  await cancelSyncedConsultationCalendarEvent(consultationId);
}

/** 요구사항 6: 상담 결과 기록(체험 진행 권장/정규 진행 권장/보류/종료) — M2/M3 연결 지점. */
export async function recordConsultationOutcome(params: {
  consultationId: string;
  outcome: "trial_recommended" | "regular_recommended" | "on_hold" | "closed";
  notes: string;
  adminReviewSummary: string;
}): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_record_consultation_outcome", {
    p_consultation_id: params.consultationId,
    p_outcome: params.outcome,
    p_notes: params.notes || null,
    p_admin_review_summary: params.adminReviewSummary || null,
  });
  if (error) throw new Error(error.message);
}

export async function retryFailedConsultationCalendarSyncs(): Promise<{ processed: number }> {
  await requireAdmin();
  return processPendingConsultationCalendarSyncs();
}

/** M1 요구사항 4 — Smart Notes 원본 매칭 실패 이벤트를 재처리(대개 레이스로 인한 일시적 실패). */
export async function reprocessUnlinkedConsultationSmartNotesEvents(): Promise<{ relinked: number; stillUnlinked: number }> {
  await requireAdmin();
  return reprocessUnlinkedSmartNotesEvents();
}

// =========================================================================
// 공용 상담 가능시간 관리 (요구사항 1)
// =========================================================================

export type ConsultAvailabilityRule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export async function listConsultAvailabilityRules(): Promise<ConsultAvailabilityRule[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consult_availability_rules")
    .select("id, weekday, start_time, end_time, active")
    .order("weekday", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsultAvailabilityRule[];
}

export async function addConsultAvailabilityRule(params: { weekday: number; startTime: string; endTime: string }): Promise<void> {
  const { adminUserId, supabase } = await requireAdmin();
  const { error } = await supabase.from("consult_availability_rules").insert({
    weekday: params.weekday,
    start_time: params.startTime,
    end_time: params.endTime,
    created_by: adminUserId,
  });
  if (error) throw new Error(error.message);
}

export async function deactivateConsultAvailabilityRule(ruleId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("consult_availability_rules").update({ active: false }).eq("id", ruleId);
  if (error) throw new Error(error.message);
}

export type ConsultAvailabilityException = {
  id: string;
  exception_date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export async function listConsultAvailabilityExceptions(): Promise<ConsultAvailabilityException[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consult_availability_exceptions")
    .select("id, exception_date, is_closed, start_time, end_time, reason")
    .order("exception_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsultAvailabilityException[];
}

export async function addConsultAvailabilityException(params: {
  date: string;
  isClosed: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}): Promise<void> {
  const { adminUserId, supabase } = await requireAdmin();
  const { error } = await supabase.from("consult_availability_exceptions").insert({
    exception_date: params.date,
    is_closed: params.isClosed,
    start_time: params.isClosed ? null : params.startTime,
    end_time: params.isClosed ? null : params.endTime,
    reason: params.reason || null,
    created_by: adminUserId,
  });
  if (error) throw new Error(error.message);
}

export async function removeConsultAvailabilityException(exceptionId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("consult_availability_exceptions").delete().eq("id", exceptionId);
  if (error) throw new Error(error.message);
}
