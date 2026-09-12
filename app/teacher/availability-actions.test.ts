import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSelectSingleMock = vi.fn();
const deleteEqEqMock = vi.fn();
// select().eq(...) 이후 흐름이 두 갈래다: 겹침 검증(select().eq().eq(), 바로 await되는
// 평범한 값)과 목록 조회(select().eq().order(), Promise). 둘 다 같은 mock으로 값을
// 만들어주되, eq/order 어느 쪽으로 이어지든 그 값을 반환하도록 구성한다.
const selectResultMock = vi.fn();

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "teacher_availability_rules" || table === "teacher_availability_exceptions") {
      return {
        insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
        delete: () => ({ eq: () => ({ eq: deleteEqEqMock }) }),
        select: () => ({
          eq: () => {
            const result = selectResultMock();
            return {
              ...result,
              eq: () => selectResultMock(),
              order: () => Promise.resolve(selectResultMock()),
            };
          },
        }),
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
  // 기본값: 겹침 검증에서 기존 규칙 없음(no overlap) — insert가 그대로 진행됨.
  selectResultMock.mockReturnValue({ data: [], error: null });
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

  it("teacher_availability_rules_no_overlap 위반(23P01)이면 겹침을 설명하는 에러로 바꿔 던진다", async () => {
    insertSelectSingleMock.mockResolvedValue({ data: null, error: { code: "23P01", message: "exclusion violation" } });
    const { addTeacherAvailabilityRule } = await import("./availability-actions");
    await expect(
      addTeacherAvailabilityRule({ dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01" })
    ).rejects.toThrow("같은 요일에 겹치는 시간대가 이미 등록되어 있습니다.");
  });

  it("같은 요일·겹치는 유효기간 안에서 시간대가 겹치면 insert 전에 클라이언트(서버 액션) 레벨에서 에러를 던진다", async () => {
    selectResultMock.mockReturnValue({
      data: [{ start_time_local: "10:00", end_time_local: "17:00", effective_from: "2026-01-01", effective_until: null }],
      error: null,
    });
    const { addTeacherAvailabilityRule } = await import("./availability-actions");
    await expect(
      addTeacherAvailabilityRule({ dayOfWeek: 1, startTimeLocal: "16:00", endTimeLocal: "20:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01" })
    ).rejects.toThrow("같은 요일에 겹치는 시간대가 이미 등록되어 있습니다.");
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
  });

  it("같은 요일이라도 겹치지 않는 시간대(예: 10-17시와 19-23시)는 허용한다", async () => {
    selectResultMock.mockReturnValue({
      data: [{ start_time_local: "10:00", end_time_local: "17:00", effective_from: "2026-01-01", effective_until: null }],
      error: null,
    });
    const { addTeacherAvailabilityRule } = await import("./availability-actions");
    const id = await addTeacherAvailabilityRule({
      dayOfWeek: 1, startTimeLocal: "19:00", endTimeLocal: "23:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01",
    });
    expect(id).toBe("rule1");
  });

  it("유효기간이 겹치지 않으면(과거 규칙이 이미 종료됨) 같은 시간대라도 허용한다", async () => {
    selectResultMock.mockReturnValue({
      data: [{ start_time_local: "10:00", end_time_local: "17:00", effective_from: "2025-01-01", effective_until: "2025-12-31" }],
      error: null,
    });
    const { addTeacherAvailabilityRule } = await import("./availability-actions");
    const id = await addTeacherAvailabilityRule({
      dayOfWeek: 1, startTimeLocal: "10:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01",
    });
    expect(id).toBe("rule1");
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
    selectResultMock.mockReturnValue({
      data: [
        { id: "rule1", day_of_week: 1, start_time_local: "09:00", end_time_local: "17:00", timezone: "America/Los_Angeles", effective_from: "2026-01-01", effective_until: null },
      ],
      error: null,
    });
    const { listMyAvailabilityRules } = await import("./availability-actions");
    const rules = await listMyAvailabilityRules();
    expect(rules).toEqual([
      { id: "rule1", dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01", effectiveUntil: null },
    ]);
  });
});
