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

vi.mock("@/lib/google-meet", () => ({
  extractMeetingCodeFromLink: (link: string) => (link ? "abc-defg-hij" : null),
}));

let meetingRequestRow: {
  id: string;
  subject: string | null;
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
      google_event_id: null,
      google_meet_link: null,
      household: { primary_guardian_id: "guardian1", guardian: { name: "김민지" } },
    };
    guardianAuthEmail = "guardian@example.com";
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
});
