import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeTab from "./HomeTab";
import {
  loadMyBoardCardsAction,
  createMyManualTaskAction,
  updateMyManualTaskStatusAction,
  deleteMyManualTaskAction,
} from "./board-actions";
import type { DashboardData } from "./dashboard-data";
import type { BoardCard } from "@/lib/board/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./board-actions", () => ({
  loadMyBoardCardsAction: vi.fn(),
  createMyManualTaskAction: vi.fn(),
  updateMyManualTaskStatusAction: vi.fn(),
  deleteMyManualTaskAction: vi.fn(),
}));

vi.mock("./review-actions", () => ({
  getMyLessonReviewsAction: vi.fn().mockResolvedValue([]),
}));

const dashboard: DashboardData = {
  studentName: "지훈",
  upcoming: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 8,
  attendanceRate: null,
};

const cards: BoardCard[] = [
  { id: "homework:h1", sourceType: "homework", sourceId: "h1", title: "9월 과제", subtitle: null, status: "backlog", dueAt: null, dueStartAt: null, href: "/student?tab=homework", createdByLabel: "담당 선생님" },
  { id: "m1", sourceType: "manual", sourceId: "m1", title: "완료된 할일", subtitle: null, status: "done", dueAt: null, dueStartAt: null, href: null, createdByLabel: "학생 본인" },
];

describe("HomeTab — Home+Planner 통합(2026-09-22 사용자 지시)", () => {
  it("Overview가 기본이고, TODO/Review로 전환된다(Lesson은 Classes '수업 일정'으로 옮겨짐, Done은 별도 탭 없이 보드 완료 칼럼)", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
    render(<HomeTab studentName="지훈" dashboard={dashboard} />);

    expect(await screen.findByText("전체 완료율")).toBeInTheDocument();
    expect(screen.queryByText("Lesson")).toBeNull();
    expect(screen.queryByText("Done")).toBeNull();

    fireEvent.click(screen.getByText("TODO"));
    expect(await screen.findByText("9월 과제")).toBeInTheDocument();
    expect(await screen.findByText("완료된 할일")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Review"));
    expect(await screen.findByText("수업 리뷰")).toBeInTheDocument();
  });

  it("TODO에서 할 일을 추가/이동/삭제할 수 있다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const newCard: BoardCard = { id: "m2", sourceType: "manual", sourceId: "m2", title: "에세이 작성", subtitle: null, status: "backlog", dueAt: null, dueStartAt: null, href: null, createdByLabel: "학생 본인" };
    (createMyManualTaskAction as ReturnType<typeof vi.fn>).mockResolvedValue(newCard);
    (updateMyManualTaskStatusAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (deleteMyManualTaskAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<HomeTab studentName="지훈" dashboard={dashboard} />);
    fireEvent.click(await screen.findByText("TODO"));

    fireEvent.change(screen.getByPlaceholderText("+ 할 일 추가"), { target: { value: "에세이 작성" } });
    fireEvent.click(screen.getByText("추가"));
    expect(await screen.findByText("에세이 작성")).toBeInTheDocument();

    fireEvent.click(screen.getByText("완료로"));
    await waitFor(() => expect(updateMyManualTaskStatusAction).toHaveBeenCalledWith("m2", "done"));
  });
});
