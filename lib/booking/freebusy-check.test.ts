import { beforeEach, describe, expect, it, vi } from "vitest";

const teacherMaybeSingleMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "teachers") {
    return { select: () => ({ eq: () => ({ maybeSingle: teacherMaybeSingleMock }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const queryFreeBusyMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  queryFreeBusy: (params: unknown) => queryFreeBusyMock(params),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  teacherMaybeSingleMock.mockResolvedValue({ data: { workspace_email: "teacher@alton.education" } });
});

describe("checkTeacherFreeBusyBeforeBooking", () => {
  it("CALENDAR_SYNC_ALLOW_REAL_CALLS가 꺼져 있으면 조회하지 않고 조용히 스킵한다(예약을 막지 않음)", async () => {
    delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
    const { checkTeacherFreeBusyBeforeBooking } = await import("./freebusy-check");
    const result = await checkTeacherFreeBusyBeforeBooking({
      teacherId: "t1", startsAt: new Date("2026-10-10T19:00:00Z"), endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    expect(result).toEqual({ checked: false, conflict: false });
    expect(queryFreeBusyMock).not.toHaveBeenCalled();
  });

  it("workspace_email이 없으면 스킵한다(예약을 막지 않음)", async () => {
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
    teacherMaybeSingleMock.mockResolvedValue({ data: { workspace_email: null } });
    const { checkTeacherFreeBusyBeforeBooking } = await import("./freebusy-check");
    const result = await checkTeacherFreeBusyBeforeBooking({
      teacherId: "t1", startsAt: new Date("2026-10-10T19:00:00Z"), endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    expect(result).toEqual({ checked: false, conflict: false });
  });

  it("겹치는 busy 구간이 있으면 conflict=true를 반환한다", async () => {
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
    queryFreeBusyMock.mockResolvedValue([{ start: "2026-10-10T18:30:00Z", end: "2026-10-10T19:30:00Z" }]);
    const { checkTeacherFreeBusyBeforeBooking } = await import("./freebusy-check");
    const result = await checkTeacherFreeBusyBeforeBooking({
      teacherId: "t1", startsAt: new Date("2026-10-10T19:00:00Z"), endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    expect(result).toEqual({ checked: true, conflict: true });
  });

  it("겹치지 않는 busy 구간은 conflict=false", async () => {
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
    queryFreeBusyMock.mockResolvedValue([{ start: "2026-10-10T10:00:00Z", end: "2026-10-10T11:00:00Z" }]);
    const { checkTeacherFreeBusyBeforeBooking } = await import("./freebusy-check");
    const result = await checkTeacherFreeBusyBeforeBooking({
      teacherId: "t1", startsAt: new Date("2026-10-10T19:00:00Z"), endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    expect(result).toEqual({ checked: true, conflict: false });
  });

  it("Google 쪽 조회가 실패해도 예약을 막지 않는다(DB 잠금이 최종 방어선)", async () => {
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
    queryFreeBusyMock.mockRejectedValue(new Error("network error"));
    const { checkTeacherFreeBusyBeforeBooking } = await import("./freebusy-check");
    const result = await checkTeacherFreeBusyBeforeBooking({
      teacherId: "t1", startsAt: new Date("2026-10-10T19:00:00Z"), endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    expect(result).toEqual({ checked: false, conflict: false });
  });
});
