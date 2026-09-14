import { describe, expect, it, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const updateEqMock = vi.fn();
const updateInMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "teacher_assignment_termination_requests") {
    return {
      update: (payload: unknown) => {
        updateEqMock(payload);
        return { eq: (col: string, val: string) => ({ in: (col2: string, vals: string[]) => { updateInMock(col, val, col2, vals); return Promise.resolve({ error: null }); } }) };
      },
    };
  }
  // 다른 테이블 접근은 이 테스트 파일의 관심사가 아니다(listSubjectTeachingHistoryForCurrentTeacher는
  // rpc만 씀) — 빈 목록으로 안전하게 기본 동작.
  return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: fromMock }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ actorUserId: "admin1" }),
}));

import {
  listSubjectTeachingHistoryForCurrentTeacher,
  cancelTerminationRequestAction,
} from "./teacher-assignment-termination-actions";

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

// C-2(2026-09-11) — "종료 확정 전 요청 취소는 기존 배정 유지"를 코드로 확인한다.
// cancelTerminationRequestAction은 teacher_assignment_termination_requests의
// status만 requested/failed일 때 cancelled로 바꿀 뿐(.in()으로 제한),
// teacher_assignments/subject_enrollments는 processTeacherAssignmentTermination
// (별도 claim 경로)만 건드린다 — 이 액션은 그 테이블을 아예 조회·수정하지 않으므로
// 기존 활성 배정이 이 호출만으로는 절대 바뀔 수 없다.
describe("cancelTerminationRequestAction — 종료 확정 전 취소는 기존 배정에 영향 없다", () => {
  beforeEach(() => vi.clearAllMocks());

  it("요청 상태만 cancelled로 바꾸고, requested/failed 상태일 때만 적용되도록 제한한다", async () => {
    await cancelTerminationRequestAction("req1");

    expect(updateEqMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
    expect(updateInMock).toHaveBeenCalledWith("id", "req1", "status", ["requested", "failed"]);
    // teacher_assignments/subject_enrollments 테이블은 이 액션 안에서 전혀 참조되지
    // 않는다 — fromMock이 "teacher_assignment_termination_requests" 외 테이블로
    // 호출됐다면 이 함수 자체가 뭔가를 추가로 건드렸다는 뜻이라 실패해야 한다.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("teacher_assignment_termination_requests");
  });
});
