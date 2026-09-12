import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractMeetingCodeFromLink } from "./google-meet";

const getMeetSettingsApiAccessTokenMock = vi.fn().mockResolvedValue("meet-settings-access-token");
const getMeetReadonlyApiAccessTokenMock = vi.fn().mockResolvedValue("meet-readonly-access-token");
vi.mock("@/lib/google-workspace-auth", () => ({
  getMeetSettingsApiAccessToken: (subjectEmail: string) => getMeetSettingsApiAccessTokenMock(subjectEmail),
  getMeetReadonlyApiAccessToken: (subjectEmail: string) => getMeetReadonlyApiAccessTokenMock(subjectEmail),
}));

function allowRealCalls() {
  process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
}

const ORIGINAL_ENV = { ...process.env };

describe("google-meet", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    getMeetSettingsApiAccessTokenMock.mockResolvedValue("meet-settings-access-token");
    getMeetReadonlyApiAccessTokenMock.mockResolvedValue("meet-readonly-access-token");
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  describe("extractMeetingCodeFromLink", () => {
    it("표준 Meet 링크에서 회의 코드를 뽑는다", () => {
      expect(extractMeetingCodeFromLink("https://meet.google.com/abc-defg-hij")).toBe("abc-defg-hij");
    });

    it("쿼리스트링이 붙어도 회의 코드만 뽑는다", () => {
      expect(extractMeetingCodeFromLink("https://meet.google.com/abc-defg-hij?authuser=0")).toBe("abc-defg-hij");
    });

    it("Meet 링크가 아니면 null을 반환한다", () => {
      expect(extractMeetingCodeFromLink("https://zoom.us/j/123456")).toBeNull();
    });
  });

  describe("안전 게이트", () => {
    it("CALENDAR_SYNC_ALLOW_REAL_CALLS가 true가 아니면 enableMeetSpaceSmartNotes가 실제 호출 없이 실패한다", async () => {
      delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { enableMeetSpaceSmartNotes } = await import("./google-meet");
      await expect(
        enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: "teacher@alton.education", meetingCode: "abc-defg-hij" })
      ).rejects.toThrow("not implemented");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("listConferenceParticipantEvents도 플래그가 꺼져 있으면 호출하지 않는다", async () => {
      delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { listConferenceParticipantEvents } = await import("./google-meet");
      await expect(
        listConferenceParticipantEvents({ teacherWorkspaceEmail: "teacher@alton.education", conferenceRecordName: "conferenceRecords/abc" })
      ).rejects.toThrow("not implemented");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("enableMeetSpaceSmartNotes", () => {
    it("meetingCode로 GET해 canonical name을 얻고, 그 canonical name으로 PATCH한 뒤, 다시 GET해 ON을 재확인한다", async () => {
      allowRealCalls();
      const fetchMock = vi
        .fn()
        // 1) 초기 GET(별칭) — canonical name 확인
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: "spaces/abcXYZ123" }) })
        // 2) PATCH(canonical name)
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        // 3) 재확인 GET(canonical name)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ name: "spaces/abcXYZ123", config: { artifactConfig: { smartNotesConfig: { autoSmartNotesGeneration: "ON" } } } }),
        });
      vi.stubGlobal("fetch", fetchMock);
      const { enableMeetSpaceSmartNotes } = await import("./google-meet");

      await enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: "teacher@alton.education", meetingCode: "abc-defg-hij" });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [getUrl] = fetchMock.mock.calls[0];
      expect(getUrl).toContain("/spaces/abc-defg-hij");

      const [patchUrl, patchInit] = fetchMock.mock.calls[1];
      expect(patchUrl).toContain("/spaces/abcXYZ123");
      expect(patchUrl).toContain("updateMask=config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration");
      expect(patchInit.method).toBe("PATCH");
      const body = JSON.parse(patchInit.body as string);
      expect(body.config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration).toBe("ON");

      const [confirmUrl] = fetchMock.mock.calls[2];
      expect(confirmUrl).toContain("/spaces/abcXYZ123");
    });

    it("PATCH 이후 재확인에서 ON이 아니면 에러를 던진다(관리자 재처리 대상)", async () => {
      allowRealCalls();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: "spaces/abcXYZ123" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ name: "spaces/abcXYZ123", config: { artifactConfig: { smartNotesConfig: { autoSmartNotesGeneration: "OFF" } } } }),
        });
      vi.stubGlobal("fetch", fetchMock);
      const { enableMeetSpaceSmartNotes } = await import("./google-meet");

      await expect(
        enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: "teacher@alton.education", meetingCode: "abc-defg-hij" })
      ).rejects.toThrow("ON이 아닙니다");
    });

    it("초기 GET 응답에 canonical name이 없으면 PATCH를 시도하지 않고 에러를 던진다", async () => {
      allowRealCalls();
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      vi.stubGlobal("fetch", fetchMock);
      const { enableMeetSpaceSmartNotes } = await import("./google-meet");

      await expect(
        enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: "teacher@alton.education", meetingCode: "abc-defg-hij" })
      ).rejects.toThrow("canonical name");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("listConferenceParticipantEvents", () => {
    it("earliestStartTime/latestEndTime을 joined/left 이벤트로 변환한다", async () => {
      allowRealCalls();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            participants: [
              {
                name: "conferenceRecords/abc/participants/1",
                signedinUser: { user: "users/student1" },
                earliestStartTime: "2026-10-10T19:00:00Z",
                latestEndTime: "2026-10-10T21:00:00Z",
              },
            ],
          }),
        })
      );
      const { listConferenceParticipantEvents } = await import("./google-meet");
      const events = await listConferenceParticipantEvents({
        teacherWorkspaceEmail: "teacher@alton.education",
        conferenceRecordName: "conferenceRecords/abc",
      });
      expect(events).toEqual([
        { participantId: "conferenceRecords/abc/participants/1", profileId: "users/student1", eventType: "joined", occurredAt: "2026-10-10T19:00:00Z" },
        { participantId: "conferenceRecords/abc/participants/1", profileId: "users/student1", eventType: "left", occurredAt: "2026-10-10T21:00:00Z" },
      ]);
    });
  });
});
