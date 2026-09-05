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
const dedupMaybeSingleMock = vi.fn();
const smartNotesInsertMock = vi.fn();
const sessionsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const consultationsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const accessEventsInsertMock = vi.fn();
const subscriptionMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });

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
  if (table === "smart_notes_generation_events") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: dedupMaybeSingleMock }) }),
      insert: (payload: unknown) => smartNotesInsertMock(payload),
    };
  }
  if (table === "sessions") {
    return { update: (payload: unknown) => ({ eq: (...args: unknown[]) => sessionsUpdateEqMock(payload, ...args) }) };
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
  createAdminClient: () => ({ from: fromMock }),
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
  dedupMaybeSingleMock.mockResolvedValue({ data: null });
  resolveMeetingCodeMock.mockResolvedValue("abc-defg-hij");
  fetchDriveFileIdMock.mockResolvedValue("drive-file-1");
  smartNotesInsertMock.mockResolvedValue({ error: null });
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
    expect(smartNotesInsertMock).not.toHaveBeenCalled();
  });

  it("모르는 ce-type은 200으로 ack하고 아무것도 쓰지 않는다", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}, "google.workspace.calendar.event.v3.updated") as never);
    expect(res.status).toBe(200);
    expect(smartNotesInsertMock).not.toHaveBeenCalled();
    expect(accessEventsInsertMock).not.toHaveBeenCalled();
  });

  it("Smart Notes 생성 이벤트: 관리자 subject로 meetingCode/driveFileId를 조회해 세션에 연결하고 sessions.smart_notes_drive_file_id를 갱신한다", async () => {
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
    expect(smartNotesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", google_meeting_code: "abc-defg-hij", drive_file_id: "drive-file-1", linked: true })
    );
    expect(sessionsUpdateEqMock).toHaveBeenCalledWith(
      { smart_notes_drive_file_id: "drive-file-1", smart_notes_status: "completed" },
      "id",
      "s1"
    );
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
    expect(smartNotesInsertMock).toHaveBeenCalledWith(expect.objectContaining({ session_id: null, linked: false }));
    expect(sessionsUpdateEqMock).not.toHaveBeenCalled();
  });

  it("meetingCode 조회가 실패해도(admin 권한 회수 등) 웹훅은 200으로 ack하고 unlinked로 기록한다", async () => {
    resolveMeetingCodeMock.mockRejectedValue(new Error("Meet API 요청 실패 (status 403)"));
    fetchDriveFileIdMock.mockRejectedValue(new Error("Meet API 요청 실패 (status 403)"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never);
    expect(res.status).toBe(200);
    expect(smartNotesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ google_meeting_code: null, drive_file_id: null, session_id: null, linked: false })
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

  // M1 요구사항 4 — Smart Notes 원본을 상담(consultations)에도 자동 연결.
  it("세션 매칭이 안 되면 consultation_id로 매칭을 시도하고, 매칭되면 consultations.smart_notes_drive_file_id를 갱신한다", async () => {
    reservationMaybeSingleMock.mockResolvedValue({ data: null });
    consultationMaybeSingleMock.mockResolvedValue({ data: { id: "consult-1" } });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(smartNotesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: null, consultation_id: "consult-1", drive_file_id: "drive-file-1", linked: true })
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
    expect(smartNotesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: null, consultation_id: null, linked: false })
    );
  });

  it("동일 Pub/Sub messageId 재전송은 중복 삽입하지 않고 200으로 ack한다(멱등)", async () => {
    dedupMaybeSingleMock.mockResolvedValue({ data: { id: "existing-event" } });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ smartNote: { name: "conferenceRecords/abc/smartNotes/note1" } }, SMART_NOTE_TYPE) as never
    );
    expect(res.status).toBe(200);
    expect(smartNotesInsertMock).not.toHaveBeenCalled();
  });
});
