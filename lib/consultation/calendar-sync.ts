import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime, deleteCalendarEvent } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink, ensureMeetSpaceSmartNotesOn } from "@/lib/google-meet";
import { sendEmail } from "@/lib/email";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { currentRequestOrigin } from "@/lib/request-origin";
import { ensureSubscriptionForOrganizer } from "@/lib/workspace-events/subscription-lifecycle";

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

/**
 * 동의 확인 토큰을 발급하고 절대 URL을 만든다(요구사항 5) — Calendar 이벤트
 * description과 이메일(정상/fallback 둘 다) 어디에도 상담 UUID 자체를 노출하지 않는다.
 */
async function issueConsentUrl(admin: ReturnType<typeof createAdminClient>, consultationId: string): Promise<string> {
  const tokenPlain = randomBytes(32).toString("hex");
  const { error: issueError } = await admin.rpc("issue_consult_consent_token", {
    p_consultation_id: consultationId,
    p_token_plain: tokenPlain,
  });
  if (issueError) throw new Error(`동의 확인 토큰 발급 실패: ${issueError.message}`);
  const origin = await currentRequestOrigin();
  return `${origin}/consult/consent?token=${tokenPlain}`;
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

  const consentUrl = await issueConsentUrl(params.admin, params.row.id);
  const startsAt = new Date(params.row.starts_at);
  const formatted = startsAt.toLocaleString("ko-KR", { timeZone: DEFAULT_TIMEZONE, dateStyle: "full", timeStyle: "short" });

  await sendEmail({
    to: params.row.contact_email,
    subject: "[Alton Education] 상담 일정 안내 (Google 캘린더 초대 발송 실패)",
    html: `
      <p>${params.row.contact_name}님, 안녕하세요.</p>
      <p>신청하신 상담 일정이 아래와 같이 확정되었으나, Google 캘린더 초대 발송에 일시적인
      문제가 있어 이메일로 대신 안내드립니다. 담당자가 곧 다시 시도합니다.</p>
      <p><b>상담 일시:</b> ${formatted} (${DEFAULT_TIMEZONE})</p>
      <p>Meet 링크는 준비되는 대로 별도로 안내드리겠습니다.</p>
      <p><b>AI 회의록(Smart Notes) 안내:</b> 이 상담은 AI 회의록 기능을 사용합니다. 상담 전 아래
      안내·동의 확인 페이지에서 1회 확인해 주세요: <a href="${consentUrl}">${consentUrl}</a></p>
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
): Promise<void> {
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);

  let googleEventId = row.google_event_id;
  let meetLink = row.google_meet_link;

  if (!googleEventId) {
    // 요구사항 2(2026-09-03 정책 전환): official@alton.education이 organizer, 신청
    // 이메일이 유일한 외부 attendee. sendUpdates="all"로 Google 네이티브 초대 메일이
    // 나간다 — 동의 확인 링크는 상담 UUID가 아니라 만료형 토큰으로만 이벤트 설명에
    // 싣는다(요구사항 5와 동일한 원칙, Calendar description도 예외 없음).
    const consentUrl = await issueConsentUrl(admin, row.id);
    const created = await createCalendarEventWithMeet({
      teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL,
      reservationId: `consult-${row.id}`,
      startsAt,
      endsAt,
      summary: `[Alton Education 상담] ${row.contact_name}`,
      description:
        `Alton Education 1:1 상담입니다. 이 상담은 AI 회의록(Smart Notes) 기능을 사용합니다. ` +
        `상담 전 아래 안내·동의 확인 페이지에서 1회 확인해 주세요: ${consentUrl}\n\n` +
        `일정 변경·취소는 담당자에게 문의해 주세요 — 변경 시 이 캘린더 일정이 자동으로 갱신됩니다.`,
      timezone: DEFAULT_TIMEZONE,
      attendeeEmail: row.contact_email,
      sendUpdates: "all",
    });
    googleEventId = created.googleEventId;
    meetLink = created.meetLink;
  } else {
    // 요구사항 2: 시간 변경도 같은 이벤트를 PATCH하고 sendUpdates="all"로 Google
    // 네이티브 변경 알림을 보낸다 — 별도 커스텀 이메일을 추가로 보내지 않는다.
    await patchCalendarEventTime({
      teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL,
      googleEventId,
      startsAt,
      endsAt,
      timezone: DEFAULT_TIMEZONE,
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

  if (meetLink) {
    // Smart Notes 확인·보정은 Calendar 초대 성공 여부와 무관하게 항상 시도한다.
    await applySmartNotesBestEffort({ admin, consultationId: row.id, meetLink });

    // 요구사항 1 — Smart Notes 원본 자동 연결이 Workspace Events 웹훅에 의존하므로,
    // 이 organizer의 구독이 없거나 만료됐으면 여기서 best-effort로 보장한다. 실패해도
    // 상담 확정 자체는 이미 끝난 뒤라 영향 없음 — 다음 배치 재처리(renewExpiringSubscriptions)
    // 나 사후 대조(reconcileMissedSmartNotesEvents)가 뒤를 받친다.
    try {
      await ensureSubscriptionForOrganizer(CONSULT_ORGANIZER_EMAIL, "consult_organizer");
    } catch (e) {
      console.error(
        JSON.stringify({ type: "m1_consult_workspace_events_subscription_ensure_failed", consultationId: row.id, error: e instanceof Error ? e.message : String(e) })
      );
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

    // 요구사항 2·6: Calendar 초대가 재시도 한도까지 반복 실패했을 때만 ALTON 커스텀
    // 이메일로 fallback 안내한다("Google 초대 실패처럼 Calendar가 담당 못하는 알림만
    // ALTON 이메일 경로로" 원칙) — 이 fallback 자체도 실패해도 상담 확정 상태는 건드리지
    // 않는다.
    if (nextStatus === "reconciliation_needed") {
      try {
        await sendConsultationCalendarFailureFallbackEmail({ admin, row, errorMessage: message.slice(0, 200) });
      } catch (emailError) {
        console.error(
          JSON.stringify({
            type: "m1_consult_calendar_failure_fallback_email_failed",
            consultationId,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          })
        );
      }
    }
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
    await deleteCalendarEvent({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, googleEventId: row.google_event_id, sendUpdates: "all" });
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
