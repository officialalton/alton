// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./staff-student-view-actions", () => ({
  loadStaffViewBoardCardsAction: vi.fn(async () => [
    { id: "t1", sourceType: "manual", title: "수동 할 일", status: "backlog", dueAt: null, dueStartAt: null, href: null },
  ]),
  loadStaffViewStatsAction: vi.fn(async () => ({ attendanceRate: null, satisfactionAvg: null, bySubject: [] })),
  recordStaffStudentViewAction: vi.fn(async () => undefined),
}));
vi.mock("@/app/components/ViewerTimezoneProvider", () => ({ useViewerTimezone: () => "Asia/Seoul" }));

import StaffStudentViews from "./StaffStudentViews";
import { recordStaffStudentViewAction } from "./staff-student-view-actions";

describe("StaffStudentViews", () => {
  it("보드는 읽기 전용(이동·삭제 버튼 없음)이고 탭 전환을 감사 기록한다", async () => {
    render(<StaffStudentViews studentId="s1" />);
    await waitFor(() => expect(recordStaffStudentViewAction).toHaveBeenCalledWith("s1", "overview"));
    fireEvent.click(screen.getByRole("tab", { name: "보드" }));
    await screen.findByText("수동 할 일");
    expect(screen.queryByRole("button", { name: /삭제|이동|완료/ })).toBeNull();
    expect(recordStaffStudentViewAction).toHaveBeenCalledWith("s1", "board");
    fireEvent.click(screen.getByRole("tab", { name: "통계" }));
    await screen.findByText("수업 참여율");
  });
});
