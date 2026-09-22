import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlannerTab from "./PlannerTab";
import { loadMyBoardCardsAction } from "./board-actions";

vi.mock("./board-actions", () => ({
  loadMyBoardCardsAction: vi.fn(async () => []),
  createMyManualTaskAction: vi.fn(),
  updateMyManualTaskStatusAction: vi.fn(),
  deleteMyManualTaskAction: vi.fn(),
}));

describe("PlannerTab", () => {
  it("기본은 보드 서브탭이고, 일정/오버뷰로 전환할 수 있다", async () => {
    render(<PlannerTab />);
    expect(await screen.findByPlaceholderText("+ 할 일 추가")).toBeInTheDocument();

    fireEvent.click(screen.getByText("일정"));
    expect(await screen.findByText("마감일이 있는 항목이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("오버뷰"));
    expect(await screen.findByText("전체 완료율")).toBeInTheDocument();
    expect(loadMyBoardCardsAction).toHaveBeenCalled();
  });
});
