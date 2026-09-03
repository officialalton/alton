import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime, deleteCalendarEvent } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink, enableMeetSpaceSmartNotes } from "@/lib/google-meet";
import { sendEmail } from "@/lib/email";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

// M1 — 상담 확정 시 Calendar 이벤트+Meet 생성. R6 lib/booking/calendar-sync.ts와 같은
// 원칙을 그대로 따르되, subject는 담당 선생님이 아니라 회사 상담 관리자 계정
// (official@alton.education)이다 — M1 요구사항 3.
//
// 실패해도 consultations.status(requested/scheduled 등)와 hold는 절대 건드리지
// 않는다 — google_sync_status만 pending/failed/reconciliation_needed로 남아
// 관리자가 재처리 대상으로 확인할 수 있게 한다(R3/R4/R6와 동일한 graceful
// degradation 원칙).

const MAX_RETRY_COUNT = 5;
const CONSULT_ORGANIZER_EMAIL = process.env.CONSULT_ORGANIZER_EMAIL ?? "official@alton.education";

type ConsultationRow = {
  id: string;
  contact_name: string;
  contact_email: string;
  starts_at: string;
  ends_at: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  google_sync_status: string;
  google_sync_retry_count: number;
  consent_version_id: string | null;
};

async function applySmartNotesBestEffort(params: {
  admin: ReturnType<typeof createAdminClient>;
  consultationId: string;
  meetLink: string;
}): Promise<void> {
  const meetingCode = extractMeetingCodeFromLink(params.meetLink);
  if (!meetingCode) return;
  try {
    await enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, meetingCode });
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

async function sendConsultationConfirmationEmail(params: {
  admin: ReturnType<typeof createAdminClient>;
  row: ConsultationRow;
  meetLink: string;
}): Promise<void> {
  // M1 요구사항 4: 수락 시 보호자 이메일로 한 번에 — 확정 일시, Meet 링크, 일정
  // 변경·취소 안내, 상담용 AI 회의록 및 비밀유지·이용 안내, 상담 동의 확인 경로.
  // 법률 문구는 별도 계약 문서 세션 확정 전까지 consult_consent_versions의
  // placeholder를 그대로 링크한다(임의 문안 확정 금지 — 스펙 원칙).
  const { data: consent } = await params.admin
    .from("consult_consent_versions")
    .select("id, title")
    .eq("id", params.row.consent_version_id ?? "")
    .maybeSingle();

  const startsAt = new Date(params.row.starts_at);
  const formatted = startsAt.toLocaleString("ko-KR", { timeZone: DEFAULT_TIMEZONE, dateStyle: "full", timeStyle: "short" });
  const consentPath = `/consult/${params.row.id}/consent`;

  await sendEmail({
    to: params.row.contact_email,
    subject: "[Alton Education] 상담 일정이 확정되었습니다",
    html: `
      <p>${params.row.contact_name}님, 안녕하세요.</p>
      <p>신청하신 상담 일정이 아래와 같이 확정되었습니다.</p>
      <p><b>상담 일시:</b> ${formatted} (${DEFAULT_TIMEZONE})</p>
      <p><b>Google Meet 링크:</b> <a href="${params.meetLink}">${params.meetLink}</a></p>
      <p>일정 변경·취소가 필요하시면 담당자에게 회신해 주세요 — 변경·취소 시 이 Meet 링크도 함께 갱신됩니다.</p>
      <p><b>AI 회의록(Smart Notes) 안내:</b> 이 상담은 AI 회의록 기능을 사용합니다. 상담 전 아래 안내·동의
      확인 페이지에서 1회 확인해 주세요: <a href="${consentPath}">${consentPath}</a>
      ${consent ? ` (문서 버전: ${consent.title})` : ""}</p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });
}

async function processOneConsultation(
  admin: ReturnType<typeof createAdminClient>,
  row: ConsultationRow
): Promise<void> {
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);

  let googleEventId = row.google_event_id;
  let meetLink = row.google_meet_link;

  if (!googleEventId) {
    const created = await createCalendarEventWithMeet({
      teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL,
      reservationId: `consult-${row.id}`,
      startsAt,
      endsAt,
      summary: `[Alton Education 상담] ${row.contact_name}`,
      timezone: DEFAULT_TIMEZONE,
    });
    googleEventId = created.googleEventId;
    meetLink = created.meetLink;
  } else {
    await patchCalendarEventTime({
      teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL,
      googleEventId,
      startsAt,
      endsAt,
      timezone: DEFAULT_TIMEZONE,
    });
  }

  await admin
    .from("consultations")
    .update({
      google_event_id: googleEventId,
      google_meet_link: meetLink,
      google_sync_status: "synced",
      google_sync_last_error: null,
    })
    .eq("id", row.id);

  if (meetLink) {
    await applySmartNotesBestEffort({ admin, consultationId: row.id, meetLink });
    await sendConsultationConfirmationEmail({ admin, row, meetLink });
  }
}

/** 확정된(scheduled) 상담 하나를 즉시 동기화한다 — 관리자 수락/시간변경 직후 호출. */
export async function syncOneConsultationCalendarEvent(consultationId: string): Promise<void> {
  const admin = createAdminClient();

  // R3 drive-artifacts.ts/R6 calendar-sync.ts와 동일한 조건부 UPDATE 낙관적 잠금 —
  // 즉시 호출 경로와 배치 재처리 워커가 동시에 같은 상담을 건드려도 하나만 처리한다.
  const { data: claimed } = await admin
    .from("consultations")
    .update({ google_sync_status: "pending" })
    .eq("id", consultationId)
    .in("google_sync_status", ["pending", "failed"])
    .select("id, contact_name, contact_email, starts_at, ends_at, google_event_id, google_meet_link, google_sync_status, google_sync_retry_count, consent_version_id")
    .maybeSingle();

  if (!claimed) return;
  const row = claimed as ConsultationRow;

  try {
    await processOneConsultation(admin, row);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const nextRetryCount = (row.google_sync_retry_count ?? 0) + 1;
    const nextStatus = nextRetryCount >= MAX_RETRY_COUNT ? "reconciliation_needed" : "failed";
    await admin
      .from("consultations")
      .update({ google_sync_status: nextStatus, google_sync_retry_count: nextRetryCount, google_sync_last_error: message.slice(0, 500) })
      .eq("id", consultationId);
    console.error(JSON.stringify({ type: "m1_consult_calendar_sync_failed", consultationId, error: message, nextStatus }));
  }
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

/** 취소 시 Google 이벤트도 삭제한다(취소는 hold/DB 확정 이후에만 발생하므로 실패해도 상담 취소 자체는 막지 않는다). */
export async function cancelSyncedConsultationCalendarEvent(consultationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("consultations")
    .select("id, google_event_id")
    .eq("id", consultationId)
    .maybeSingle();
  if (!row?.google_event_id) return;

  try {
    await deleteCalendarEvent({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, googleEventId: row.google_event_id });
    await admin.from("consultations").update({ google_sync_status: "synced", google_sync_last_error: null }).eq("id", consultationId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("consultations").update({ google_sync_status: "reconciliation_needed", google_sync_last_error: message.slice(0, 500) }).eq("id", consultationId);
    console.error(JSON.stringify({ type: "m1_consult_calendar_delete_failed", consultationId, error: message }));
  }
}
