import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertActiveTeacherAssignment } from "./authorization";

// M4 인수 기준 13번 — "미배정·다른 선생님 체험 예약 차단"을 명시적으로 못박는
// 단위 테스트. 이 검증 자체는 R6에서 이미 구현된 assertActiveTeacherAssignment()
// (app/parent/booking-actions.ts 등 모든 예약 생성 액션이 confirm_lesson_booking
// 호출 전에 거치는 공통 게이트)가 그대로 담당한다 — 새 기능이 아니라 기존 동작을
// 테스트로 고정하는 것.

function mockAdminWithAssignment(row: { id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq3 = vi.fn(() => ({ maybeSingle }));
  const eq2 = vi.fn(() => ({ eq: eq3 }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as ReturnType<typeof import("@/lib/supabase-admin").createAdminClient>;
}

describe("assertActiveTeacherAssignment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("현재 활성 배정된 선생님이면 통과한다", async () => {
    const admin = mockAdminWithAssignment({ id: "assignment1" });
    await expect(
      assertActiveTeacherAssignment(admin, "subject-enrollment-1", "teacher-1")
    ).resolves.toBeUndefined();
  });

  it("배정된 적 없는(미배정) 선생님이면 예약을 차단한다", async () => {
    const admin = mockAdminWithAssignment(null);
    await expect(
      assertActiveTeacherAssignment(admin, "subject-enrollment-1", "unassigned-teacher")
    ).rejects.toThrow("이 과목 수강에 현재 배정된 선생님이 아닙니다.");
  });

  it("다른(현재 배정되지 않은) 선생님이면 예약을 차단한다 — 쿼리 자체가 teacher_id+status='active'로 좁혀져 있어 배정 종료된/다른 선생님은 항상 null로 돌아온다", async () => {
    const admin = mockAdminWithAssignment(null);
    await expect(
      assertActiveTeacherAssignment(admin, "subject-enrollment-1", "some-other-teacher")
    ).rejects.toThrow("이 과목 수강에 현재 배정된 선생님이 아닙니다.");

    const fromMock = admin.from as unknown as ReturnType<typeof vi.fn>;
    expect(fromMock).toHaveBeenCalledWith("teacher_assignments");
  });
});
