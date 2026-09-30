// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("./staff-student-view-actions", () => ({
  loadStaffViewBoardCardsAction: vi.fn(async () => ({
    ok: true,
    cards: [{ id: "t1", sourceType: "manual", title: "수동 할 일", status: "backlog", dueAt: null, dueStartAt: null, href: null }],
    access: access.current,
  })),
  loadStaffViewStatsAction: vi.fn(async () => ({ attendanceRate: null, satisfactionAvg: null, bySubject: [] })),
  recordStaffStudentViewAction: vi.fn(async () => undefined),
  createStudentViewTaskAction: vi.fn(async () => undefined),
  updateStudentViewTaskStatusAction: vi.fn(async () => undefined),
  deleteStudentViewTaskAction: vi.fn(async () => undefined),
}));
vi.mock("@/app/components/ViewerTimezoneProvider", () => ({ useViewerTimezone: () => "Asia/Seoul" }));

import StaffStudentViews from "./StaffStudentViews";
import { recordStaffStudentViewAction, createStudentViewTaskAction } from "./staff-student-view-actions";

const ALL = ["overview", "board", "stats"];
beforeEach(() => vi.clearAllMocks());

describe("StaffStudentViews", () => {
  it("관리자(읽기 전용): 이동·삭제·추가 UI 없음, 탭 전환을 감사 기록한다", async () => {
    access.current = { role: "admin", actions: [], tabs: ALL, audit: true };
    render(<StaffStudentViews studentId="s1" />);
    await waitFor(() => expect(recordStaffStudentViewAction).toHaveBeenCalledWith("s1", "overview"));
    fireEvent.click(await screen.findByRole("tab", { name: "보드" }));
    await screen.findByText("수동 할 일");
    expect(screen.queryByRole("button", { name: /삭제|이동|완료|추가/ })).toBeNull();
    expect(recordStaffStudentViewAction).toHaveBeenCalledWith("s1", "board");
    fireEvent.click(screen.getByRole("tab", { name: "통계" }));
    await screen.findByText("수업 참여율");
  });

  it("선생님: 할 일 추가 폼만(이동·삭제 없음), 통계 탭 없음", async () => {
    access.current = { role: "teacher", actions: ["create"], tabs: ["overview", "board"], audit: true };
    render(<StaffStudentViews studentId="s1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "보드" }));
    expect(screen.queryByRole("tab", { name: "통계" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("+ 할 일 추가"), { target: { value: "새 할 일" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(createStudentViewTaskAction).toHaveBeenCalledWith("s1", "새 할 일"));
    expect(screen.queryByRole("button", { name: /삭제/ })).toBeNull();
  });

  it("학부모: 읽기 전용, 통계 탭 없음, 열람 기록을 남기지 않는다", async () => {
    access.current = { role: "parent", actions: [], tabs: ["overview", "board"], audit: false };
    render(<StaffStudentViews studentId="s1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "보드" }));
    await screen.findByText("수동 할 일");
    expect(screen.queryByRole("tab", { name: "통계" })).toBeNull();
    expect(screen.queryByPlaceholderText("+ 할 일 추가")).toBeNull();
    expect(recordStaffStudentViewAction).not.toHaveBeenCalled();
  });

  it("추가 탭(extraTabs)은 같은 탭 줄에 붙는다", async () => {
    access.current = { role: "consultant", actions: ["create", "move", "delete"], tabs: ALL, audit: true };
    render(<StaffStudentViews studentId="s1" extraTabs={[{ id: "roadmap", label: "Roadmap", render: () => <p>로드맵 본문</p> }]} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Roadmap" }));
    await screen.findByText("로드맵 본문");
  });
});
