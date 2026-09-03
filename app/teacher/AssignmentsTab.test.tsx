import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AssignmentsTab from "./AssignmentsTab";
import type { TeacherAssignedSubject } from "./assignments-data";
import {
  requestOwnTerminationAsTeacher,
  listMyTerminationRequests,
  listMyTeachingHistoryForSubject,
} from "./teacher-assignment-termination-actions";

vi.mock("./teacher-assignment-termination-actions", () => ({
  requestOwnTerminationAsTeacher: vi.fn(),
  listMyTerminationRequests: vi.fn(),
  listMyTeachingHistoryForSubject: vi.fn(),
}));

const current: TeacherAssignedSubject[] = [
  {
    assignmentId: "ta1",
    subjectEnrollmentId: "se1",
    studentId: "st1",
    studentName: "김학생",
    subjectId: "sub1",
    subjectName: "SAT Math",
    status: "active",
    effectiveFrom: "2026-08-01T00:00:00Z",
    effectiveUntil: null,
  },
];

describe("AssignmentsTab — M3 배정 종료 요청/과거 이력", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listMyTerminationRequests as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("선생님은 종료를 '요청'만 할 수 있고, 확정 처리 버튼은 존재하지 않는다", async () => {
    (requestOwnTerminationAsTeacher as ReturnType<typeof vi.fn>).mockResolvedValue({ requestId: "req1" });
    render(<AssignmentsTab current={current} past={[]} />);

    fireEvent.click(await screen.findByText("배정 종료 요청"));
    fireEvent.change(screen.getByPlaceholderText("종료 요청 사유"), {
      target: { value: "이직 예정" },
    });
    fireEvent.click(screen.getByText("요청 제출 (관리자만 확정 가능)"));

    await waitFor(() =>
      expect(requestOwnTerminationAsTeacher).toHaveBeenCalledWith({
        subjectEnrollmentId: "se1",
        teacherAssignmentId: "ta1",
        reason: "이직 예정",
      })
    );
    // "처리", "확정", "종료" 등 직접 종료를 실행하는 버튼은 이 화면에 존재하지 않는다 —
    // 확정 처리는 app/admin/teacher-assignment-termination-actions.ts에만 있다.
    expect(screen.queryByText(/확정 처리/)).toBeNull();
  });

  it("이미 요청이 있으면 폼 대신 상태만 보여준다(중복 제출 방지)", async () => {
    (listMyTerminationRequests as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "req1", status: "requested", subjectEnrollmentId: "se1" },
    ]);
    render(<AssignmentsTab current={current} past={[]} />);
    await screen.findByText(/요청됨 — 관리자 확인 대기/);
    expect(screen.queryByText("배정 종료 요청")).toBeNull();
  });

  it("과거 수업 이력 펼치면 날짜·유형·상태만 보이고 민감 정보는 없다", async () => {
    (listMyTeachingHistoryForSubject as ReturnType<typeof vi.fn>).mockResolvedValue([
      { sessionId: "s1", startsAt: "2026-08-10T00:00:00Z", endsAt: "2026-08-10T01:00:00Z", finalStatus: "completed", lessonTypeName: "정규" },
    ]);
    render(<AssignmentsTab current={current} past={[]} />);
    const details = await screen.findByText("과거 수업 이력 보기");
    fireEvent.click(details);

    await screen.findByText(/completed/);
    // 시급/정산, Smart Notes, 내부 메모 관련 문구가 화면에 전혀 없어야 한다.
    expect(screen.queryByText(/시급|정산|Smart Notes|내부 메모/)).toBeNull();
  });
});
