import { beforeEach, describe, expect, it, vi } from "vitest";

// scheduleMeetingRequest() 전용 테스트 — 2026-09-17(상담 마일스톤 2단계).
// 요구사항: (1) 유효한 시간 없이는 진행하지 않는다, (2) google_event_id가
// 이미 있으면 새로 만들지 않고 patch만 한다(멱등), (3) Calendar 호출이
// 실패하면 DB를 전혀 쓰지 않는다(status가 이전 값 그대로 남는다).

const createCalendarEventWithMeet = vi.fn();
const patchCalendarEventTime = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  createCalendarEventWithMeet: (...args: unknown[]) => createCalendarEventWithMeet(...args),
  patchCalendarEventTime: (...args: unknown[]) => patchCalendarEventTime(...args),
}));

const assertOverlap = vi.fn();
const resolveOrganizer = vi.fn();
vi.mock("@/lib/consultation/meeting-scheduling", async (orig) => ({
  ...(await orig<typeof import("@/lib/consultation/meeting-scheduling")>()),
  assertNoConsultantMeetingOverlap: (...a: unknown[]) => assertOverlap(...a),
  resolveMeetingOrganizerEmail: (...a: unknown[]) => resolveOrganizer(...a),
}));

vi.mock("@/lib/google-meet", () => ({
  extractMeetingCodeFromLink: (link: string) => (link ? "abc-defg-hij" : null),
}));

let meetingRequestRow: {
  id: string;
  subject: string | null;
  consultant_id: string | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  household: { primary_guardian_id: string; guardian: { name: string } };
};
let guardianAuthEmail: string | null;
let updateMock!: (payload: unknown) => void;
let updateEqMock: ReturnType<typeof vi.fn>;

const adminSupabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "meeting_requests") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: meetingRequestRow, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
  auth: {
    admin: {
      getUserById: async () => ({ data: { user: guardianAuthEmail ? { email: guardianAuthEmail } : null } }),
    },
  },
};

const requestingSupabaseMock = {
  from: vi.fn((_table: string) => ({
    update: (payload: unknown) => {
      updateMock(payload);
      return { eq: updateEqMock };
    },
  })),
};

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({ adminUserId: "admin1", supabase: requestingSupabaseMock })),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(() => adminSupabaseMock),
}));

import { scheduleMeetingRequest } from "./inquiry-and-meeting-actions";

