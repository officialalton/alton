import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSelectSingleMock = vi.fn();
const deleteEqEqMock = vi.fn();
const listOrderMock = vi.fn();

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "teacher_availability_rules" || table === "teacher_availability_exceptions") {
      return {
        insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
        delete: () => ({ eq: () => ({ eq: deleteEqEqMock }) }),
        select: () => ({ eq: () => ({ order: listOrderMock }) }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "teacher1" }, supabase: supabaseMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  insertSelectSingleMock.mockResolvedValue({ data: { id: "rule1" }, error: null });
  deleteEqEqMock.mockResolvedValue({ error: null });
  listOrderMock.mockResolvedValue({
    data: [
      { id: "rule1", day_of_week: 1, start_time_local: "09:00", end_time_local: "17:00", timezone: "America/Los_Angeles", effective_from: "2026-01-01", effective_until: null },
    ],
    error: null,
  });
});

describe("addTeacherAvailabilityRule", () => {
  it("teacher_availability_rules에 본인 teacher_id로 insert하고 id를 반환한다", async () => {
    const { addTeacherAvailabilityRule } = await import("./availability-actions");
    const id = await addTeacherAvailabilityRule({
      dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01",
    });
    expect(id).toBe("rule1");
  });

  it("insert 에러 시 에러를 던진다", async () => {
    insertSelectSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { addTeacherAvailabilityRule } = await import("./availability-actions");
    await expect(
      addTeacherAvailabilityRule({ dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01" })
    ).rejects.toThrow("boom");
  });
});

describe("removeTeacherAvailabilityRule", () => {
  it("본인 teacher_id 조건으로 delete한다", async () => {
    const { removeTeacherAvailabilityRule } = await import("./availability-actions");
    await removeTeacherAvailabilityRule("rule1");
    expect(deleteEqEqMock).toHaveBeenCalled();
  });
});

describe("addTeacherAvailabilityException", () => {
  it("teacher_availability_exceptions에 본인 teacher_id로 insert한다", async () => {
    insertSelectSingleMock.mockResolvedValue({ data: { id: "exc1" }, error: null });
    const { addTeacherAvailabilityException } = await import("./availability-actions");
    const id = await addTeacherAvailabilityException({
      exceptionDate: "2026-12-25", kind: "blocked", timezone: "America/Los_Angeles",
    });
    expect(id).toBe("exc1");
  });
});

describe("listMyAvailabilityRules", () => {
  it("본인 규칙 목록을 카멜케이스로 변환해 반환한다", async () => {
    const { listMyAvailabilityRules } = await import("./availability-actions");
    const rules = await listMyAvailabilityRules();
    expect(rules).toEqual([
      { id: "rule1", dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01", effectiveUntil: null },
    ]);
  });
});
