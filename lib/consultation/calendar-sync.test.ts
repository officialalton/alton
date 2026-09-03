import { beforeEach, describe, expect, it, vi } from "vitest";

// M1 — syncOneConsultationCalendarEvent()의 오케스트레이션 검증. 실제 Calendar/Meet API는
// 모킹한다(R6 lib/booking/calendar-sync.test.ts와 동일한 원칙) — 여기서는 이번 보완
// 지시사항(9개 항목) 3번(Smart Notes 실패가 이메일을 막지 않음)·6번(이메일 중복 발송 방지)의
// 실제 오케스트레이션 로직만 검증한다.

const createCalendarEventWithMeetMock = vi.fn();
const patchCalendarEventTimeMock = vi.fn();
const deleteCalendarEventMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  createCalendarEventWithMeet: (p: unknown) => createCalendarEventWithMeetMock(p),
  patchCalendarEventTime: (p: unknown) => patchCalendarEventTimeMock(p),
  deleteCalendarEvent: (p: unknown) => deleteCalendarEventMock(p),
}));

const ensureMeetSpaceSmartNotesOnMock = vi.fn();
vi.mock("@/lib/google-meet", () => ({
  extractMeetingCodeFromLink: (link: string) => {
    const m = link.match(/meet\.google\.com\/([a-z-]+)/);
    return m ? m[1] : null;
  },
  ensureMeetSpaceSmartNotesOn: (p: unknown) => ensureMeetSpaceSmartNotesOnMock(p),
}));

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({ sendEmail: (p: unknown) => sendEmailMock(p) }));

vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: async () => "https://app.alton.education" }));

let consultationRow: Record<string, unknown> | null = null;
const consultationsUpdatePayloads: Array<Record<string, unknown>> = [];
const consultationsUpdateFinal = vi.fn().mockResolvedValue({ error: null });
const issueTokenMock = vi.fn().mockResolvedValue({ error: null });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromMock = vi.fn((table: string): any => {
  if (table === "consultations") return buildConsultationsTable();
  if (table === "consult_consent_versions") {
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "consent-1", title: "v0" }, error: null }) }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: fromMock,
    rpc: (fn: string) => {
      if (fn === "issue_consult_consent_token") return issueTokenMock();
      throw new Error(`unexpected rpc ${fn}`);
    },
  }),
}));

