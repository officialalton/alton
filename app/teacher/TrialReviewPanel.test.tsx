import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TrialReviewPanel from "./TrialReviewPanel";
import {
  listMyTrialSessionsNeedingReview,
  saveTrialLessonReviewDraft,
  finalizeTrialLessonReview,
} from "./trial-review-actions";

vi.mock("./trial-review-actions", () => ({
  listMyTrialSessionsNeedingReview: vi.fn(),
  saveTrialLessonReviewDraft: vi.fn(),
  finalizeTrialLessonReview: vi.fn(),
}));

const session = {
  sessionId: "s1",
  subjectEnrollmentId: "se1",
  startsAt: "2026-08-01T00:00:00Z",
  finalStatus: "completed",
  reviewStatus: "none" as const,
  draftText: null,
};

describe("TrialReviewPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("확정하지 않은 리뷰가 없으면 아무것도 렌더링하지 않는다", async () => {
    (listMyTrialSessionsNeedingReview as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { container } = render(<TrialReviewPanel />);
    await waitFor(() => expect(listMyTrialSessionsNeedingReview).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("미리보기는 고객 화면에 보일 문구를 그대로 보여주고, 초안 저장 전에는 확정 버튼이 비활성화된다", async () => {
    (listMyTrialSessionsNeedingReview as ReturnType<typeof vi.fn>).mockResolvedValue([session]);
    render(<TrialReviewPanel />);

    const textarea = await screen.findByLabelText("고객에게 보여줄 체험 리뷰");
    expect(screen.getByRole("button", { name: "공개 확정" })).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "기초 개념 이해도 우수" } });
    fireEvent.click(screen.getByRole("button", { name: "고객 화면 미리보기" }));

    expect(screen.getByText("보호자·학생 화면에는 이렇게 보입니다")).toBeInTheDocument();
    expect(screen.getAllByText("기초 개념 이해도 우수").length).toBeGreaterThanOrEqual(1);
  });

  it("공개 확정은 인라인 확인을 거친 뒤에만 finalize를 호출한다(원클릭 즉시 공개 아님)", async () => {
    (listMyTrialSessionsNeedingReview as ReturnType<typeof vi.fn>).mockResolvedValue([session]);
    (finalizeTrialLessonReview as ReturnType<typeof vi.fn>).mockResolvedValue({ reviewId: "r1" });

    render(<TrialReviewPanel />);
    const textarea = await screen.findByLabelText("고객에게 보여줄 체험 리뷰");
    fireEvent.change(textarea, { target: { value: "리뷰 내용" } });

    fireEvent.click(screen.getByRole("button", { name: "공개 확정" }));
    expect(finalizeTrialLessonReview).not.toHaveBeenCalled();
    expect(screen.getByText(/계속할까요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "네, 공개합니다" }));
    await waitFor(() => expect(finalizeTrialLessonReview).toHaveBeenCalledWith({ sessionId: "s1", finalText: "리뷰 내용" }));
  });

  it("초안 저장 실패 시 에러 메시지를 보여준다", async () => {
    (listMyTrialSessionsNeedingReview as ReturnType<typeof vi.fn>).mockResolvedValue([session]);
    (saveTrialLessonReviewDraft as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("저장 실패 테스트"));

    render(<TrialReviewPanel />);
    const textarea = await screen.findByLabelText("고객에게 보여줄 체험 리뷰");
    fireEvent.change(textarea, { target: { value: "내용" } });
    fireEvent.click(screen.getByRole("button", { name: "초안 저장(비공개)" }));

    await screen.findByText("저장 실패 테스트");
  });
});
