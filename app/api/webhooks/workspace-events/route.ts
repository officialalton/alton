import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase-admin";
import { parseWorkspaceEventPayload } from "@/lib/google-workspace-events";
import { fetchSmartNoteDriveFileId, resolveMeetingCodeFromConferenceRecord } from "@/lib/google-meet";

// R6 10/N — Google Workspace Events API 알림 수신 엔드포인트. Workspace Events는 Google
// Cloud Pub/Sub push 구독으로 배달된다(공식 문서 기준) — 이 라우트는 Pub/Sub push
// 엔드포인트 하나로 Smart Notes 산출물 이벤트와 Meet 참가자 join/leave 이벤트를 함께
// 받는다(두 이벤트 모두 같은 구독을 타는 것으로 가정 — Sandbox 검증 전까지는 추정).
//
// **아직 실제로 이 엔드포인트를 향한 구독을 만들지 않았다** — 구독 생성 자체가
// CALENDAR_SYNC_ALLOW_REAL_CALLS류 게이트로 막힌 실제 외부 쓰기이고, Sandbox 승인 요청의
// 일부다. 지금은 수신 로직·검증·DB 연결만 구현하고 mock 페이로드로 검증한다(테스트 파일
// 참고).
//
// 보안: Pub/Sub push 요청은 OIDC ID 토큰을 Authorization: Bearer 헤더로 싣는다(Pub/Sub
// 구독 생성 시 지정한 서비스 계정으로 서명됨) — google-auth-library로 그 토큰의
// 서명·audience·발급자(기대하는 서비스 계정)를 검증한다. 검증에 필요한
// WORKSPACE_EVENTS_PUSH_AUDIENCE/WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL이 설정돼
// 있지 않으면(현재 상태) 요청을 즉시 거부한다 — fail-closed.

const oauthClient = new OAuth2Client();

async function verifyPubSubPushToken(authHeader: string | null): Promise<void> {
  const audience = process.env.WORKSPACE_EVENTS_PUSH_AUDIENCE;
  const expectedServiceAccount = process.env.WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL;
  if (!audience || !expectedServiceAccount) {
    throw new Error("WORKSPACE_EVENTS_PUSH_AUDIENCE/WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL이 설정되지 않았습니다.");
  }
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authorization 헤더가 없습니다.");
  }
  const token = authHeader.slice("Bearer ".length);
  const ticket = await oauthClient.verifyIdToken({ idToken: token, audience });
  const payload = ticket.getPayload();
  if (!payload || payload.email !== expectedServiceAccount || !payload.email_verified) {
    throw new Error("예상하지 못한 토큰 발급자입니다.");
  }
}

