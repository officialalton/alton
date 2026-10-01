import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(...args: unknown[]) {
      return verifyIdTokenMock(...args);
    }
  },
}));

const resolveMeetingCodeMock = vi.fn();
const fetchDriveFileIdMock = vi.fn();
vi.mock("@/lib/google-meet", () => ({
  resolveMeetingCodeFromConferenceRecord: (...args: unknown[]) => resolveMeetingCodeMock(...args),
  fetchSmartNoteDriveFileId: (...args: unknown[]) => fetchDriveFileIdMock(...args),
}));

const reservationMaybeSingleMock = vi.fn();
const teacherMaybeSingleMock = vi.fn();
const consultationMaybeSingleMock = vi.fn();
const sessionsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const sessionSmartNotesUpsertMock = vi.fn().mockResolvedValue({ error: null });
const consultationsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const accessEventsInsertMock = vi.fn();
const subscriptionMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });
const sessionMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });
const resolveVerifiedStudentEmailMock = vi.fn().mockResolvedValue("student@example.com");

// 2026-09-18(제품 오너 지시) — smart_notes_generation_events 클레임과
// session_drive_tasks(smart_notes_reader_grant) enqueue는 이제 원자적 SECURITY
// DEFINER 함수(claim_smart_notes_generation_event/enqueue_smart_notes_reader_grant_task,
// supabase/migrations/20261414000000)를 admin.rpc()로 호출한다 — 이 두 함수의
// 실제 원자성·동시성 안전성은 mock으로 재현할 수 없으므로 여기서는 "route.ts가
// 이 함수들을 올바른 인자로 호출하는지"만 검증한다. 실제 DB 제약·경합 검증은
// route.idempotency.integration.test.ts(실제 Postgres)의 역할이다.
const claimSmartNotesEventRpcMock = vi.fn().mockResolvedValue({ data: "event-1", error: null });
const enqueueDriveGrantRpcMock = vi.fn().mockResolvedValue({ data: "task-1", error: null });
const rpcMock = vi.fn((fn: string, args: unknown) => {
  if (fn === "claim_smart_notes_generation_event") return claimSmartNotesEventRpcMock(args);
  if (fn === "enqueue_smart_notes_reader_grant_task") return enqueueDriveGrantRpcMock(args);
  throw new Error(`unexpected rpc ${fn}`);
});

vi.mock("@/lib/booking/calendar-sync", () => ({
  resolveVerifiedStudentEmail: (...args: unknown[]) => resolveVerifiedStudentEmailMock(...args),
}));

