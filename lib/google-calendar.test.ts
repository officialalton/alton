import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const getCalendarApiAccessTokenMock = vi.fn().mockResolvedValue("calendar-access-token");
const getFreeBusyApiAccessTokenMock = vi.fn().mockResolvedValue("freebusy-access-token");
vi.mock("@/lib/google-workspace-auth", () => ({
  getCalendarApiAccessToken: (subjectEmail: string) => getCalendarApiAccessTokenMock(subjectEmail),
  getFreeBusyApiAccessToken: (subjectEmail: string) => getFreeBusyApiAccessTokenMock(subjectEmail),
}));

function allowRealCalls() {
  process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
}

describe("google-calendar", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    getCalendarApiAccessTokenMock.mockResolvedValue("calendar-access-token");
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  describe("안전 게이트", () => {
    it("CALENDAR_SYNC_ALLOW_REAL_CALLS가 true가 아니면 createCalendarEventWithMeet가 실제 호출 없이 실패한다", async () => {
      delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { createCalendarEventWithMeet } = await import("./google-calendar");
      await expect(
        createCalendarEventWithMeet({
          teacherWorkspaceEmail: "teacher@alton.education",
          reservationId: "r1",
          startsAt: new Date(),
          endsAt: new Date(),
          summary: "테스트",
          timezone: "America/Los_Angeles",
          sendUpdates: "none",
        })
      ).rejects.toThrow("not implemented");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("createCalendarEventWithMeet", () => {
    it("reservationId를 conferenceData.createRequest.requestId로 넘기고, sendUpdates=none·attendee 없이 이벤트+Meet 링크를 생성한다", async () => {
      allowRealCalls();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "google-event-1",
          conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const { createCalendarEventWithMeet } = await import("./google-calendar");

      const result = await createCalendarEventWithMeet({
        teacherWorkspaceEmail: "teacher@alton.education",
        reservationId: "reservation-abc",
        startsAt: new Date("2026-10-01T19:00:00Z"),
        endsAt: new Date("2026-10-01T21:00:00Z"),
        summary: "ALTON 정규수업",
        timezone: "America/Los_Angeles",
        sendUpdates: "none",
      });

      expect(result).toEqual({ googleEventId: "google-event-1", meetLink: "https://meet.google.com/abc-defg-hij" });
      expect(getCalendarApiAccessTokenMock).toHaveBeenCalledWith("teacher@alton.education");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("sendUpdates=none");
      expect(url).toContain("conferenceDataVersion=1");
      const body = JSON.parse(init.body as string);
      expect(body.conferenceData.createRequest.requestId).toBe("reservation-abc");
      expect(body.attendees).toBeUndefined();
    });

    // 2026-09-03 정책 전환 — 확정된 상담·체험·정규수업은 Calendar 네이티브 초대를
    // 기본 전달 수단으로 쓴다(R6의 "attendees 없음+sendUpdates=none" 정책 폐기).
    it("attendeeEmail이 있으면 유일한 외부 참석자로 추가하고 sendUpdates=all·guest 제한 3종을 항상 적용한다", async () => {
      allowRealCalls();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "google-event-3",
          conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const { createCalendarEventWithMeet } = await import("./google-calendar");

      await createCalendarEventWithMeet({
        teacherWorkspaceEmail: "official@alton.education",
        reservationId: "consult-abc",
        startsAt: new Date("2026-10-01T19:00:00Z"),
        endsAt: new Date("2026-10-01T20:00:00Z"),
        summary: "[Alton Education 상담] 홍길동",
        description: "상담 안내",
        timezone: "America/Los_Angeles",
        attendeeEmail: "parent@example.com",
        sendUpdates: "all",
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("sendUpdates=all");
      const body = JSON.parse(init.body as string);
      expect(body.attendees).toEqual([{ email: "parent@example.com" }]);
      expect(body.guestsCanInviteOthers).toBe(false);
      expect(body.guestsCanModify).toBe(false);
      expect(body.guestsCanSeeOtherGuests).toBe(false);
      expect(body.description).toBe("상담 안내");
    });

    it("Meet entry point가 없으면 명확한 에러를 던진다", async () => {
      allowRealCalls();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "google-event-2", conferenceData: {} }) })
      );
      const { createCalendarEventWithMeet } = await import("./google-calendar");
      await expect(
        createCalendarEventWithMeet({
          teacherWorkspaceEmail: "teacher@alton.education",
          reservationId: "r2",
          startsAt: new Date(),
          endsAt: new Date(),
          summary: "테스트",
          timezone: "America/Los_Angeles",
          sendUpdates: "none",
        })
      ).rejects.toThrow("Meet 링크를 받지 못했습니다");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("404/410은 이미 삭제된 것으로 보고 성공 처리한다(멱등)", async () => {
      allowRealCalls();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      const { deleteCalendarEvent } = await import("./google-calendar");
      await expect(
        deleteCalendarEvent({ teacherWorkspaceEmail: "teacher@alton.education", googleEventId: "gone", sendUpdates: "none" })
      ).resolves.toBeUndefined();
    });

    it("그 외 실패는 에러를 던진다", async () => {
      allowRealCalls();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }));
      const { deleteCalendarEvent } = await import("./google-calendar");
      await expect(
        deleteCalendarEvent({ teacherWorkspaceEmail: "teacher@alton.education", googleEventId: "e1", sendUpdates: "none" })
      ).rejects.toThrow("Calendar 이벤트 삭제 실패");
    });
  });

  describe("queryFreeBusy", () => {
    it("primary 캘린더의 busy 구간을 반환한다", async () => {
      allowRealCalls();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ calendars: { primary: { busy: [{ start: "2026-10-01T19:00:00Z", end: "2026-10-01T21:00:00Z" }] } } }),
        })
      );
      const { queryFreeBusy } = await import("./google-calendar");
      const busy = await queryFreeBusy({
        teacherWorkspaceEmail: "teacher@alton.education",
        timeMin: new Date("2026-10-01T00:00:00Z"),
        timeMax: new Date("2026-10-02T00:00:00Z"),
      });
      expect(busy).toEqual([{ start: "2026-10-01T19:00:00Z", end: "2026-10-01T21:00:00Z" }]);
    });

    it("이벤트 생성용 토큰이 아니라 FreeBusy 전용 토큰(별도 최소권한 scope)을 사용한다", async () => {
      allowRealCalls();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ calendars: { primary: { busy: [] } } }) })
      );
      const { queryFreeBusy } = await import("./google-calendar");
      await queryFreeBusy({
        teacherWorkspaceEmail: "teacher@alton.education",
        timeMin: new Date("2026-10-01T00:00:00Z"),
        timeMax: new Date("2026-10-02T00:00:00Z"),
      });
      expect(getFreeBusyApiAccessTokenMock).toHaveBeenCalledWith("teacher@alton.education");
      expect(getCalendarApiAccessTokenMock).not.toHaveBeenCalled();
    });
  });

  describe("listCalendarEventsIncremental", () => {
    it("privateExtendedProperty 쿼리 파라미터를 보내지 않는다(Google이 와일드카드를 지원하지 않음 — R6 Sandbox 실측 2026-09-03 발견)", async () => {
      allowRealCalls();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ nextSyncToken: "tok1", items: [] }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const { listCalendarEventsIncremental } = await import("./google-calendar");
      await listCalendarEventsIncremental({ teacherWorkspaceEmail: "teacher@alton.education" });
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("privateExtendedProperty");
      expect(calledUrl).toContain("showDeleted=true");
    });

    it("confirmed 이벤트는 altonReservationId가 있는 것만 남기고, cancelled 이벤트는 없어도 포함한다", async () => {
      allowRealCalls();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            nextSyncToken: "tok1",
            items: [
              { id: "g-alton", status: "confirmed", extendedProperties: { private: { altonReservationId: "r1" } } },
              { id: "g-personal", status: "confirmed" },
              { id: "g-deleted-alton", status: "cancelled" },
            ],
          }),
        })
      );
      const { listCalendarEventsIncremental } = await import("./google-calendar");
      const result = await listCalendarEventsIncremental({ teacherWorkspaceEmail: "teacher@alton.education" });
      const ids = result.events.map((e) => e.googleEventId);
      expect(ids).toEqual(["g-alton", "g-deleted-alton"]);
      expect(result.events.find((e) => e.googleEventId === "g-deleted-alton")?.altonReservationId).toBeNull();
    });
  });
});