describe("scheduleMeetingRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock = vi.fn();
    meetingRequestRow = {
      id: "mr1",
      subject: "학습 상담",
      consultant_id: "consultant1",
      google_event_id: null,
      google_meet_link: null,
      household: { primary_guardian_id: "guardian1", guardian: { name: "김민지" } },
    };
    guardianAuthEmail = "guardian@example.com";
    assertOverlap.mockResolvedValue(undefined);
    resolveOrganizer.mockResolvedValue("consultant1@alton.education");
    updateEqMock = vi.fn().mockResolvedValue({ error: null });
  });

  it("시작/종료 시간이 없으면 거부하고 Calendar를 호출하지 않는다", async () => {
    await expect(
      scheduleMeetingRequest({ meetingRequestId: "mr1", startsAt: "not-a-date", endsAt: "2026-09-20T14:30:00+09:00" })
    ).rejects.toThrow("일정 시간이 올바르지 않습니다.");
    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
  });

  it("종료 시각이 시작 시각보다 앞서면 거부한다", async () => {
    await expect(
      scheduleMeetingRequest({
        meetingRequestId: "mr1",
        startsAt: "2026-09-20T14:30:00+09:00",
        endsAt: "2026-09-20T14:00:00+09:00",
      })
    ).rejects.toThrow("종료 시각은 시작 시각보다 뒤여야 합니다.");
    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
  });

  it("google_event_id가 없으면 새로 생성하고 status를 scheduled로 갱신한다", async () => {
    createCalendarEventWithMeet.mockResolvedValue({ googleEventId: "evt1", meetLink: "https://meet.google.com/abc-defg-hij" });
    const result = await scheduleMeetingRequest({
      meetingRequestId: "mr1",
      startsAt: "2026-09-20T14:00:00+09:00",
      endsAt: "2026-09-20T14:30:00+09:00",
    });
    expect(createCalendarEventWithMeet).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "mr1", attendeeEmail: "guardian@example.com" })
    );
    expect(patchCalendarEventTime).not.toHaveBeenCalled();
    expect(result.googleMeetLink).toBe("https://meet.google.com/abc-defg-hij");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled", google_event_id: "evt1", google_sync_status: "succeeded" })
    );
  });

  it("google_event_id가 이미 있으면 새로 만들지 않고 patch만 한다(멱등)", async () => {
    meetingRequestRow.google_event_id = "evt-existing";
    meetingRequestRow.google_meet_link = "https://meet.google.com/xyz-uvwx-rst";
    patchCalendarEventTime.mockResolvedValue(undefined);
    await scheduleMeetingRequest({
      meetingRequestId: "mr1",
      startsAt: "2026-09-20T15:00:00+09:00",
      endsAt: "2026-09-20T15:30:00+09:00",
    });
    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
    expect(patchCalendarEventTime).toHaveBeenCalledWith(
      expect.objectContaining({ googleEventId: "evt-existing" })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled", google_event_id: "evt-existing" })
    );
  });

  it("Calendar 호출이 실패하면 DB를 전혀 쓰지 않는다", async () => {
    createCalendarEventWithMeet.mockRejectedValue(new Error("Calendar API down"));
    await expect(
      scheduleMeetingRequest({
        meetingRequestId: "mr1",
        startsAt: "2026-09-20T14:00:00+09:00",
        endsAt: "2026-09-20T14:30:00+09:00",
      })
    ).rejects.toThrow("Calendar API down");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("담당 컨설턴트가 없으면 거절하고 Calendar·DB를 건드리지 않는다", async () => {
    meetingRequestRow.consultant_id = null;
    await expect(
      scheduleMeetingRequest({ meetingRequestId: "mr1", startsAt: "2026-09-20T14:00:00+09:00", endsAt: "2026-09-20T14:30:00+09:00" })
    ).rejects.toThrow("먼저 담당 컨설턴트를 배정해 주세요");
    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("organizer 는 회사 계정이 아니라 그 미팅의 컨설턴트 계정이다", async () => {
    createCalendarEventWithMeet.mockResolvedValue({ googleEventId: "evt1", meetLink: "https://meet.google.com/abc-defg-hij" });
    await scheduleMeetingRequest({ meetingRequestId: "mr1", startsAt: "2026-09-20T14:00:00+09:00", endsAt: "2026-09-20T14:30:00+09:00" });
    expect(resolveOrganizer).toHaveBeenCalledWith(expect.anything(), "consultant1");
    expect(createCalendarEventWithMeet).toHaveBeenCalledWith(expect.objectContaining({ teacherWorkspaceEmail: "consultant1@alton.education" }));
  });

  it("컨설턴트 계정 이메일이 없으면 Calendar 없이 저장하고 sync 를 failed 로 남긴다", async () => {
    resolveOrganizer.mockResolvedValue(null);
    const r = await scheduleMeetingRequest({ meetingRequestId: "mr1", startsAt: "2026-09-20T14:00:00+09:00", endsAt: "2026-09-20T14:30:00+09:00" });
    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
    expect(r.googleSyncStatus).toBe("failed");
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "scheduled", google_sync_status: "failed" }));
  });

  it("실제 Google 호출이 꺼져 있으면 미팅은 저장하고 sync 를 failed 로 남긴다", async () => {
    createCalendarEventWithMeet.mockRejectedValue(new Error("not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 ..."));
    const r = await scheduleMeetingRequest({ meetingRequestId: "mr1", startsAt: "2026-09-20T14:00:00+09:00", endsAt: "2026-09-20T14:30:00+09:00" });
    expect(r.googleSyncStatus).toBe("failed");
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "scheduled", google_sync_status: "failed" }));
  });

  it("겹침이면 Calendar 호출 전에 거절한다", async () => {
    assertOverlap.mockRejectedValue(new Error("같은 컨설턴트의 다른 미팅과 시간이 겹칩니다."));
    await expect(
      scheduleMeetingRequest({ meetingRequestId: "mr1", startsAt: "2026-09-20T14:00:00+09:00", endsAt: "2026-09-20T14:30:00+09:00" })
    ).rejects.toThrow("겹칩니다");
    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
  });
});
