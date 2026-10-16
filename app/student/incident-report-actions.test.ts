import { describe, expect, it, vi, beforeEach } from "vitest";

// 계획 문서 4절 P1: reportTeacherIssue는 session_incident_reports에 대한
// RLS(세션 당사자/관리자만 INSERT 가능)에 실제 권한 게이트를 위임하고,
// report_type='teacher_late'일 때 minutes_late 필수 여부는 앱 검증(lib/booking
// /incident-reports.ts)과 DB CHECK 제약이 이중으로 강제한다. 이 테스트는
// (1) 정상 경로가 인증된 사용자 id를 reported_by로 정확히 전달하는지
// (2026-09-09 발견·수정된 버그: reported_by가 NOT NULL인데 이전에는 전혀
// 채워지지 않아 매 호출이 실패했었다), (2) RLS 거부가 예외로 그대로
// 전파되는지, (3) 잘못된 입력(teacher_late인데 minutesLate 누락)이 DB
// 호출 전에 거부되는지를 검증한다.

const insertMock = vi.fn();
const supabaseMock = { from: () => ({ insert: insertMock }) };

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "student1" }, supabase: supabaseMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
});

describe("reportTeacherIssue", () => {
  it("정상 입력이면 인증된 사용자 id를 reported_by로 채워 insert한다(정상 경로, reported_by 미기록 버그 회귀)", async () => {
    const { reportTeacherIssue } = await import("./incident-report-actions");
    await reportTeacherIssue({ sessionId: "s1", reportType: "teacher_late", minutesLate: 12 });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", report_type: "teacher_late", reported_by: "student1", minutes_late: 12 })
    );
  });

  it("teacher_late인데 minutesLate가 없으면 DB 호출 없이 거부한다(잘못된 입력)", async () => {
    const { reportTeacherIssue } = await import("./incident-report-actions");
    await expect(
      reportTeacherIssue({ sessionId: "s1", reportType: "teacher_late" })
    ).rejects.toThrow("선생님 지각 신고는 지각 시간(분)이 필요합니다.");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("RLS(세션 당사자/관리자만 신고 가능)가 거부하면 예외가 그대로 전파된다(권한 거부)", async () => {
    insertMock.mockResolvedValue({
      error: { message: "new row violates row-level security policy for table \"session_incident_reports\"" },
    });
    const { reportTeacherIssue } = await import("./incident-report-actions");
    await expect(
      reportTeacherIssue({ sessionId: "other-session", reportType: "teacher_no_show_reported" })
    ).rejects.toThrow(/row-level security/);
  });
});
