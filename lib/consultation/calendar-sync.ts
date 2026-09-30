import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime, deleteCalendarEvent } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink, ensureMeetSpaceSmartNotesOn } from "@/lib/google-meet";
import { sendEmail } from "@/lib/email";
import { DEFAULT_TIMEZONE, timezoneLabel } from "@/lib/timezone";
import { CALENDAR_SYNC_MAX_ATTEMPTS, createCalendarResyncKit, type SyncOutcome } from "./calendar-resync-kit";

// M1 — 상담 확정 시 Calendar 이벤트+Meet 생성. R6 lib/booking/calendar-sync.ts와 같은
// 원칙을 그대로 따르되, subject는 원래 회사 상담 관리자 계정(official@alton.education)
// 이었다 — M1 요구사항 3.
//
// 2026-09-22(컨설턴트 스펙 §Meeting and Calendar Rules) — "이벤트 organizer와 가능
// 시간은 배정된 컨설턴트여야 한다"는 요구에 따라, admissions_consultant_id가 있으면
// 그 컨설턴트의 실제 Google Workspace 계정을 organizer로 쓴다(R6 lib/booking/
// calendar-sync.ts가 이미 선생님마다 resolveTeacherWorkspaceEmail()로 하는 것과 동일한
// 패턴 — 서비스 계정의 도메인 위임은 특정 메일함 하나가 아니라 도메인 전체에 대해
// 이미 허용돼 있으므로 컨설턴트별 추가 설정이 필요 없다). 배정된 컨설턴트가 없는
// 카테고리(예: 선생님 지원자 상담)는 기존처럼 CONSULT_ORGANIZER_EMAIL을 그대로 쓴다.
//
// 실패해도 consultations.status(requested/scheduled 등)와 hold는 절대 건드리지
// 않는다 — google_sync_status만 pending/failed/reconciliation_needed로 남아
// 관리자가 재처리 대상으로 확인할 수 있게 한다(R3/R4/R6와 동일한 graceful
// degradation 원칙).

const MAX_RETRY_COUNT = CALENDAR_SYNC_MAX_ATTEMPTS;
const CONSULT_ORGANIZER_EMAIL = process.env.CONSULT_ORGANIZER_EMAIL ?? "official@alton.education";

type ConsultationRow = {
  id: string;
  status?: string;
  google_event_deleted_at?: string | null;
  contact_name: string;
  contact_email: string;
  starts_at: string;
  ends_at: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  google_sync_status: string;
  google_sync_retry_count: number;
  consent_version_id: string | null;
  confirmation_email_content_hash: string | null;
  admissions_consultant_id: string | null;
  /** 고객이 예약 링크에서 고른 표시 시간대(메모리 전용 — 즉시 동기화 경로에서만 채워진다). */
  display_timezone?: string;
};

/** 배정된 컨설턴트가 있으면 그 사람의 실제 이메일을, 없으면 기존 회사 계정을 organizer로 쓴다. */
async function resolveConsultOrganizerEmail(
  admin: ReturnType<typeof createAdminClient>,
  admissionsConsultantId: string | null
): Promise<string> {
  if (!admissionsConsultantId) return CONSULT_ORGANIZER_EMAIL;
  const { data, error } = await admin.auth.admin.getUserById(admissionsConsultantId);
  if (error || !data.user?.email) return CONSULT_ORGANIZER_EMAIL;
  return data.user.email;
}

/**
 * 상담 Meet space의 Smart Notes 상태를 확인·보정한다(요구사항 3, 2026-09-03 정책 정정).
 * `official@alton.education` 조직 차원 자동 회의록 정책이 이미 켜져 있으면 그것으로
 * 충분하다 — ensureMeetSpaceSmartNotesOn()이 먼저 GET으로 확인하고, ON이 아닐 때만
 * 기존 canonical name PATCH 경로(enableMeetSpaceSmartNotes)로 보정을 시도한다.
 * 이 확인·보정이 실패해도 상담 확정 이메일 발송 자체는 막지 않는다(호출부가 이 함수의
 * 성공 여부와 무관하게 이메일을 보낸다) — 다만 smart_notes_config_status가 'applied'로
 * 확인되기 전까지는 admin_record_consultation_outcome()이 서버에서 완료 처리를 막는다
 * (readiness 게이트, 아래 3번 섹션 참고).
 */
