import { describe, expect, it, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ actorUserId: "admin1" }),
}));

import { listSubjectTeachingHistoryForCurrentTeacher } from "./teacher-assignment-termination-actions";

describe("listSubjectTeachingHistoryForCurrentTeacher (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("민감 컬럼(정산 단가, Smart Notes 등)을 요청하지 않고 안전한 컬럼만 매핑한다", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          session_id: "s1",
          starts_at: "2026-08-01T00:00:00Z",
          ends_at: "2026-08-01T01:00:00Z",
          final_status: "completed",
          lesson_type_name: "정규",
          // DB 함수가 실수로 민감 컬럼을 더 반환하더라도, 매핑 함수는 정의된 4개
          // 필드만 골라 반환해야 한다.
          hourly_rate_snapshot_minor: 999999,
          smart_notes_drive_file_id: "leaked",
        },
      ],
      error: null,
    });

    const result = await listSubjectTeachingHistoryForCurrentTeacher("se1");

    expect(result).toEqual([
      { sessionId: "s1", startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-08-01T01:00:00Z", finalStatus: "completed", lessonTypeName: "정규" },
    ]);
    expect(result[0]).not.toHaveProperty("hourly_rate_snapshot_minor");
    expect(rpcMock).toHaveBeenCalledWith("list_subject_teaching_history_for_current_teacher", {
      p_subject_enrollment_id: "se1",
    });
  });
});
