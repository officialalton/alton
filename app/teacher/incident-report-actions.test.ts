import { describe, expect, it, vi, beforeEach } from "vitest";

// 계획 문서 4절 P1 — app/student/incident-report-actions.test.ts와 동일한 이유로
// reportSessionIssue(선생님 본인 지각/학생 노쇼 신고)도 reported_by 정상 전달과
// RLS 거부 전파를 검증한다(2026-09-09 reported_by 미기록 버그의 선생님 경로 회귀).

const insertMock = vi.fn();
const supabaseMock = { from: () => ({ insert: insertMock }) };

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "teacher1" }, supabase: supabaseMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
});

describe("reportSessionIssue", () => {
  it("정상 입력이면 인증된 선생님 id를 reported_by로 채워 insert한다(정상 경로)", async () => {
    const { reportSessionIssue } = await import("./incident-report-actions");
    await reportSessionIssue({ sessionId: "s1", reportType: "student_no_show_reported" });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", report_type: "student_no_show_reported", reported_by: "teacher1" })
    );
  });

  it("RLS가 거부하면 예외가 그대로 전파된다(권한 거부)", async () => {
    insertMock.mockResolvedValue({ error: { message: "권한이 없습니다" } });
    const { reportSessionIssue } = await import("./incident-report-actions");
    await expect(
      reportSessionIssue({ sessionId: "other-session", reportType: "teacher_late", minutesLate: 5 })
    ).rejects.toThrow("권한이 없습니다");
  });
});
