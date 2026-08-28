import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumView from "./CurriculumView";
import * as memoActions from "./memo-actions";
import type { CurriculumData } from "./curriculum-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./memo-actions", () => ({
  addMemo: vi.fn(),
}));

const data: CurriculumData = {
  enrollmentId: "e1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  teacherName: "박서연",
  totalSessions: 12,
  currentSession: 8,
  units: [
    {
      position: 1,
      unitTitle: "함수의 기초",
      note: null,
      teacherComment: null,
      status: "done",
      sessionId: "s1",
      scheduledAt: "2026-07-01T05:00:00.000Z",
    },
    {
      position: 8,
      unitTitle: "이차방정식 응용",
      note: "실수 유형 집중",
      teacherComment: null,
      status: "in_progress",
      sessionId: "s8",
      scheduledAt: "2026-09-01T05:00:00.000Z",
    },
    {
      position: 9,
      unitTitle: "함수의 합성",
      note: null,
      teacherComment: null,
      status: "upcoming",
      sessionId: null,
      scheduledAt: null,
    },
  ],
};

describe("CurriculumView", () => {
  it("단원별 상태 배지를 보여준다", () => {
    render(
      <CurriculumView
        data={data}
        initialMemos={[]}
        onBack={vi.fn()}
        onReview={vi.fn()}
      />
    );
    expect(screen.getByText("8 / 12회차")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("예정")).toBeInTheDocument();
  });

  it("완료된 회차에만 리뷰 보기 버튼이 있다", () => {
    render(
      <CurriculumView
        data={data}
        initialMemos={[]}
        onBack={vi.fn()}
        onReview={vi.fn()}
      />
    );
    expect(screen.getAllByText("리뷰 보기")).toHaveLength(1);
  });

  it("메모를 추가할 수 있다", async () => {
    vi.mocked(memoActions.addMemo).mockResolvedValue({
      id: "m1",
      authorRole: "student",
      text: "이해했어요",
      createdAt: "2026-08-28T00:00:00.000Z",
    });
    render(
      <CurriculumView
        data={data}
        initialMemos={[]}
        onBack={vi.fn()}
        onReview={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("메모를 남겨보세요"), {
      target: { value: "이해했어요" },
    });
    fireEvent.click(screen.getByText("추가"));
    await waitFor(() =>
      expect(memoActions.addMemo).toHaveBeenCalledWith("e1", "이해했어요")
    );
    await waitFor(() => expect(screen.getByText("이해했어요")).toBeInTheDocument());
  });

  it("readOnly면 메모 입력창이 안 보인다", () => {
    render(
      <CurriculumView
        data={data}
        initialMemos={[{ id: "m1", authorRole: "teacher", text: "잘하고 있어요", createdAt: "2026-08-01T00:00:00.000Z" }]}
        onBack={vi.fn()}
        onReview={vi.fn()}
        readOnly
      />
    );
    expect(screen.getByText("잘하고 있어요")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("메모를 남겨보세요")).not.toBeInTheDocument();
    expect(screen.queryByText("추가")).not.toBeInTheDocument();
  });
});