// consultations 테이블 더블: claim(update+eq+in+select) 체인과 최종 단순 update(...).eq(id)
// 체인 둘 다 이 update()가 만드는 객체로 커버한다(둘 다 .eq() 다음 단계가 다르지만, 이
// 테스트에서는 claim 이후의 단순 update 결과값을 실제로 검사하지 않으므로 최소 구현으로 충분).
function buildConsultationsTable() {
  return {
    update: (payload: Record<string, unknown>) => {
      consultationsUpdatePayloads.push(payload);
      return {
        eq: () => ({
          in: () => ({
            select: () => ({ maybeSingle: async () => ({ data: consultationRow, error: null }) }),
          }),
        }),
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  consultationsUpdatePayloads.length = 0;
  consultationRow = {
    id: "consult-1",
    contact_name: "김민지",
    contact_email: "minji@example.com",
    starts_at: "2026-10-01T09:00:00.000Z",
    ends_at: "2026-10-01T10:00:00.000Z",
    google_event_id: null,
    google_meet_link: null,
    google_sync_status: "pending",
    google_sync_retry_count: 0,
    consent_version_id: "consent-1",
    confirmation_email_content_hash: null,
  };
  createCalendarEventWithMeetMock.mockResolvedValue({ googleEventId: "evt-1", meetLink: "https://meet.google.com/abc-defg-hij" });
  issueTokenMock.mockResolvedValue({ error: null });
});

describe("Calendar 네이티브 초대(2026-09-03 정책 전환 — 요구사항 2·6)", () => {
  it("최초 확정 시 attendeeEmail·sendUpdates=all로 Calendar 이벤트를 만들고, 성공하면 커스텀 이메일은 보내지 않는다", async () => {
    ensureMeetSpaceSmartNotesOnMock.mockResolvedValue(true);
    fromMock.mockImplementation((table: string) => {
      if (table === "consultations") return buildConsultationsTable();
      throw new Error(`unexpected table ${table}`);
    });

    const { syncOneConsultationCalendarEvent } = await import("./calendar-sync");
    await syncOneConsultationCalendarEvent("consult-1");

    expect(createCalendarEventWithMeetMock).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeEmail: "minji@example.com", sendUpdates: "all", description: expect.stringContaining("consent?token=") })
    );
    expect(sendEmailMock).not.toHaveBeenCalled(); // Calendar 네이티브 초대가 성공했으므로 중복 발송 없음
  });

  it("Smart Notes 확인·보정이 실패해도 Calendar 이벤트 생성 자체는 막히지 않는다(요구사항 3 정책)", async () => {
    ensureMeetSpaceSmartNotesOnMock.mockRejectedValue(new Error("Meet API 403"));
    fromMock.mockImplementation((table: string) => {
      if (table === "consultations") return buildConsultationsTable();
      throw new Error(`unexpected table ${table}`);
    });

    const { syncOneConsultationCalendarEvent } = await import("./calendar-sync");
    await syncOneConsultationCalendarEvent("consult-1");

    expect(createCalendarEventWithMeetMock).toHaveBeenCalled();
    const smartNotesFailedUpdate = consultationsUpdatePayloads.find((p) => p.smart_notes_config_status === "failed");
    expect(smartNotesFailedUpdate).toBeTruthy();
  });

  it("시간 변경은 같은 이벤트를 sendUpdates=all로 patch하고, 커스텀 이메일은 추가로 보내지 않는다", async () => {
    ensureMeetSpaceSmartNotesOnMock.mockResolvedValue(true);
    consultationRow!.google_event_id = "evt-existing";
    consultationRow!.google_meet_link = "https://meet.google.com/abc-defg-hij";

    fromMock.mockImplementation((table: string) => {
      if (table === "consultations") return buildConsultationsTable();
      throw new Error(`unexpected table ${table}`);
    });

    const { syncOneConsultationCalendarEvent } = await import("./calendar-sync");
    await syncOneConsultationCalendarEvent("consult-1");

    expect(patchCalendarEventTimeMock).toHaveBeenCalledWith(expect.objectContaining({ sendUpdates: "all" }));
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("Calendar 초대가 재시도 한도까지 반복 실패하면 fallback 커스텀 이메일을 정확히 1통 보낸다", async () => {
    createCalendarEventWithMeetMock.mockRejectedValue(new Error("Calendar API 요청 실패 (status 500)"));
    consultationRow!.google_sync_retry_count = 4; // 다음 실패로 MAX_RETRY_COUNT(5) 도달
    fromMock.mockImplementation((table: string) => {
      if (table === "consultations") return buildConsultationsTable();
      if (table === "consult_consent_versions") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "consent-1", title: "v0" }, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { syncOneConsultationCalendarEvent } = await import("./calendar-sync");
    await syncOneConsultationCalendarEvent("consult-1");

    const reconciliationUpdate = consultationsUpdatePayloads.find((p) => p.google_sync_status === "reconciliation_needed");
    expect(reconciliationUpdate).toBeTruthy();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("같은 실패 fallback 이메일은 재시도해도 중복 발송하지 않는다", async () => {
    createCalendarEventWithMeetMock.mockRejectedValue(new Error("Calendar API 요청 실패 (status 500)"));
    consultationRow!.google_sync_retry_count = 4;
    consultationRow!.confirmation_email_content_hash = "fallback:Calendar API 요청 실패 (status 500)";
    fromMock.mockImplementation((table: string) => {
      if (table === "consultations") return buildConsultationsTable();
      throw new Error(`unexpected table ${table}`);
    });

    const { syncOneConsultationCalendarEvent } = await import("./calendar-sync");
    await syncOneConsultationCalendarEvent("consult-1");

    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

// M1 요구사항 4(2026-09-03 조건부 승인 보완) — Smart Notes 원본 매칭 실패 후 관리자
// "재처리" 경로(reprocessUnlinkedSmartNotesEvents). 실제 원인은 대개 웹훅이 상담의
// google_meeting_code가 저장되기 전에 먼저 도착하는 레이스 — Calendar 동기화가 끝난
// 뒤 재처리하면 성공적으로 연결될 수 있다는 것을 검증한다.
describe("Smart Notes 원본 매칭 실패 후 재처리(요구사항 4)", () => {
  it("이제는 매칭되는 상담이 생겼으면 이벤트를 연결하고 drive_file_id를 반영한다", async () => {
    const unlinkedEvents = [{ id: "evt-1", google_meeting_code: "abc-defg-hij", drive_file_id: "drive-1" }];
    const eventUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const consultationUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "smart_notes_generation_events") {
        return {
          select: () => ({
            eq: () => ({ is: () => ({ is: () => ({ not: () => Promise.resolve({ data: unlinkedEvents }) }) }) }),
          }),
          update: () => ({ eq: eventUpdateEqMock }),
        };
      }
      if (table === "consultations") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "consult-2" }, error: null }) }) }),
          update: () => ({ eq: consultationUpdateEqMock }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { reprocessUnlinkedSmartNotesEvents } = await import("./calendar-sync");
    const result = await reprocessUnlinkedSmartNotesEvents();

    expect(result).toEqual({ relinked: 1, stillUnlinked: 0 });
    expect(eventUpdateEqMock).toHaveBeenCalled();
    expect(consultationUpdateEqMock).toHaveBeenCalled();
  });

  it("여전히 매칭되는 상담이 없으면 유실 없이 stillUnlinked로 남긴다", async () => {
    const unlinkedEvents = [{ id: "evt-2", google_meeting_code: "zzz-zzzz-zzz", drive_file_id: null }];

    fromMock.mockImplementation((table: string) => {
      if (table === "smart_notes_generation_events") {
        return {
          select: () => ({
            eq: () => ({ is: () => ({ is: () => ({ not: () => Promise.resolve({ data: unlinkedEvents }) }) }) }),
          }),
        };
      }
      if (table === "consultations") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { reprocessUnlinkedSmartNotesEvents } = await import("./calendar-sync");
    const result = await reprocessUnlinkedSmartNotesEvents();

    expect(result).toEqual({ relinked: 0, stillUnlinked: 1 });
  });
});
