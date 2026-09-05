import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EnrollmentTab from "./EnrollmentTab";
import { getTrialLessonReviewForFamily } from "@/app/parent/trial-conversion-actions";
import type { SubjectEnrollmentView } from "./enrollment-data";

vi.mock("@/app/parent/trial-conversion-actions", () => ({
  getTrialLessonReviewForFamily: vi.fn(),
}));

const enrollment: SubjectEnrollmentView = {
  id: "se1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  status: "active",
  currentTeacher: { id: "a1", teacherId: "t1", teacherName: "박서연 선생님", status: "active", effectiveFrom: "2026-08-01T00:00:00Z", effectiveUntil: null, reason: null },
  upcomingTeacherChange: null,
  history: [],
};

// M4 UI 폴리싱 — 학생/보호자 공용 화면에는 확정된 체험 리뷰만 노출하고, 계약·
// 구매·정규 진행 희망 버튼 같은 보호자 전용 행동은 절대 섞여 보이지 않아야 한다
// (그건 app/parent/TrialConversionPanel.tsx만의 역할).
describe("EnrollmentTab — 확정 체험 리뷰 표시(학생/보호자 공용)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("확정된 리뷰가 없으면 리뷰 버튼 자체를 보여주지 않는다", async () => {
    (getTrialLessonReviewForFamily as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    render(<EnrollmentTab enrollments={[enrollment]} />);
    await waitFor(() => expect(getTrialLessonReviewForFamily).toHaveBeenCalledWith("se1"));
    expect(screen.queryByText("체험 수업 리뷰 보기")).toBeNull();
    expect(screen.queryByText("체험 수업 리뷰 (선생님 확정)")).toBeNull();
  });

  it("확정된 리뷰만 버튼을 눌러야 보여주고, 카테고리별 의견 + 정규 진행 희망 같은 보호자 전용 버튼은 없다", async () => {
    (getTrialLessonReviewForFamily as ReturnType<typeof vi.fn>).mockResolvedValue({
      reviewId: "r1",
      finalText: "기초 개념 이해도 우수",
      aiSummary: null,
      finalizedAt: "2026-09-03T00:00:00Z",
      categoryNotes: [{ key: "comprehension", label: "이해도", note: "빠른 습득력" }],
    });
    render(<EnrollmentTab enrollments={[enrollment]} />);

    const toggle = await screen.findByText("체험 수업 리뷰 보기");
    expect(screen.queryByText("기초 개념 이해도 우수")).toBeNull();
    fireEvent.click(toggle);

    expect(await screen.findByText("기초 개념 이해도 우수")).toBeInTheDocument();
    expect(screen.getByText("체험 수업 리뷰 (선생님 확정)")).toBeInTheDocument();
    expect(screen.getByText("빠른 습득력")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "정규 진행 희망합니다" })).toBeNull();
  });
});