async function applySmartNotesBestEffort(params: {
  admin: ReturnType<typeof createAdminClient>;
  consultationId: string;
  meetLink: string;
  organizerEmail: string;
}): Promise<void> {
  const meetingCode = extractMeetingCodeFromLink(params.meetLink);
  if (!meetingCode) return;
  try {
    await ensureMeetSpaceSmartNotesOn({ teacherWorkspaceEmail: params.organizerEmail, meetingCode });
    await params.admin
      .from("consultations")
      .update({ smart_notes_config_status: "applied", smart_notes_config_error: null })
      .eq("id", params.consultationId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await params.admin
      .from("consultations")
      .update({ smart_notes_config_status: "failed", smart_notes_config_error: message.slice(0, 500) })
      .eq("id", params.consultationId);
    console.error(
      JSON.stringify({ type: "m1_consult_smart_notes_config_failed", consultationId: params.consultationId, error: message })
    );
  }
}

/** starts_at+meetLink 지문(요구사항 6) — 이 값이 이전과 같으면 이메일을 다시 보내지 않는다. */
function computeConfirmationContentHash(startsAtIso: string, meetLink: string): string {
  return createHash("sha256").update(`${startsAtIso}|${meetLink}`).digest("hex");
}

/**
 * **(2026-09-03 정책 전환, 요구사항 6)** Calendar 네이티브 초대가 확정 일정의 기본
 * 전달 수단이 된 뒤에는, 그 초대가 성공적으로 나갔다면 같은 정보를 담은 커스텀 SMTP
 * 확인 메일을 또 보내지 않는다 — 이 함수는 Calendar 초대 자체가 반복 실패해
 * `reconciliation_needed`에 도달했을 때만 fallback으로 호출된다("Google 초대
 * 실패처럼 Calendar가 담당 못하는 알림만 ALTON 이메일 경로로" 원칙).
 */
async function sendConsultationCalendarFailureFallbackEmail(params: {
  admin: ReturnType<typeof createAdminClient>;
  row: ConsultationRow;
  errorMessage: string;
}): Promise<void> {
  const contentHash = `fallback:${params.errorMessage}`;
  if (params.row.confirmation_email_content_hash === contentHash) return; // 같은 실패로 중복 발송 안 함

  const startsAt = new Date(params.row.starts_at);
  const tz = params.row.display_timezone ?? DEFAULT_TIMEZONE;
  const formatted = startsAt.toLocaleString("ko-KR", { timeZone: tz, dateStyle: "full", timeStyle: "short" });

  // 2026-09-28(초기 고객 절차 단순화) — 첫 상담에는 AI 기록을 쓰지 않으므로
  // 동의 확인 안내 문구·링크를 뺐다.
  await sendEmail({
    to: params.row.contact_email,
    subject: "[Alton Education] 상담 일정 안내 (Google 캘린더 초대 발송 실패)",
    html: `
      <p>${params.row.contact_name}님, 안녕하세요.</p>
      <p>신청하신 상담 일정이 아래와 같이 확정되었으나, Google 캘린더 초대 발송에 일시적인
      문제가 있어 이메일로 대신 안내드립니다. 담당자가 곧 다시 시도합니다.</p>
      <p><b>상담 일시:</b> ${formatted} (${timezoneLabel(tz)})</p>
      <p>Meet 링크는 준비되는 대로 별도로 안내드리겠습니다.</p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });

  await params.admin
    .from("consultations")
    .update({ confirmation_email_sent_at: new Date().toISOString(), confirmation_email_content_hash: contentHash })
    .eq("id", params.row.id);
}

async function processOneConsultation(
  admin: ReturnType<typeof createAdminClient>,
  row: ConsultationRow
): Promise<{ createdEventId: string | null }> {
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  const tz = row.display_timezone ?? DEFAULT_TIMEZONE;

  let googleEventId = row.google_event_id;
  let meetLink = row.google_meet_link;
  let createdEventId: string | null = null;
  const organizerEmail = await resolveConsultOrganizerEmail(admin, row.admissions_consultant_id);

  if (!googleEventId) {
    // 요구사항 2(2026-09-03 정책 전환, 2026-09-22 컨설턴트 스펙 개정): 배정된
    // 컨설턴트가 있으면 그 사람이, 없으면 official@alton.education이 organizer.
    // 신청 이메일이 유일한 외부 attendee. sendUpdates="all"로 Google 네이티브
    // 초대 메일이 나간다.
    //
    // 2026-09-28(초기 고객 절차 단순화) — 첫 상담에는 AI 회의록(Smart Notes)을
    // 쓰지 않으므로 동의 확인 URL 발급·description 삽입을 제거했다. 별도 AI
    // 처리 동의 자체가 불필요해짐(docs/2026-09-26-consent-contract-
    // simplification-implementation-plan.md 3단계).
    const created = await createCalendarEventWithMeet({
      teacherWorkspaceEmail: organizerEmail,
      reservationId: `consult-${row.id}`,
      startsAt,
      endsAt,
      summary: `[Alton Education 상담] ${row.contact_name}`,
      description:
        `Alton Education 1:1 상담입니다. ` +
        `일정 변경·취소는 담당자에게 문의해 주세요 — 변경 시 이 캘린더 일정이 자동으로 갱신됩니다.` +
        (row.display_timezone
          ? `\n상담 일시: ${startsAt.toLocaleString("ko-KR", { timeZone: tz, dateStyle: "full", timeStyle: "short" })} (${timezoneLabel(tz)})`
          : ""),
      timezone: tz,
      attendeeEmail: row.contact_email,
      sendUpdates: "all",
    });
    googleEventId = created.googleEventId;
    createdEventId = created.googleEventId;
    meetLink = created.meetLink;
  } else {
    // 요구사항 2: 시간 변경도 같은 이벤트를 PATCH하고 sendUpdates="all"로 Google
    // 네이티브 변경 알림을 보낸다 — 별도 커스텀 이메일을 추가로 보내지 않는다.
    await patchCalendarEventTime({
      teacherWorkspaceEmail: organizerEmail,
      googleEventId,
      startsAt,
      endsAt,
      timezone: tz,
      sendUpdates: "all",
    });
  }

  const meetingCode = meetLink ? extractMeetingCodeFromLink(meetLink) : null;
  const contentHash = meetLink ? computeConfirmationContentHash(row.starts_at, meetLink) : null;

  await admin
    .from("consultations")
    .update({
      google_event_id: googleEventId,
      google_meet_link: meetLink,
      google_meeting_code: meetingCode,
      google_sync_status: "synced",
      google_sync_last_error: null,
      // Calendar 네이티브 초대가 이번 시도로 성공했다는 뜻이므로, 과거 fallback 커스텀
      // 이메일 지문이 남아있었다면 지운다(다음 실패 시 다시 fallback을 보낼 수 있게).
      confirmation_email_content_hash: contentHash,
    })
    .eq("id", row.id);

  // 2026-09-28(초기 고객 절차 단순화) — 첫 상담에는 AI 기록을 쓰지 않으므로
  // Smart Notes 활성화(applySmartNotesBestEffort)와 Workspace Events 구독
  // (ensureSubscriptionForOrganizer)을 더 이상 시도하지 않는다.
  return { createdEventId };
}

async function deleteConsultationEvent(admin: ReturnType<typeof createAdminClient>, row: ConsultationRow, eventId: string): Promise<void> {
  const organizerEmail = await resolveConsultOrganizerEmail(admin, row.admissions_consultant_id);
  // 404/410(이미 없음)은 deleteCalendarEvent 가 성공으로 취급한다. 참석자에게 취소 알림(sendUpdates=all).
  await deleteCalendarEvent({ teacherWorkspaceEmail: organizerEmail, googleEventId: eventId, sendUpdates: "all" });
  await admin.from("consultations").update({ google_event_deleted_at: new Date().toISOString() }).eq("id", row.id);
}

/**
 * 재시도 가능한 멱등 동기화(2026-09-29): 취소됨+이벤트 있음+미삭제→삭제 / 이벤트 없음→생성 / 있음→시간 PATCH.
 * 저장된 google_event_id 로만 판단하므로 두 번 실행해도 이벤트가 두 개 생기지 않는다.
 * 생성하는 사이 상담이 취소됐다면 방금 만든 이벤트를 바로 지운다(고아 이벤트 방지).
 */
async function syncOneConsultation(admin: ReturnType<typeof createAdminClient>, row: ConsultationRow): Promise<void> {
  if (row.status === "cancelled") {
    if (row.google_event_id && !row.google_event_deleted_at) await deleteConsultationEvent(admin, row, row.google_event_id);
    return;
  }
  if (!row.starts_at || !row.ends_at) return; // 동기화할 일정 없음
  const { createdEventId } = await processOneConsultation(admin, row);
  if (!createdEventId) return;
  const { data: fresh } = await admin.from("consultations").select("status").eq("id", row.id).maybeSingle();
  if ((fresh as { status?: string } | null)?.status === "cancelled") {
    await deleteConsultationEvent(admin, row, createdEventId);
  }
}

const kit = createCalendarResyncKit<ConsultationRow>({
  table: "consultations",
  claimRpc: "claim_consultation_calendar_syncs",
  claimIdParam: "p_consultation_id",
  successStatus: "synced",
  logPrefix: "consultation_calendar",
  syncOne: syncOneConsultation,
  // Calendar 초대가 재시도 한도까지 반복 실패했을 때만 ALTON 커스텀 이메일로 fallback 안내한다.
  onPermanent: async (admin, row, message) => {
    if (row.status === "cancelled") return; // 취소된 상담에 일정 안내 메일을 보내지 않는다
    await sendConsultationCalendarFailureFallbackEmail({ admin, row, errorMessage: message.slice(0, 200) });
  },
});

/** 특정 상담 하나를 지금 재시도(즉시 재시도·관리자 버튼). 실제 호출이 꺼져 있으면 아무것도 하지 않는다. */
export const resyncConsultationCalendarNow = (consultationId: string): Promise<SyncOutcome> => kit.resyncNow(consultationId);
/** 일 1회 크론 본체. */
export const runConsultationCalendarResyncBatch = (limit = 20) => kit.runBatch(limit);
/** 실패한 액션 직후 호출 — 응답을 막지 않고(after) 어떤 오류도 삼킨다. */
export const scheduleConsultationCalendarResync = (consultationId: string): void => kit.schedule(consultationId);
/** 관리자 수동 재동기화 — 자동 재시도 중단(5회)도 횟수를 0으로 되돌려 다시 시도한다. */
export const adminForceResyncConsultationCalendar = (consultationId: string): Promise<SyncOutcome> => kit.forceResync(consultationId);

/** 확정된(scheduled) 상담 하나를 즉시 동기화한다 — 관리자 수락/시간변경 직후 호출. */
export async function syncOneConsultationCalendarEvent(consultationId: string, opts?: { timezone?: string }): Promise<void> {
  const admin = createAdminClient();

  // 조건부 UPDATE 낙관적 잠금 + 10분 임대 — 즉시 호출 경로·즉시 재시도·일 1회 크론이 동시에 같은 상담을 건드려도 하나만 처리한다.
  const now = new Date();
  const leaseExpired = new Date(now.getTime() - 10 * 60_000).toISOString();
  const { data: claimed } = await admin
    .from("consultations")
    .update({ google_sync_status: "pending", google_sync_claimed_at: now.toISOString() })
    .eq("id", consultationId)
    .in("google_sync_status", ["pending", "failed"])
    .or(`google_sync_claimed_at.is.null,google_sync_claimed_at.lt.${leaseExpired}`)
    .select("*")
    .maybeSingle();

  if (!claimed) return;
  const outcome = await kit.processClaimed(
    admin,
    { ...(claimed as ConsultationRow), ...(opts?.timezone ? { display_timezone: opts.timezone } : {}) },
  );
  // 실패하면 응답을 막지 않고 곧바로 한 번 더 시도한다(일시 오류 회수). 5회에 이르면 멈춘다.
  if (outcome === "failed") scheduleConsultationCalendarResync(consultationId);
}

/** 배치 재처리 워커 — 관리자 화면 "재처리" 버튼 또는 향후 cron이 호출. */
export async function processPendingConsultationCalendarSyncs(): Promise<{ processed: number }> {
  const admin = createAdminClient();
  const { data: pendingIds } = await admin
    .from("consultations")
    .select("id")
    .in("google_sync_status", ["pending", "failed"])
    .not("starts_at", "is", null)
    .eq("status", "scheduled")
    .lt("google_sync_retry_count", MAX_RETRY_COUNT);

  for (const { id } of pendingIds ?? []) {
    await syncOneConsultationCalendarEvent(id);
  }
  return { processed: (pendingIds ?? []).length };
}

/** 관리자 수동 재시도(요구사항 3) — 이미 Meet 링크가 있는 상담의 Smart Notes 상태만 다시
 * 확인·보정한다. Calendar 이벤트 자체가 아직 없으면(google_meet_link null) 아무것도 하지
 * 않는다(먼저 Calendar 재처리가 필요하다는 뜻이므로 이 함수의 책임이 아니다). */
export async function retrySmartNotesConfigForConsultation(consultationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("consultations")
    .select("id, google_meet_link, admissions_consultant_id")
    .eq("id", consultationId)
    .maybeSingle();
  if (!row?.google_meet_link) return;
  const organizerEmail = await resolveConsultOrganizerEmail(admin, row.admissions_consultant_id);
  await applySmartNotesBestEffort({ admin, consultationId, meetLink: row.google_meet_link, organizerEmail });
}

/**
 * 취소 시 Google 이벤트도 삭제한다(취소는 DB 확정 이후에만 발생하므로 실패해도 상담 취소 자체는 막지 않는다).
 * DB 트리거(consultations_flag_cancel_event_cleanup)가 이미 'failed'(삭제 대기)로 표시했다 — 지금 바로 지워 보고,
 * 안 되면 그대로 재시도 대기(즉시 after 재시도 → 일 1회 크론 → 관리자 버튼).
 */
export async function cancelSyncedConsultationCalendarEvent(consultationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("consultations")
    .select("id, google_event_id, google_event_deleted_at")
    .eq("id", consultationId)
    .maybeSingle();
  if (!row?.google_event_id || row.google_event_deleted_at) return;

  let outcome: SyncOutcome = "skipped";
  try {
    // 최초 삭제 시도는 게이트와 무관하게 실행한다(기존 동작 유지) — 재시도만 CALENDAR_SYNC_ALLOW_REAL_CALLS 로 막는다.
    outcome = await kit.resyncNow(consultationId, { skipGate: true });
  } catch (e) {
    console.error(JSON.stringify({ type: "m1_consult_calendar_delete_failed", consultationId, error: e instanceof Error ? e.message : String(e) }));
  }
  if (outcome === "failed") scheduleConsultationCalendarResync(consultationId);
}

type UnlinkedSmartNotesEventRow = {
  id: string;
  google_meeting_code: string | null;
  drive_file_id: string | null;
};

/**
 * 관리자 수동 재처리(요구사항 4) — Smart Notes 원본 매칭 실패(`linked=false`, `session_id`/
 * `consultation_id` 둘 다 null)로 남은 이벤트를 다시 매칭 시도한다. 실제 원인은 대개
 * 레이스(Smart Notes 이벤트가 상담의 `google_meeting_code`가 아직 저장되기 전에 먼저
 * 도착)이므로, Calendar 동기화가 나중에 끝난 뒤 이 재처리가 성공적으로 연결할 수 있다.
 * 이번에도 매칭에 실패하면 그대로 `linked=false`로 남아 다음 재처리 대상이 된다(유실 없음).
 */
export async function reprocessUnlinkedSmartNotesEvents(): Promise<{ relinked: number; stillUnlinked: number }> {
  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("smart_notes_generation_events")
    .select("id, google_meeting_code, drive_file_id")
    .eq("linked", false)
    .is("session_id", null)
    .is("consultation_id", null)
    .not("google_meeting_code", "is", null);

  let relinked = 0;
  let stillUnlinked = 0;
  for (const row of (candidates ?? []) as UnlinkedSmartNotesEventRow[]) {
    const { data: consultation } = await admin
      .from("consultations")
      .select("id")
      .eq("google_meeting_code", row.google_meeting_code ?? "")
      .maybeSingle();
    if (!consultation) {
      stillUnlinked += 1;
      continue;
    }
    await admin.from("smart_notes_generation_events").update({ consultation_id: consultation.id, linked: true }).eq("id", row.id);
    if (row.drive_file_id) {
      await admin.from("consultations").update({ smart_notes_drive_file_id: row.drive_file_id }).eq("id", consultation.id);
    }
    relinked += 1;
  }
  return { relinked, stillUnlinked };
}
