import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime, deleteCalendarEvent } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink, ensureMeetSpaceSmartNotesOn } from "@/lib/google-meet";
import { sendEmail } from "@/lib/email";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { currentRequestOrigin } from "@/lib/request-origin";

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
  confirmation_email_content_hash: string | null;
};

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
}): Promise<void> {
  const meetingCode = extractMeetingCodeFromLink(params.meetLink);
  if (!meetingCode) return;
  try {
    await ensureMeetSpaceSmartNotesOn({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, meetingCode });
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

async function sendConsultationConfirmationEmail(params: {
  admin: ReturnType<typeof createAdminClient>;
  row: ConsultationRow;
  meetLink: string;
  contentHash: string;
}): Promise<void> {
  // M1 요구사항 4: 수락 시 보호자 이메일로 한 번에 — 확정 일시, Meet 링크, 일정
  // 변경·취소 안내, 상담용 AI 회의록 및 비밀유지·이용 안내, 상담 동의 확인 경로.
  // 법률 문구는 별도 계약 문서 세션 확정 전까지 consult_consent_versions의
  // placeholder를 그대로 링크한다(임의 문안 확정 금지 — 스펙 원칙).
  //
  // 요구사항 5(2026-09-03 정정): 상담 UUID를 URL에 노출하지 않는다 — 매 발송마다 새
  // 만료형 확인 토큰(원문은 이 함수 실행 중에만 메모리에 존재, DB에는 해시만 저장)을
  // 발급해 그 토큰만 이메일 링크에 싣는다.
  const { data: consent } = await params.admin
    .from("consult_consent_versions")
    .select("id, title")
    .eq("id", params.row.consent_version_id ?? "")
    .maybeSingle();

  const tokenPlain = randomBytes(32).toString("hex");
  const { error: issueError } = await params.admin.rpc("issue_consult_consent_token", {
    p_consultation_id: params.row.id,
    p_token_plain: tokenPlain,
  });
  if (issueError) throw new Error(`동의 확인 토큰 발급 실패: ${issueError.message}`);

  const origin = await currentRequestOrigin();
  const consentUrl = `${origin}/consult/consent?token=${tokenPlain}`;

  const startsAt = new Date(params.row.starts_at);
  const formatted = startsAt.toLocaleString("ko-KR", { timeZone: DEFAULT_TIMEZONE, dateStyle: "full", timeStyle: "short" });

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
      확인 페이지에서 1회 확인해 주세요: <a href="${consentUrl}">${consentUrl}</a>
      ${consent ? ` (문서 버전: ${consent.title})` : ""}</p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });

  await params.admin
    .from("consultations")
    .update({ confirmation_email_sent_at: new Date().toISOString(), confirmation_email_content_hash: params.contentHash })
    .eq("id", params.row.id);
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

  const meetingCode = meetLink ? extractMeetingCodeFromLink(meetLink) : null;

  await admin
    .from("consultations")
    .update({
      google_event_id: googleEventId,
      google_meet_link: meetLink,
      google_meeting_code: meetingCode,
      google_sync_status: "synced",
      google_sync_last_error: null,
    })
    .eq("id", row.id);

  if (meetLink) {
    // Smart Notes 확인·보정은 이메일 발송 성공 여부와 무관하게 항상 시도한다(요구사항 3
    // 정책 정정 — 실패해도 이메일을 막지 않는다는 것이지, 시도 자체를 생략한다는 뜻이
    // 아니다).
    await applySmartNotesBestEffort({ admin, consultationId: row.id, meetLink });

    // 요구사항 6: 시간/Meet 링크가 실제로 바뀐 경우에만 새 확인 이메일을 보낸다 —
    // 단순 재시도(예: Smart Notes만 재처리되거나 Calendar 재동기화가 아무 변화 없이
    // 재확인된 경우)로 같은 안내를 중복 발송하지 않는다.
    const contentHash = computeConfirmationContentHash(row.starts_at, meetLink);
    if (row.confirmation_email_content_hash !== contentHash) {
      await sendConsultationConfirmationEmail({ admin, row, meetLink, contentHash });
    }
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
    .select("id, contact_name, contact_email, starts_at, ends_at, google_event_id, google_meet_link, google_sync_status, google_sync_retry_count, consent_version_id, confirmation_email_content_hash")
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

/** 관리자 수동 재시도(요구사항 3) — 이미 Meet 링크가 있는 상담의 Smart Notes 상태만 다시
 * 확인·보정한다. Calendar 이벤트 자체가 아직 없으면(google_meet_link null) 아무것도 하지
 * 않는다(먼저 Calendar 재처리가 필요하다는 뜻이므로 이 함수의 책임이 아니다). */
export async function retrySmartNotesConfigForConsultation(consultationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("consultations")
    .select("id, google_meet_link")
    .eq("id", consultationId)
    .maybeSingle();
  if (!row?.google_meet_link) return;
  await applySmartNotesBestEffort({ admin, consultationId, meetLink: row.google_meet_link });
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