async function resolveReservationByMeetingCode(
  admin: ReturnType<typeof createAdminClient>,
  meetingCode: string | null
): Promise<{ sessionId: string | null; teacherWorkspaceEmail: string | null } | null> {
  if (!meetingCode) return null;
  const { data } = await admin
    .from("reservations")
    .select("id, owner_profile_id, session:sessions!sessions_reservation_id_fkey(id)")
    .eq("google_meeting_code", meetingCode)
    .maybeSingle();
  if (!data) return null;
  const session = Array.isArray(data.session) ? data.session[0] : data.session;
  // teachers.id는 reservations.owner_profile_id가 아니라 profiles.id를 참조하는 1:1
  // 테이블이라 reservations에서 직접 embed할 FK가 없다 — owner_profile_id로 별도 조회한다.
  const { data: teacher } = await admin
    .from("teachers")
    .select("workspace_email")
    .eq("id", data.owner_profile_id)
    .maybeSingle();
  return {
    sessionId: (session as { id?: string } | null)?.id ?? null,
    teacherWorkspaceEmail: teacher?.workspace_email ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    await verifyPubSubPushToken(req.headers.get("authorization"));
  } catch (e) {
    console.error(JSON.stringify({ type: "workspace_events_auth_failed", error: e instanceof Error ? e.message : String(e) }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { message?: { data?: string; attributes?: Record<string, string>; messageId?: string } };
  const raw = body.message?.data;
  if (!raw) {
    // Pub/Sub push 규약상 빈 본문도 2xx로 ack해야 재전송 폭주를 막는다.
    return NextResponse.json({ ok: true, skipped: "no_data" });
  }

  // **(2026-09-03 정정, R6 Sandbox 실측으로 확정)** 이벤트 타입은 JSON 본문이 아니라
  // CloudEvents 봉투의 `ce-type` 메시지 속성(attributes)에 실려온다 — 이전 구현은 이
  // attributes를 아예 읽지 않아 모든 실제 이벤트를 분류하지 못했다(실측된 실제 값:
  // "google.workspace.meet.smartNote.v2.fileGenerated").
  const ceType = body.message?.attributes?.["ce-type"];
  if (!ceType) {
    return NextResponse.json({ ok: true, skipped: "no_ce_type" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return NextResponse.json({ ok: true, skipped: "invalid_json" });
  }

  const parsed = parseWorkspaceEventPayload(payload, ceType);
  if (!parsed) {
    return NextResponse.json({ ok: true, skipped: "unrecognized_event" });
  }

  const admin = createAdminClient();

  if (parsed.kind === "smart_notes_generation") {
    // 실제 페이로드에는 meetingCode가 없다 — conferenceRecordName으로 Meet API를 추가
    // 조회해야 얻을 수 있는데, meetingCode를 알기 전까지는 어느 선생님 소유 회의인지
    // 몰라 그 선생님 subject로 조회할 수 없다(닭-달걀 문제). **(2026-09-03 Sandbox
    // 실측으로 확정)** 도메인 위임 관리자(GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL)를
    // subject로 조회하면 조직 내 임의 회의의 conferenceRecord/smartNote를 문제 없이
    // 읽을 수 있다(실측: meetingCode·driveFileId 둘 다 정확히 resolve됨) — 이 admin
    // subject가 그 회의의 실제 참석자가 아니어도 works, 즉 Meet API readonly scope는
    // 도메인 관리자에게 조직 전체 조회 권한을 준다. 그래도 admin 계정 설정이 바뀌거나
    // 권한이 회수되면 이 조회는 실패할 수 있으므로 실패 시 unlinked 이벤트로 안전하게
    // 저장한다(웹훅 자체는 실패시키지 않음).
    const adminSubject = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
    let meetingCode: string | null = null;
    let driveFileId: string | null = null;
    if (adminSubject && parsed.conferenceRecordName) {
      try {
        meetingCode = await resolveMeetingCodeFromConferenceRecord({
          teacherWorkspaceEmail: adminSubject,
          conferenceRecordName: parsed.conferenceRecordName,
        });
      } catch (e) {
        console.error(JSON.stringify({ type: "smart_notes_meeting_code_resolve_failed", error: e instanceof Error ? e.message : String(e) }));
      }
    }
    if (adminSubject && parsed.smartNoteResourceName) {
      try {
        driveFileId = await fetchSmartNoteDriveFileId({
          teacherWorkspaceEmail: adminSubject,
          smartNoteResourceName: parsed.smartNoteResourceName,
        });
      } catch (e) {
        console.error(JSON.stringify({ type: "smart_notes_drive_file_resolve_failed", error: e instanceof Error ? e.message : String(e) }));
      }
    }

    const resolved = await resolveReservationByMeetingCode(admin, meetingCode);
    const sessionId = resolved?.sessionId ?? null;
    const { error } = await admin.from("smart_notes_generation_events").insert({
      session_id: sessionId,
      google_meeting_code: meetingCode,
      google_conference_record_name: parsed.conferenceRecordName,
      drive_file_id: driveFileId,
      event_type: parsed.eventType,
      linked: sessionId !== null,
      raw_payload: payload as object,
    });
    if (error) {
      console.error(JSON.stringify({ type: "smart_notes_event_insert_failed", error: error.message }));
      // 큐잉 실패는 웹훅 자체를 실패시키지 않는다(R3 drive-artifacts 관례와 동일) —
      // Pub/Sub가 재시도하게 두되, ack는 정상 반환해 무한 재전송을 막는다.
      return NextResponse.json({ ok: true, warning: "insert_failed" });
    }
    if (sessionId && driveFileId) {
      await admin.from("sessions").update({ smart_notes_drive_file_id: driveFileId }).eq("id", sessionId);
    }
    return NextResponse.json({ ok: true });
  }

  // participant_session — Meet 참가 기록. ALTON 접속 기록과 source로 분리해 저장하고,
  // 출석·수업권·정산을 자동 확정하지 않는다(스펙 원문). 위 smart_notes_generation과 같은
  // 이유로 meetingCode가 payload에 없어 관리자 subject로 conferenceRecord를 조회해
  // 채운다(위 실측 확정 사항과 동일한 근거).
  let participantMeetingCode = parsed.meetingCode;
  const adminSubjectForParticipant = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
  if (!participantMeetingCode && adminSubjectForParticipant && parsed.conferenceRecordName) {
    try {
      participantMeetingCode = await resolveMeetingCodeFromConferenceRecord({
        teacherWorkspaceEmail: adminSubjectForParticipant,
        conferenceRecordName: parsed.conferenceRecordName,
      });
    } catch (e) {
      console.error(JSON.stringify({ type: "participant_meeting_code_resolve_failed", error: e instanceof Error ? e.message : String(e) }));
    }
  }
  const resolved = await resolveReservationByMeetingCode(admin, participantMeetingCode);
  const sessionId = resolved?.sessionId ?? null;
  if (!sessionId) {
    // session_access_events.session_id는 not null(5/N 스키마) — 매칭되는 세션을 못 찾은
    // 이벤트는 조용히 버리는 대신 로그로 남긴다(관리자 재처리 화면 확장 시 이 로그를
    // 소스로 쓸 수 있다). 스키마를 nullable로 바꾸지 않는다 — 5/N이 확정한 제약을
    // 이 웹훅 하나 때문에 약화시키지 않는다.
    console.error(
      JSON.stringify({ type: "meet_participant_event_unresolved_session", meetingCode: participantMeetingCode, eventType: parsed.eventType })
    );
    return NextResponse.json({ ok: true, warning: "session_not_found" });
  }

  const { error } = await admin.from("session_access_events").insert({
    session_id: sessionId,
    actor_id: null, // profileEmail만으로는 profiles.id를 신뢰성 있게 매핑할 수 없어 비워둔다 — Sandbox 검증 단계에서 email→profile 매핑 정책 확정.
    source: "google_meet_api",
    event_type: parsed.eventType === "joined" ? "meet_join" : "meet_leave",
    occurred_at: parsed.occurredAt,
    raw_payload: payload as object,
  });
  if (error) {
    console.error(JSON.stringify({ type: "meet_participant_event_insert_failed", error: error.message }));
    return NextResponse.json({ ok: true, warning: "insert_failed" });
  }
  return NextResponse.json({ ok: true });
}
