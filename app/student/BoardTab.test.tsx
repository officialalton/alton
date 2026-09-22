import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BoardTab from "./BoardTab";
import {
  loadMyBoardCardsAction,
  createMyManualTaskAction,
  updateMyManualTaskStatusAction,
  deleteMyManualTaskAction,
} from "./board-actions";
import type { BoardCard } from "@/lib/board/types";

vi.mock("./board-actions", () => ({
  loadMyBoardCardsAction: vi.fn(),
  createMyManualTaskAction: vi.fn(),
  updateMyManualTaskStatusAction: vi.fn(),
  deleteMyManualTaskAction: vi.fn(),
}));

const homeworkCard: BoardCard = {
  id: "homework:b1", sourceType: "homework", sourceId: "b1",
  title: "9월 22일 과제", subtitle: "SAT Math", status: "backlog", dueAt: null, href: "/student?tab=homework",
};
const manualCard: BoardCard = {
  id: "m1", sourceType: "manual", sourceId: "m1",
  title: "에세이 초안 쓰기", subtitle: null, status: "backlog", dueAt: null, href: null,
};

describe("BoardTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("카드를 소스별 칼럼(백로그/진행중/완료)에 나눠 보여준다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([homeworkCard, manualCard]);
    render(<BoardTab />);
    expect(await screen.findByText("9월 22일 과제")).toBeInTheDocument();
    expect(screen.getByText("에세이 초안 쓰기")).toBeInTheDocument();
    expect(screen.getByText("백로그")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("기한 경과")).toBeInTheDocument();
  });

  it("과제·모의고사 등 자동 카드에는 이동 버튼이 없고, 수동 할 일에만 상태 이동/삭제가 있다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([homeworkCard, manualCard]);
    render(<BoardTab />);
    await screen.findByText("9월 22일 과제");
    expect(screen.getAllByText("진행중으로").length).toBe(1);
    expect(screen.getByText("삭제")).toBeInTheDocument();
  });

  it("할 일을 추가하면 목록에 즉시 반영된다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const newCard: BoardCard = { id: "m2", sourceType: "manual", sourceId: "m2", title: "SAT 신청서 작성", subtitle: null, status: "backlog", dueAt: null, href: null };
    (createMyManualTaskAction as ReturnType<typeof vi.fn>).mockResolvedValue(newCard);
    render(<BoardTab />);
    await waitFor(() => expect(loadMyBoardCardsAction).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("+ 할 일 추가"), { target: { value: "SAT 신청서 작성" } });
    fireEvent.click(screen.getByText("추가"));

    await waitFor(() => expect(createMyManualTaskAction).toHaveBeenCalledWith("SAT 신청서 작성"));
    expect(await screen.findByText("SAT 신청서 작성")).toBeInTheDocument();
  });

  it("완료로 옮기면 updateMyManualTaskStatusAction이 호출되고 카드가 완료 칼럼으로 이동한다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([manualCard]);
    (updateMyManualTaskStatusAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    render(<BoardTab />);
    await screen.findByText("에세이 초안 쓰기");

    fireEvent.click(screen.getByText("완료로"));
    await waitFor(() => expect(updateMyManualTaskStatusAction).toHaveBeenCalledWith("m1", "done"));
  });

  it("삭제 버튼을 누르면 deleteMyManualTaskAction이 호출되고 카드가 사라진다", async () => {
    (loadMyBoardCardsAction as ReturnType<typeof vi.fn>).mockResolvedValue([manualCard]);
    (deleteMyManualTaskAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    render(<BoardTab />);
    await screen.findByText("에세이 초안 쓰기");

    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() => expect(deleteMyManualTaskAction).toHaveBeenCalledWith("m1"));
    await waitFor(() => expect(screen.queryByText("에세이 초안 쓰기")).toBeNull());
  });
});
