import { beforeEach, describe, expect, it, vi } from "vitest";

const queryFreeBusyMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  queryFreeBusy: (params: unknown) => queryFreeBusyMock(params),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTeacherExternalBusyBlocks", () => {
  it("FreeBusy 결과를 startsAt/endsAt만 있는 블록으로 변환한다(제목·참석자 없음)", async () => {
    queryFreeBusyMock.mockResolvedValue([{ start: "2026-10-01T19:00:00Z", end: "2026-10-01T20:00:00Z" }]);
    const { listTeacherExternalBusyBlocks } = await import("./external-busy");
    const blocks = await listTeacherExternalBusyBlocks({
      teacherWorkspaceEmail: "teacher1@alton.education",
      rangeStart: new Date("2026-10-01T00:00:00Z"),
      rangeEnd: new Date("2026-10-02T00:00:00Z"),
    });
    expect(blocks).toEqual([{ startsAt: "2026-10-01T19:00:00Z", endsAt: "2026-10-01T20:00:00Z" }]);
    expect(Object.keys(blocks[0])).toEqual(["startsAt", "endsAt"]);
  });

  it("조회가 실패(미승인 등)해도 예외를 던지지 않고 빈 배열을 반환한다", async () => {
    queryFreeBusyMock.mockRejectedValue(new Error("not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아닙니다."));
    const { listTeacherExternalBusyBlocks } = await import("./external-busy");
    const blocks = await listTeacherExternalBusyBlocks({
      teacherWorkspaceEmail: "teacher1@alton.education",
      rangeStart: new Date("2026-10-01T00:00:00Z"),
      rangeEnd: new Date("2026-10-02T00:00:00Z"),
    });
    expect(blocks).toEqual([]);
  });
});
