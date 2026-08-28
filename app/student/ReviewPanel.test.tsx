import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReviewPanel from "./ReviewPanel";
import * as reviewActions from "./review-actions";
import type { ReviewData } from "./review-data";

vi.mock("./review-actions", () => ({
  submitStudentFeedback: vi.fn().mockResolvedValue(undefined),
}));

const review: ReviewData = {
  sessionId: "s1",
  teacherSummary: "이번 회차는 판별식 개념을 다뤘습니다.",
  strength: "계산이 정확합니다.",
  improve: "실수 유형에 취약합니다.",
  nextPlan: "실전 문제를 더 풀어봅니다.",
  submittedAt: "2026-08-01T05:00:00.000Z",
  categories: [{ category: "concept", finalText: "개념 이해도가 높습니다." }],
};

describe("ReviewPanel", () => {
  it("리뷰가 없으면 안내 문구를 보여준다", () => {
    render(
      <ReviewPanel sessionId="s1" review={null} myFeedback={null} onBack={vi.fn()} />
    );
    expect(
      screen.getByText("아직 선생님이 리포트를 작성하지 않았습니다.")
    ).toBeInTheDocument();
  });

  it("리뷰 내용을 전부 보여준다", () => {
    render(
      <ReviewPanel sessionId="s1" review={review} myFeedback={null} onBack={vi.fn()} />
    );
    expect(screen.getByText(review.teacherSummary!)).toBeInTheDocument();
    expect(screen.getByText(review.strength!)).toBeInTheDocument();
    expect(screen.getByText("개념 이해도가 높습니다.")).toBeInTheDocument();
  });

  it("별점을 매기고 피드백을 제출할 수 있다", async () => {
    render(
      <ReviewPanel sessionId="s1" review={review} myFeedback={null} onBack={vi.fn()} />
    );
    const stars = screen.getAllByText("⭐");
    fireEvent.click(stars[3]);
    fireEvent.click(screen.getByText("제출하기"));
    await waitFor(() =>
      expect(reviewActions.submitStudentFeedback).toHaveBeenCalledWith("s1", 4, "")
    );
  });
});
