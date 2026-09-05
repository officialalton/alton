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

// Meet API readonly는 Directory API와 달리 도메인 관리자에게 조직 전체 열람권을
// 주지 않는다(실측 확인, 2026-09-05) — 그 회의의 실제 organizer를 subject로 써야
// 403을 피할 수 있다. ce-subject(구독의 targetResource, `.../users/{id}`)를
// workspace_events_subscriptions.organizer_workspace_user_id로 역매핑해 실제
// organizer 이메일을 찾는다. 매핑을 못 찾으면 예전처럼 admin으로 폴백만 시도한다.
// Smart Notes 이벤트뿐 아니라 참가자 join/leave 이벤트도 같은 Meet API를 호출하므로
// (planner 지적, 2026-09-05) 공통 헬퍼로 뺐다 — 한쪽만 고치고 잊는 사고를 막기 위함.
async function resolveOrganizerSubjectFromCeSubject(
  admin: ReturnType<typeof createAdminClient>,
  ceSubject: string | undefined
): Promise<string | null> {
  const fallback = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL ?? null;
  const organizerUserId = ceSubject?.match(/\/users\/([^/]+)$/)?.[1] ?? null;
  if (!organizerUserId) return fallback;
  const { data: subRow } = await admin
    .from("workspace_events_subscriptions")
    .select("organizer_email")
    .eq("organizer_workspace_user_id", organizerUserId)
    .maybeSingle();
  return subRow?.organizer_email ?? fallback;
}

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

