import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TrialConversionPanel from "./TrialConversionPanel";
import { getTrialLessonReviewForFamily, confirmRegularProgressIntent } from "./trial-conversion-actions";
import type { SubjectEnrollmentView } from "@/app/student/enrollment-data";

vi.mock("./trial-conversion-actions", () => ({
  getTrialLessonReviewForFamily: vi.fn(),
  confirmRegularProgressIntent: vi.fn(),
}));

const enrollment = { id: "se1", subjectName: "SAT Math" } as SubjectEnrollmentView;

describe("TrialConversionPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("확정된 리뷰가 없으면 정규 진행 희망 단계를 보여주지 않는다(리뷰 미확정 시 진행 차단)", async () => {
    (getTrialLessonReviewForFamily as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { container } = render(<TrialConversionPanel enrollments={[enrollment]} />);
    await waitFor(() => expect(getTrialLessonReviewForFamily).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("확정된 리뷰가 있으면 계약 체결이 아니라는 안내와 함께 정규 진행 희망 버튼을 보여준다", async () => {
    (getTrialLessonReviewForFamily as ReturnType<typeof vi.fn>).mockResolvedValue({
      reviewId: "r1",
      finalText: "우수",
      finalizedAt: "2026-09-03T00:00:00Z",
    });
    render(<TrialConversionPanel enrollments={[enrollment]} />);

    await screen.findByText(/계약 체결이나 결제가 아니며/);
    expect(screen.getByRole("button", { name: "정규 진행 희망합니다" })).toBeInTheDocument();
  });

  it("정규 진행 희망 클릭 후에는 접수 완료 안내로 바뀌고 중복 클릭이 불가능하다", async () => {
    (getTrialLessonReviewForFamily as ReturnType<typeof vi.fn>).mockResolvedValue({
      reviewId: "r1",
      finalText: "우수",
      finalizedAt: "2026-09-03T00:00:00Z",
    });
    (confirmRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue({ selectionId: "sel1" });

    render(<TrialConversionPanel enrollments={[enrollment]} />);
    const button = await screen.findByRole("button", { name: "정규 진행 희망합니다" });
    fireEvent.click(button);

    await screen.findByText(/접수 완료/);
    expect(screen.queryByRole("button", { name: "정규 진행 희망합니다" })).toBeNull();
    expect(confirmRegularProgressIntent).toHaveBeenCalledTimes(1);
  });
});
