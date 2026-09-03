import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnifiedScheduleTab from "./UnifiedScheduleTab";
import * as actions from "./booking-actions";

vi.mock("./booking-actions", () => ({
  listAllTeacherLessons: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnifiedScheduleTab", () => {
  it("예약이 없으면 안내 문구를 보여준다", async () => {
    vi.mocked(actions.listAllTeacherLessons).mockResolvedValue([]);
    render(<UnifiedScheduleTab />);
    await waitFor(() => expect(screen.getByText("해당 범위에 예약이 없습니다.")).toBeInTheDocument());
  });

  it("선생님 필터를 적용하면 다른 선생님의 예약이 숨겨진다", async () => {
    const today = new Date().toISOString();
    vi.mocked(actions.listAllTeacherLessons).mockResolvedValue([
      {
        reservationId: "r1", sessionId: "s1", teacherId: "t1", teacherName: "김선생",
        studentName: "지훈", subjectName: "SAT Math", startsAt: today, endsAt: today,
        status: "confirmed", googleSyncStatus: "synced", externalChangeStatus: "none",
      },
      {
        reservationId: "r2", sessionId: "s2", teacherId: "t2", teacherName: "이선생",
        studentName: "서아", subjectName: "AP Calc", startsAt: today, endsAt: today,
        status: "confirmed", googleSyncStatus: "synced", externalChangeStatus: "none",
      },
    ]);
    render(<UnifiedScheduleTab />);
    await waitFor(() => expect(screen.getByText(/김선생 선생님/)).toBeInTheDocument());
    expect(screen.getByText(/이선생 선생님/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("전체 선생님"), { target: { value: "김선생" } });
    expect(screen.getByText(/김선생 선생님/)).toBeInTheDocument();
    expect(screen.queryByText(/이선생 선생님/)).not.toBeInTheDocument();
  });

  it("외부 변경이 감지된 예약에는 확인 필요 배지가 보인다", async () => {
    const today = new Date().toISOString();
    vi.mocked(actions.listAllTeacherLessons).mockResolvedValue([
      {
        reservationId: "r1", sessionId: "s1", teacherId: "t1", teacherName: "김선생",
        studentName: "지훈", subjectName: "SAT Math", startsAt: today, endsAt: today,
        status: "confirmed", googleSyncStatus: "synced", externalChangeStatus: "time_changed",
      },
    ]);
    render(<UnifiedScheduleTab />);
    await waitFor(() => expect(screen.getByText("외부 변경 감지·확인 필요")).toBeInTheDocument());
  });
});
