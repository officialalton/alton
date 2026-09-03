import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TeacherAssignmentTerminationPanel from "./TeacherAssignmentTerminationPanel";
import {
  listTerminationRequests,
  previewTerminationImpactAction,
  processTerminationRequestAction,
  listSubjectTeachingHistoryForCurrentTeacher,
} from "./teacher-assignment-termination-actions";

vi.mock("./teacher-assignment-termination-actions", () => ({
  listTerminationRequests: vi.fn(),
  previewTerminationImpactAction: vi.fn(),
  processTerminationRequestAction: vi.fn(),
  listSubjectTeachingHistoryForCurrentTeacher: vi.fn(),
}));

const baseRequest = {
  id: "req1",
  subjectEnrollmentId: "se1",
  teacherAssignmentId: "ta1",
  requestedByRole: "teacher",
  requestedBy: "t1",
  reason: "이직",
  status: "requested",
  resolution: null,
  newTeacherId: null,
  effectiveFrom: null,
  error: null,
  createdAt: "2026-09-01T00:00:00Z",
};

describe("TeacherAssignmentTerminationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listSubjectTeachingHistoryForCurrentTeacher as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("요청 목록을 렌더링하고, 영향 미리보기 후 처리 확정을 호출한다", async () => {
    (listTerminationRequests as ReturnType<typeof vi.fn>).mockResolvedValue([baseRequest]);
    (previewTerminationImpactAction as ReturnType<typeof vi.fn>).mockResolvedValue([
      { reservationId: "r1", startsAt: "x", endsAt: "y", hasActiveHold: true },
    ]);
    (processTerminationRequestAction as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "completed" });

    render(<TeacherAssignmentTerminationPanel />);

    await screen.findByText(/요청자: teacher/);
    fireEvent.click(screen.getByText("처리"));

    await waitFor(() => expect(screen.getByText(/영향받는 미래 예약 1건/)).toBeInTheDocument());

    fireEvent.click(screen.getByText("종료 처리 확정"));

    await waitFor(() =>
      expect(processTerminationRequestAction).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req1", resolution: "end_enrollment" })
      )
    );
  });

  it("처리 실패 시 오류 메시지를 보여주고 재처리 버튼을 남긴다", async () => {
    (listTerminationRequests as ReturnType<typeof vi.fn>).mockResolvedValue([baseRequest]);
    (previewTerminationImpactAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (processTerminationRequestAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "failed",
      error: "새 선생님과 시간 충돌",
    });

    render(<TeacherAssignmentTerminationPanel />);
    await screen.findByText(/요청자: teacher/);
    fireEvent.click(screen.getByText("처리"));
    await waitFor(() => screen.getByText("종료 처리 확정"));
    fireEvent.click(screen.getByText("종료 처리 확정"));

    await screen.findByText(/새 선생님과 시간 충돌/);
  });
});
