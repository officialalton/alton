import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParentPlannerTab from "./ParentPlannerTab";
import { loadChildBoardCardsAction } from "./board-actions";
import type { BoardCard } from "@/lib/board/types";

vi.mock("./board-actions", () => ({
  loadChildBoardCardsAction: vi.fn(),
}));

describe("ParentPlannerTab", () => {
  it("자녀를 선택하지 않았으면 안내 문구만 보여준다", () => {
    render(<ParentPlannerTab studentId={null} />);
    expect(screen.getByText("자녀를 먼저 선택하세요.")).toBeInTheDocument();
  });

  it("자녀의 보드를 읽기 전용으로 보여준다(이동/삭제 버튼 없음)", async () => {
    const cards: BoardCard[] = [
      { id: "homework:b1", sourceType: "homework", sourceId: "b1", title: "9월 21일 과제", subtitle: "SAT Math", status: "backlog", dueAt: null, href: "/student?tab=homework" },
      { id: "m1", sourceType: "manual", sourceId: "m1", title: "에세이 초안", subtitle: null, status: "in_progress", dueAt: null, href: null },
    ];
    (loadChildBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
    render(<ParentPlannerTab studentId="s1" />);

    expect(await screen.findByText("9월 21일 과제")).toBeInTheDocument();
    expect(screen.getByText("에세이 초안")).toBeInTheDocument();
    expect(loadChildBoardCardsAction).toHaveBeenCalledWith("s1");
    expect(screen.queryByText("완료로")).toBeNull();
    expect(screen.queryByText("삭제")).toBeNull();
  });
});
