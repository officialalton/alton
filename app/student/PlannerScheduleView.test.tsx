import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlannerScheduleView from "./PlannerScheduleView";
import { loadMyBoardCardsAction } from "./board-actions";
import type { BoardCard } from "@/lib/board/types";

vi.mock("./board-actions", () => ({
  loadMyBoardCardsAction: vi.fn(),
}));

describe("PlannerScheduleView", () => {
  it("마감일이 있는 카드만 날짜순으로 묶어 보여준다", async () => {
    const cards: BoardCard[] = [
      { id: "a", sourceType: "mock_exam", sourceId: "a", title: "테스트 세트 2", subtitle: null, status: "backlog", dueAt: "2026-09-25T00:00:00Z", href: null },
      { id: "b", sourceType: "manual", sourceId: "b", title: "메모 없는 할 일", subtitle: null, status: "backlog", dueAt: null, href: null },
    ];
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
    render(<PlannerScheduleView />);
    expect(await screen.findByText("테스트 세트 2")).toBeInTheDocument();
    expect(screen.getByText(/마감일 없는 항목 1건/)).toBeInTheDocument();
  });

  it("마감일이 지났고 완료되지 않은 카드는 '기한 경과'로 표시된다", async () => {
    const cards: BoardCard[] = [
      { id: "a", sourceType: "homework", sourceId: "a", title: "지난 과제", subtitle: null, status: "backlog", dueAt: "2020-01-01T00:00:00Z", href: null },
    ];
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
    render(<PlannerScheduleView />);
    expect(await screen.findByText("기한 경과")).toBeInTheDocument();
  });

  it("마감일이 있는 항목이 없으면 빈 상태 문구를 보여준다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<PlannerScheduleView />);
    expect(await screen.findByText("마감일이 있는 항목이 없습니다.")).toBeInTheDocument();
  });
});
