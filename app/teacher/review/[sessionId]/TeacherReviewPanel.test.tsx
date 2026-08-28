import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherReviewPanel from "./TeacherReviewPanel";
import * as actions from "./review-actions";
import type { ExistingReview, SessionReviewContext } from "./review-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("./review-actions", () => ({
  generateReviewDraft: vi.fn(),
  submitReview: vi.fn(),
}));

const context: SessionReviewContext = {
  sessionId: "s1",
  studentName: "지훈",
  subjectName: "SAT Math",
  sessionNumber: 8,
  unitTitle: "이차방정식 응용 문제 심화",
  note: null,
  teacherComment: "보강 세션",
  homeworkItems: [{ title: "이차방정식 5문제", graded: true, score: "4/5" }],
};

describe("TeacherReviewPanel", () => {
  it("과목/회차 정보와 4개 카테고리를 보여준다", () => {
    render(<TeacherReviewPanel context={context} existingReview={null} />);
    expect(screen.getByText(/지훈 · SAT Math · 8회차/)).toBeInTheDocument();
    ["개념 이해도", "문제 해결 능력", "수업 참여도", "과제 수행도"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it("AI 초안 전체 생성을 누르면 모든 필드가 채워진다", async () => {
    vi.mocked(actions.generateReviewDraft).mockResolvedValue({
      teacherSummary: "이번 수업은 전반적으로 좋았습니다.",
      strength: "이차방정식 풀이 속도가 빨라졌어요.",
      improve: "실수 유형 복습이 필요합니다.",
      nextPlan: "다음 회차는 함수 합성을 다룹니다.",
      categories: {
        concept: "개념을 잘 이해했습니다.",
        problemsolving: "응용 문제 해결력이 향상되었습니다.",
        participation: "적극적으로 참여했습니다.",
        homework: "과제를 성실히 수행했습니다.",
      },
    });
    render(<TeacherReviewPanel context={context} existingReview={null} />);
    fireEvent.click(screen.getByText("✨ AI 초안 전체 생성"));
    await waitFor(() =>
      expect(screen.getByDisplayValue("이번 수업은 전반적으로 좋았습니다.")).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue("개념을 잘 이해했습니다.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("과제를 성실히 수행했습니다.")).toBeInTheDocument();
  });

  it("기존 리뷰가 있으면 기존 값으로 채워서 보여준다", () => {
    const existingReview: ExistingReview = {
      teacherSummary: "저번 총평",
      strength: "저번 강점",
      improve: "저번 보완점",
      nextPlan: "저번 계획",
      submittedAt: "2026-08-20T00:00:00.000Z",
      categories: {
        concept: { finalText: "개념 기존 텍스트", reviewed: true },
        problemsolving: { finalText: null, reviewed: false },
        participation: { finalText: null, reviewed: false },
        homework: { finalText: null, reviewed: false },
      },
    };
    render(<TeacherReviewPanel context={context} existingReview={existingReview} />);
    expect(screen.getByDisplayValue("저번 총평")).toBeInTheDocument();
    expect(screen.getByDisplayValue("개념 기존 텍스트")).toBeInTheDocument();
  });

  it("검토완료 체크박스를 켜고 제출하면 submitReview가 호출된다", async () => {
    vi.mocked(actions.submitReview).mockResolvedValue(undefined);
    render(<TeacherReviewPanel context={context} existingReview={null} />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText("리뷰 제출"));
    await waitFor(() => expect(actions.submitReview).toHaveBeenCalled());
    const [sessionId, fields] = vi.mocked(actions.submitReview).mock.calls[0];
    expect(sessionId).toBe("s1");
    expect(fields.categories.concept.reviewed).toBe(true);
    await waitFor(() => expect(screen.getByText("✓ 제출되었습니다")).toBeInTheDocument());
  });
});
