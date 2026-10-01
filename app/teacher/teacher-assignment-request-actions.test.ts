import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUserMock, postSystemMessageMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  postSystemMessageMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/app/admin/staff-messenger-actions", () => ({ postTeacherAssignmentResultSystemMessage: postSystemMessageMock }));

import { respondTeacherAssignmentRequestAction } from "./teacher-assignment-request-actions";

beforeEach(() => {
  requireUserMock.mockReset();
  postSystemMessageMock.mockClear();
  postSystemMessageMock.mockResolvedValue(undefined);
});

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req1",
    consultant_id: "consultant1",
    student_id: "student1",
    link_student_id: null,
    subject_id: "subject1",
    teacher_id: "teacher1",
    student_name: "테스트 학생",
    grade: "10학년",
    current_score: null,
    goal: null,
    is_new_student: false,
    preferred_schedule: null,
    request_note: null,
    status: "accepted",
    reject_reason: null,
    needs_reprocessing: false,
    reprocessing_error: null,
    created_at: "2026-09-23T00:00:00Z",
    responded_at: "2026-09-23T01:00:00Z",
    ...overrides,
  };
}

describe("respondTeacherAssignmentRequestAction — 메신저 시스템 메시지 반영", () => {
  it("수락 시 담당 컨설턴트의 내부 채널에 수락 메시지를 남긴다", async () => {
    const supabase = { rpc: () => ({ single: () => Promise.resolve({ data: baseRow(), error: null }) }) };
    requireUserMock.mockResolvedValue({ supabase });

    const result = await respondTeacherAssignmentRequestAction("req1", true);

    expect(result.consultantId).toBe("consultant1");
    expect(postSystemMessageMock).toHaveBeenCalledWith({
      consultantId: "consultant1",
      body: expect.stringContaining("수락"),
    });
  });

  it("거절 시 사유를 포함한 거절 메시지를 남긴다", async () => {
    const supabase = {
      rpc: () => ({ single: () => Promise.resolve({ data: baseRow({ status: "rejected", reject_reason: "일정 불가" }), error: null }) }),
    };
    requireUserMock.mockResolvedValue({ supabase });

    await respondTeacherAssignmentRequestAction("req1", false, "일정 불가");

    expect(postSystemMessageMock).toHaveBeenCalledWith({
      consultantId: "consultant1",
      body: expect.stringContaining("거절"),
    });
    expect(postSystemMessageMock.mock.calls[0][0].body).toContain("일정 불가");
  });

  it("시스템 메시지 전송이 실패해도 응답 결과 자체는 정상 반환한다", async () => {
    postSystemMessageMock.mockRejectedValue(new Error("메신저 오류"));
    const supabase = { rpc: () => ({ single: () => Promise.resolve({ data: baseRow(), error: null }) }) };
    requireUserMock.mockResolvedValue({ supabase });

    const result = await respondTeacherAssignmentRequestAction("req1", true);

    expect(result.id).toBe("req1");
  });
});
