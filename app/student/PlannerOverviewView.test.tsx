import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlannerOverviewView from "./PlannerOverviewView";
import { loadMyBoardCardsAction } from "./board-actions";
import type { BoardCard } from "@/lib/board/types";

vi.mock("./board-actions", () => ({
  loadMyBoardCardsAction: vi.fn(),
}));

describe("PlannerOverviewView", () => {
  it("칼럼별·소스별 개수와 완료율을 계산해 보여준다", async () => {
    const cards: BoardCard[] = [
      { id: "a", sourceType: "homework", sourceId: "a", title: "과제1", subtitle: null, status: "done", dueAt: null, dueStartAt: null, href: null, createdByLabel: "담당 선생님" },
      { id: "b", sourceType: "mock_exam", sourceId: "b", title: "모의고사1", subtitle: null, status: "backlog", dueAt: null, dueStartAt: null, href: null, createdByLabel: "담당 선생님" },
      { id: "c", sourceType: "manual", sourceId: "c", title: "할일1", subtitle: null, status: "in_progress", dueAt: null, dueStartAt: null, href: null, createdByLabel: "학생 본인" },
      { id: "d", sourceType: "vocab_quiz", sourceId: "d", title: "단어시험1", subtitle: null, status: "backlog", dueAt: "2020-01-01T00:00:00Z", dueStartAt: null, href: null, createdByLabel: "학생 본인" },
    ];
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
    render(<PlannerOverviewView />);

    expect(await screen.findByText("전체 완료율")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("(1/4)")).toBeInTheDocument();
    expect(screen.getByText("과제")).toBeInTheDocument();
    expect(screen.getByText("단어시험")).toBeInTheDocument();
  });

  it("카드가 없으면 완료율은 빈 값(—)이다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<PlannerOverviewView />);
    await screen.findByText("전체 완료율");
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