const fromMock = vi.fn((table: string) => {
  if (table === "reservations") {
    return { select: () => ({ eq: () => ({ maybeSingle: reservationMaybeSingleMock }) }) };
  }
  if (table === "teachers") {
    return { select: () => ({ eq: () => ({ maybeSingle: teacherMaybeSingleMock }) }) };
  }
  if (table === "consultations") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: consultationMaybeSingleMock }) }),
      update: () => ({ eq: consultationsUpdateEqMock }),
    };
  }
  if (table === "sessions") {
    return {
      update: (payload: unknown) => ({ eq: (...args: unknown[]) => sessionsUpdateEqMock(payload, ...args) }),
      select: () => ({ eq: () => ({ maybeSingle: sessionMaybeSingleMock }) }),
    };
  }
  if (table === "session_smart_notes") {
    return { upsert: (payload: unknown, opts: unknown) => sessionSmartNotesUpsertMock(payload, opts) };
  }
  if (table === "session_access_events") {
    return { insert: (payload: unknown) => accessEventsInsertMock(payload) };
  }
  if (table === "workspace_events_subscriptions") {
    return { select: () => ({ eq: () => ({ maybeSingle: subscriptionMaybeSingleMock }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

function makeRequest(
  payload: unknown,
  ceType: string | undefined,
  authHeader = "Bearer valid-token",
  extraAttributes?: Record<string, string>
) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const attributes = ceType ? { "ce-type": ceType, ...extraAttributes } : undefined;
  return new Request("http://localhost/api/webhooks/workspace-events", {
    method: "POST",
    headers: { authorization: authHeader },
    body: JSON.stringify({ message: { data, attributes, messageId: "msg-1" } }),
  });
}

const SMART_NOTE_TYPE = "google.workspace.meet.smartNote.v2.fileGenerated";
const PARTICIPANT_JOINED_TYPE = "google.workspace.meet.participant.v2.joined";
const PARTICIPANT_LEFT_TYPE = "google.workspace.meet.participant.v2.left";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WORKSPACE_EVENTS_PUSH_AUDIENCE = "https://alton.example/api/webhooks/workspace-events";
  process.env.WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL = "pubsub-push@alton-integration-sandbox.iam.gserviceaccount.com";
  process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL = "official@alton.education";
  verifyIdTokenMock.mockResolvedValue({
    getPayload: () => ({ email: "pubsub-push@alton-integration-sandbox.iam.gserviceaccount.com", email_verified: true }),
  });
  reservationMaybeSingleMock.mockResolvedValue({ data: { id: "r1", owner_profile_id: "t1", session: { id: "s1" } } });
  teacherMaybeSingleMock.mockResolvedValue({ data: { workspace_email: "teacher1@alton.education" } });
  consultationMaybeSingleMock.mockResolvedValue({ data: null });
  resolveMeetingCodeMock.mockResolvedValue("abc-defg-hij");
  fetchDriveFileIdMock.mockResolvedValue("drive-file-1");
  claimSmartNotesEventRpcMock.mockResolvedValue({ data: "event-1", error: null });
  enqueueDriveGrantRpcMock.mockResolvedValue({ data: "task-1", error: null });
  accessEventsInsertMock.mockResolvedValue({ error: null });
});

describe("POST /api/webhooks/workspace-events", () => {
  it("Authorization 헤더가 없으면 401(fail-closed)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}, SMART_NOTE_TYPE, "") as never);
    expect(res.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("토큰 발급자가 다르면 401", async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({ email: "someone-else@example.com", email_verified: true }) });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}, SMART_NOTE_TYPE) as never);
    expect(res.status).toBe(401);
  });

  it("필수 env가 없으면 401", async () => {
    delete process.env.WORKSPACE_EVENTS_PUSH_AUDIENCE;
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}, SMART_NOTE_TYPE) as never);
    expect(res.status).toBe(401);
  });

  it("ce-type 속성이 없으면 200으로 ack하고 아무것도 쓰지 않는다", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}, undefined) as never);
    expect(res.status).toBe(200);
    expect(claimSmartNotesEventRpcMock).not.toHaveBeenCalled();
  });

  it("모르는 ce-type은 200으로 ack하고 아무것도 쓰지 않는다", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}, "google.workspace.calendar.event.v3.updated") as never);
    expect(res.status).toBe(200);
    expect(claimSmartNotesEventRpcMock).not.toHaveBeenCalled();
    expect(accessEventsInsertMock).not.toHaveBeenCalled();
  });

  it("Smart Notes 생성 이벤트: 관리자 subject로 meetingCode/driveFileId를 조회해 세션에 연결하고 session_smart_notes에 원본 식별자를 저장한다(sessions에는 상태만)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest(
        { smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } },
        SMART_NOTE_TYPE
      ) as never
    );
    expect(res.status).toBe(200);
    expect(resolveMeetingCodeMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "official@alton.education",
      conferenceRecordName: "conferenceRecords/abc",
    });
    expect(fetchDriveFileIdMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "official@alton.education",
      smartNoteResourceName: "conferenceRecords/abc/smartNotes/note1",
    });
    expect(claimSmartNotesEventRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_session_id: "s1", p_google_meeting_code: "abc-defg-hij", p_drive_file_id: "drive-file-1", p_linked: true })
    );
    expect(sessionsUpdateEqMock).toHaveBeenCalledWith({ smart_notes_status: "completed" }, "id", "s1");
    expect(sessionSmartNotesUpsertMock).toHaveBeenCalledWith(
      { session_id: "s1", drive_file_id: "drive-file-1" },
      { onConflict: "session_id" }
    );
  });

  it("정규 수업(sessions)에 연결되면 학생 열람 권한 부여 작업을 큐에 넣는다(첫 상담은 별개 분기)", async () => {
    sessionMaybeSingleMock.mockResolvedValueOnce({ data: { subject_enrollment_id: "se1" } });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(resolveVerifiedStudentEmailMock).toHaveBeenCalledWith(expect.anything(), "se1");
    expect(enqueueDriveGrantRpcMock).toHaveBeenCalledWith({
      p_session_id: "s1",
      p_drive_file_id: "drive-file-1",
      p_student_email: "student@example.com",
    });
  });

  it("학생 이메일이 아직 검증되지 않았으면 큐에 넣지 않고도 웹훅은 200으로 끝난다(관리자 조치 대상일 뿐 웹훅 실패 아님)", async () => {
    sessionMaybeSingleMock.mockResolvedValueOnce({ data: { subject_enrollment_id: "se1" } });
    resolveVerifiedStudentEmailMock.mockRejectedValueOnce(new Error("학생 계정 이메일이 아직 검증되지 않았습니다."));
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(enqueueDriveGrantRpcMock).not.toHaveBeenCalled();
  });

  it("ce-subject가 등록된 선생님 구독과 일치하면 admin이 아니라 그 선생님을 subject로 조회한다(실사용 403 버그 수정)", async () => {
    subscriptionMaybeSingleMock.mockResolvedValueOnce({ data: { organizer_email: "teacher1@alton.education" } });
    const { POST } = await import("./route");
    await POST(
      makeRequest(
        { smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } },
        SMART_NOTE_TYPE,
        "Bearer valid-token",
        { "ce-subject": "//cloudidentity.googleapis.com/users/111507678677650332821" }
      ) as never
    );
    expect(resolveMeetingCodeMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "teacher1@alton.education",
      conferenceRecordName: "conferenceRecords/abc",
    });
    expect(fetchDriveFileIdMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "teacher1@alton.education",
      smartNoteResourceName: "conferenceRecords/abc/smartNotes/note1",
    });
  });

  it("세션을 찾지 못하면 linked=false로 기록하고 sessions는 갱신하지 않는다", async () => {
    reservationMaybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await import("./route");
    await POST(makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never);
    expect(claimSmartNotesEventRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_session_id: null, p_linked: false })
    );
    expect(sessionsUpdateEqMock).not.toHaveBeenCalled();
  });

  it("meetingCode 조회가 실패해도(admin 권한 회수 등) 웹훅은 200으로 ack하고 unlinked로 기록한다", async () => {
    resolveMeetingCodeMock.mockRejectedValue(new Error("Meet API 요청 실패 (status 403)"));
    fetchDriveFileIdMock.mockRejectedValue(new Error("Meet API 요청 실패 (status 403)"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never);
    expect(res.status).toBe(200);
    expect(claimSmartNotesEventRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_google_meeting_code: null, p_drive_file_id: null, p_session_id: null, p_linked: false })
    );
    errorSpy.mockRestore();
  });

  it("참가자 join 이벤트를 session_access_events에 source=google_meet_api로 기록한다", async () => {
    const { POST } = await import("./route");
    await POST(
      makeRequest(
        { participant: { name: "conferenceRecords/abc/participants/p1", signedinUser: { user: "users/teacher1" } }, eventTime: "2026-10-10T19:05:00Z" },
        PARTICIPANT_JOINED_TYPE
      ) as never
    );
    expect(accessEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", source: "google_meet_api", event_type: "meet_join", occurred_at: "2026-10-10T19:05:00Z" })
    );
  });

  it("참가자 이벤트도 ce-subject가 등록된 선생님 구독과 일치하면 admin이 아니라 그 선생님을 subject로 조회한다(Smart Notes와 동일 403 버그가 이쪽에도 있었음)", async () => {
    subscriptionMaybeSingleMock.mockResolvedValueOnce({ data: { organizer_email: "teacher1@alton.education" } });
    const { POST } = await import("./route");
    await POST(
      makeRequest(
        { participant: { name: "conferenceRecords/abc/participants/p1", signedinUser: { user: "users/teacher1" } }, eventTime: "2026-10-10T19:05:00Z" },
        PARTICIPANT_JOINED_TYPE,
        "Bearer valid-token",
        { "ce-subject": "//cloudidentity.googleapis.com/users/111507678677650332821" }
      ) as never
    );
    expect(resolveMeetingCodeMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "teacher1@alton.education",
      conferenceRecordName: "conferenceRecords/abc",
    });
  });

  it("참가자 이벤트가 세션을 못 찾으면 조용히 버리지 않고 로그만 남기고 200으로 ack한다", async () => {
    reservationMaybeSingleMock.mockResolvedValue({ data: null });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest(
        { participant: { name: "conferenceRecords/abc/participants/p1" }, eventTime: "2026-10-10T21:00:00Z" },
        PARTICIPANT_LEFT_TYPE
      ) as never
    );
    expect(res.status).toBe(200);
    expect(accessEventsInsertMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("meet_participant_event_unresolved_session"));
    errorSpy.mockRestore();
  });

  it("참가자 이벤트 DB 반영이 실패하면 200이 아니라 500을 반환해 Pub/Sub가 재전송하게 한다(2026-09-05 수정)", async () => {
    accessEventsInsertMock.mockResolvedValue({ error: { message: "connection reset" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest(
        { participant: { name: "conferenceRecords/abc/participants/p1", signedinUser: { user: "users/teacher1" } }, eventTime: "2026-10-10T19:05:00Z" },
        PARTICIPANT_JOINED_TYPE
      ) as never
    );
    expect(res.status).toBe(500);
    errorSpy.mockRestore();
  });

  // M1 요구사항 4 — Smart Notes 원본을 상담(consultations)에도 자동 연결.
  it("세션 매칭이 안 되면 consultation_id로 매칭을 시도하고, 매칭되면 consultations.smart_notes_drive_file_id를 갱신한다", async () => {
    reservationMaybeSingleMock.mockResolvedValue({ data: null });
    consultationMaybeSingleMock.mockResolvedValue({ data: { id: "consult-1" } });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(claimSmartNotesEventRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_session_id: null, p_consultation_id: "consult-1", p_drive_file_id: "drive-file-1", p_linked: true })
    );
    expect(consultationsUpdateEqMock).toHaveBeenCalled();
  });

  it("세션도 상담도 매칭 안 되면 유실시키지 않고 linked=false로 보존한다(관리자 재처리 대상)", async () => {
    reservationMaybeSingleMock.mockResolvedValue({ data: null });
    consultationMaybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(claimSmartNotesEventRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_session_id: null, p_consultation_id: null, p_linked: false })
    );
  });

  // 2026-09-18(제품 오너 지시) — 이전 "select 존재 여부로 건너뛰기" 방식은 동시
  // 배달 경합에 안전하지 않았다. claim_smart_notes_generation_event()가 원자적
  // INSERT ... ON CONFLICT DO NOTHING RETURNING으로 대체됐고, 반환값이 null이면
  // "이미 다른 요청이 먼저 클레임했다"는 뜻이다 — 그 원자성 자체는 mock으로
  // 검증할 수 없으므로(route.idempotency.integration.test.ts가 실제 Postgres로
  // 검증한다), 여기서는 route.ts가 null 반환을 올바르게 skip으로 처리하는지만
  // 확인한다. "미완료(linked=false) 행은 재시도"라는 이전 동작은 의도적으로
  // 제거됐다(재처리는 reconcileMissedSmartNotesEvents 배치가 담당) — 동시 배달
  // 경합을 막으려면 "이미 클레임된 메시지는 완결 여부와 무관하게 무조건 skip"
  // 이어야 한다.
  it("claim이 null을 반환하면(동시 배달 경합에서 짐, 또는 순차 재전송 중복) 이후 작업 없이 200으로 ack한다", async () => {
    claimSmartNotesEventRpcMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(sessionsUpdateEqMock).not.toHaveBeenCalled();
    expect(enqueueDriveGrantRpcMock).not.toHaveBeenCalled();
  });

  it("claim 함수 호출 자체가 실패하면 200이 아니라 500을 반환해 Pub/Sub가 실제로 재전송하게 한다", async () => {
    claimSmartNotesEventRpcMock.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(500);
    errorSpy.mockRestore();
  });
});
