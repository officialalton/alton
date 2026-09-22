import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AssignmentsTab from "./AssignmentsTab";
import type { TeacherAssignedSubject } from "./assignments-data";
import { requestOwnTerminationAsTeacher, listMyTerminationRequests } from "./teacher-assignment-termination-actions";

vi.mock("./teacher-assignment-termination-actions", () => ({
  requestOwnTerminationAsTeacher: vi.fn(),
  listMyTerminationRequests: vi.fn(),
}));

const current: TeacherAssignedSubject[] = [
  {
    assignmentId: "ta1",
    subjectEnrollmentId: "se1",
    studentId: "st1",
    studentName: "김학생",
    studentGrade: "고2",
    studentPhone: "010-1234-5678",
    subjectId: "sub1",
    subjectName: "SAT Math",
    status: "active",
    effectiveFrom: "2026-08-01T00:00:00Z",
    effectiveUntil: null,
    hasLegacyCurriculum: true,
  },
];

describe("AssignmentsTab — M3 배정 종료 요청 / 2026-09-22 배정 중·종료 서브탭 재구성", () => {
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

  it("배정 중/배정 종료 서브탭이 각자의 목록만 보여준다", () => {
    const past: TeacherAssignedSubject[] = [
      { ...current[0], assignmentId: "ta2", status: "active", effectiveUntil: "2026-09-01T00:00:00Z" },
    ];
    render(<AssignmentsTab current={current} past={past} />);

    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("김학생")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/^배정 종료 \(/));
    // 배정 종료 목록엔 진입 버튼(오버뷰/로드맵/일정/커리큘럼)이 없다.
    expect(screen.queryByText("오버뷰")).toBeNull();
  });

  it("배정 중 카드에 오버뷰/로드맵/일정/커리큘럼 진입 버튼이 있다(커리큘럼은 콜백이 있을 때만)", () => {
    const onOpenOperatingCurriculum = vi.fn();
    render(<AssignmentsTab current={current} past={[]} onOpenOperatingCurriculum={onOpenOperatingCurriculum} />);

    expect(screen.getByText("오버뷰")).toBeInTheDocument();
    expect(screen.getByText("로드맵")).toBeInTheDocument();
    expect(screen.getByText("일정")).toBeInTheDocument();

    fireEvent.click(screen.getByText("커리큘럼"));
    expect(onOpenOperatingCurriculum).toHaveBeenCalledWith("se1", "sub1", "김학생", "SAT Math");
  });

  it("onOpenOperatingCurriculum이 없으면 '커리큘럼' 버튼이 보이지 않는다", () => {
    render(<AssignmentsTab current={current} past={[]} />);
    expect(screen.queryByText("커리큘럼")).toBeNull();
  });
});
