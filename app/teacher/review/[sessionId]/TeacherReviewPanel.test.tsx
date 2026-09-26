import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherReviewPanel from "./TeacherReviewPanel";
import * as actions from "./review-actions";
import type { ExistingReview, SessionReviewContext } from "./review-data";

// 2026-09-16(제품 오너 지시) — 카테고리별 5단계 버튼 평가 중심 재구성. "오늘 배운 것"·
// "최종 정리"만 필수, 나머지 텍스트는 선택. AI 초안 자동 생성 기능은 제거됐다.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("./review-actions", () => ({
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
  it("과목/회차 정보와 4개 카테고리·5단계 버튼을 보여준다", () => {
    render(<TeacherReviewPanel context={context} existingReview={null} />);
    expect(screen.getByText(/지훈 · SAT Math · 8회차/)).toBeInTheDocument();
    ["개념 이해도", "문제 해결 능력", "수업 참여도", "과제 수행도"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
    ["Below", "Partial", "Average", "Excellent", "Outstanding"].forEach((label) =>
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    );
  });

  it("모든 카테고리 평가와 필수 텍스트를 채우기 전에는 제출 버튼이 비활성 상태다", () => {
    render(<TeacherReviewPanel context={context} existingReview={null} />);
    expect(screen.getByText("리뷰 제출")).toBeDisabled();
  });

  it("기존 리뷰가 있으면 기존 값·평가로 채워서 보여준다", () => {
    const existingReview: ExistingReview = {
      teacherSummary: "저번에 배운 것",
      strength: null,
      improve: null,
      nextPlan: "저번 최종 정리",
      submittedAt: "2026-08-20T00:00:00.000Z",
      categories: {
        concept: { finalText: "개념 기존 텍스트", reviewed: true, rating: "excellent" },
        problemsolving: { finalText: null, reviewed: false, rating: null },
        participation: { finalText: null, reviewed: false, rating: null },
        homework: { finalText: null, reviewed: false, rating: null },
      },
    };
    render(<TeacherReviewPanel context={context} existingReview={existingReview} />);
    expect(screen.getByDisplayValue("저번에 배운 것")).toBeInTheDocument();
    expect(screen.getByDisplayValue("저번 최종 정리")).toBeInTheDocument();
    expect(screen.getByDisplayValue("개념 기존 텍스트")).toBeInTheDocument();
  });

  it("카테고리 평가를 전부 선택하고 필수 텍스트를 채우면 제출할 수 있다", async () => {
    vi.mocked(actions.submitReview).mockResolvedValue(undefined);
    render(<TeacherReviewPanel context={context} existingReview={null} />);

    for (const label of ["개념 이해도", "문제 해결 능력", "수업 참여도", "과제 수행도"]) {
      const card = screen.getByText(label).closest("div")!.parentElement!;
      fireEvent.click(within(card).getByText("Average"));
    }
    fireEvent.change(screen.getByText("오늘 배운 것").parentElement!.querySelector("textarea")!, {
      target: { value: "이차방정식 개념" },
    });
    fireEvent.change(screen.getByText("최종 정리").parentElement!.querySelector("textarea")!, {
      target: { value: "다음 회차는 함수" },
    });

    expect(screen.getByText("리뷰 제출")).not.toBeDisabled();
    fireEvent.click(screen.getByText("리뷰 제출"));
    await waitFor(() => expect(actions.submitReview).toHaveBeenCalled());
    const [sessionId, fields] = vi.mocked(actions.submitReview).mock.calls[0];
    expect(sessionId).toBe("s1");
    expect(fields.categories.concept.rating).toBe("average");
    expect(fields.teacherSummary).toBe("이차방정식 개념");
    expect(fields.nextPlan).toBe("다음 회차는 함수");
    await waitFor(() => expect(screen.getByText("✓ 제출되었습니다")).toBeInTheDocument());
  });
});

function within(el: HTMLElement) {
  return { getByText: (text: string) => screen.getAllByText(text).find((n) => el.contains(n))! };
}