// M1 요구사항 4(2026-09-03 추가) — Smart Notes 생성 이벤트를 상담(consultations)에도 자동
// 연결한다. 새 웹훅을 만들지 않고 이 기존 R6 라우트의 매칭 대상만 넓힌다.
async function resolveConsultationByMeetingCode(
  admin: ReturnType<typeof createAdminClient>,
  meetingCode: string | null
): Promise<{ consultationId: string } | null> {
  if (!meetingCode) return null;
  const { data } = await admin
    .from("consultations")
    .select("id")
    .eq("google_meeting_code", meetingCode)
    .maybeSingle();
  return data ? { consultationId: data.id } : null;
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
  const pubsubMessageId = body.message?.messageId ?? null;

  if (parsed.kind === "smart_notes_generation") {
    // 재처리 가능한 상태 머신(2026-09-05 코드 점검 반영) — 이전에는 같은
    // pubsub_message_id의 행이 "존재하기만 하면" 무조건 재처리를 건너뛰었다.
    // 그 행이 linked=false(세션/상담을 못 찾음)나 drive_file_id가 없는(원본을
    // 아직 못 찾음) 미완료 상태로 남아있으면, Pub/Sub의 at-least-once 재전송이
    // 도착해도 영원히 다시 시도되지 않는 실제 유실 경로였다 — 완료된 행만
    // 건너뛰고, 미완료 행은 같은 행을 upsert로 갱신하며 아래 해석 로직을 다시
    // 돈다(멱등 — 몇 번을 다시 돌아도 결과가 같다).
    if (pubsubMessageId) {
      const { data: existing } = await admin
        .from("smart_notes_generation_events")
        .select("id, linked, drive_file_id")
        .eq("pubsub_message_id", pubsubMessageId)
        .maybeSingle();
      if (existing?.linked && existing?.drive_file_id) {
        return NextResponse.json({ ok: true, skipped: "duplicate_message_already_complete" });
      }
    }
    // 실제 페이로드에는 meetingCode가 없다 — conferenceRecordName으로 Meet API를 추가
    // 조회해야 얻을 수 있는데, meetingCode를 알기 전까지는 어느 선생님 소유 회의인지
    // 몰라 그 선생님 subject로 조회할 수 없다(닭-달걀 문제)... 였는데, CloudEvents
    // 봉투의 `ce-subject` 속성이 바로 이 구독의 targetResource
    // (`//cloudidentity.googleapis.com/users/{organizer_workspace_user_id}`)를 그대로
    // 실어온다 — meetingCode를 몰라도 "이 이벤트가 어느 구독(=어느 조직원)의
    // Meet space에서 왔는지"는 이미 알 수 있다.
    //
    // **정정(2026-09-05 실사용 발견)**: 원래는 도메인 위임 관리자(GOOGLE_WORKSPACE_
    // DELEGATED_ADMIN_EMAIL)를 고정 subject로 다른 사람이 만든 회의까지 조회했는데,
    // 관리자 본인이 만든 회의(어제 상담 테스트)에서만 우연히 통과했을 뿐 실제로는
    // 403(PERMISSION_DENIED)이 난다 — Directory API와 달리 Meet API readonly는
    // 도메인 관리자에게 조직 전체 열람권을 주지 않는다(실측 확인: 선생님이 직접 만든
    // 실제 수업에서 403). 그 회의의 실제 organizer(위 ce-subject로 알아낸 사람)를
    // subject로 써야 한다 — 매핑을 못 찾으면 예전처럼 admin으로 폴백만 시도한다.
    const adminSubject = await resolveOrganizerSubjectFromCeSubject(admin, body.message?.attributes?.["ce-subject"]);
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
    // 세션(정규수업)으로 매칭되지 않으면 상담(consultation)도 시도한다 — 같은
    // meetingCode가 세션과 상담 양쪽에 동시에 걸릴 일은 없다(서로 다른 Calendar
    // 이벤트에서 나온 별개의 Meet space이므로).
    const resolvedConsultation = sessionId ? null : await resolveConsultationByMeetingCode(admin, meetingCode);
    const consultationId = resolvedConsultation?.consultationId ?? null;

    const { error } = await admin.from("smart_notes_generation_events").upsert(
      {
        session_id: sessionId,
        consultation_id: consultationId,
        google_meeting_code: meetingCode,
        google_conference_record_name: parsed.conferenceRecordName,
        drive_file_id: driveFileId,
        event_type: parsed.eventType,
        linked: sessionId !== null || consultationId !== null,
        raw_payload: payload as object,
        pubsub_message_id: pubsubMessageId,
      },
      { onConflict: "pubsub_message_id" }
    );
    if (error) {
      console.error(JSON.stringify({ type: "smart_notes_event_insert_failed", error: error.message }));
      // 이전에는 DB 반영 실패를 200으로 ack해 Pub/Sub 재시도를 스스로 꺼버렸다
      // (주석은 "재시도하게 둔다"고 했지만 실제 응답은 200이라 모순이었다 —
      // 2026-09-05 코드 점검 발견). DB에 아예 못 남긴 실패는 진짜 인프라 문제이니
      // 500으로 되돌려 Pub/Sub가 실제로 재전송하게 한다. 매칭 실패(session/
      // consultation 둘 다 null)는 이것과 다르다 — 그건 DB에 linked=false로 정상
      // 기록됐으므로 아래에서 여전히 200으로 ack한다(관리자 재처리 대상으로만 남김).
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    if (sessionId && driveFileId) {
      // smart_notes_status(문서 생성·연결 파이프라인 상태, 20261008000000 주석 참고)는
      // 지금까지 이 컬럼을 실제로 갱신하는 코드가 어디에도 없어서(관리자 파이프라인
      // 화면이 참조하는 값이 항상 유효하지 않은 문자열이었다 — 2026-09-05 실사용
      // 발견) 원본이 실제로 연결돼도 "Smart Notes 연결" 단계가 영원히 완료로 안 잡혔다.
      // drive_file_id를 확보한 시점이 이 파이프라인의 완료 시점이다.
      //
      // 원본 식별자(drive_file_id) 자체는 sessions가 아니라 session_smart_notes에
      // 저장한다(20261025000000) — sessions는 학생·보호자도 select 가능한 행
      // 정책이라 원본을 학생·보호자에게 직접 노출하지 않는다는 정책(docs/CURRENT.md)을
      // 어기고 있었다. sessions에는 상태 문자열만 남긴다.
      await admin.from("sessions").update({ smart_notes_status: "completed" }).eq("id", sessionId);
      await admin
        .from("session_smart_notes")
        .upsert({ session_id: sessionId, drive_file_id: driveFileId }, { onConflict: "session_id" });
    }
    if (consultationId && driveFileId) {
      // 잠재고객에게 원본을 자동 공개하지 않는다(요구사항 4) — 이 컬럼은 관리자 전용
      // 경로에서만 노출된다(app/admin/consultation-scheduling-actions.ts, RLS는
      // consultations 자체가 이미 관리자 전용 select 정책).
      await admin.from("consultations").update({ smart_notes_drive_file_id: driveFileId }).eq("id", consultationId);
    }
    return NextResponse.json({ ok: true });
  }

  // participant_session — Meet 참가 기록. ALTON 접속 기록과 source로 분리해 저장하고,
  // 출석·수업권·정산을 자동 확정하지 않는다(스펙 원문). 위 smart_notes_generation과 같은
  // 이유로 meetingCode가 payload에 없어 실제 organizer subject로 conferenceRecord를
  // 조회해 채운다 — 이전에는 고정 관리자 subject를 썼는데, 이는 관리자 본인이 만든
  // 회의에서만 우연히 통과했을 뿐 실제 선생님이 만든 회의에서는 403이 났다(Smart
  // Notes 쪽에서 이미 발견·수정한 것과 완전히 같은 버그, 2026-09-05 재확인).
  let participantMeetingCode = parsed.meetingCode;
  const adminSubjectForParticipant = await resolveOrganizerSubjectFromCeSubject(
    admin,
    body.message?.attributes?.["ce-subject"]
  );
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
    // smart_notes_generation과 같은 이유로 500을 반환한다 — DB 반영 실패를 200으로
    // ack하면 Pub/Sub 재전송이 스스로 막힌다(2026-09-05 코드 점검 발견·수정).
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
