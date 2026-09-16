import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VocabLibraryTab from "./VocabLibraryTab";
import type { VocabQuiz, VocabReviewItem } from "./vocab-library-data";

const createVocabQuizAction = vi.fn();
const submitVocabQuizAction = vi.fn();

vi.mock("./vocab-library-actions", () => ({
  addMyVocabWordAction: vi.fn(),
  updateMyVocabWordAction: vi.fn(),
  deleteMyVocabWordAction: vi.fn(),
  createVocabQuizAction: (...args: unknown[]) => createVocabQuizAction(...args),
  submitVocabQuizAction: (...args: unknown[]) => submitVocabQuizAction(...args),
}));

const reviewItems: VocabReviewItem[] = [
  { id: "r1", word: "abate", definition: "줄어들다", example1: "The storm began to abate.", example2: null, synonymWords: null, antonymWords: null, addedAt: "2026-09-15T00:00:00Z" },
  { id: "r2", word: "candid", definition: "솔직한", example1: "She gave a candid answer.", example2: null, synonymWords: null, antonymWords: null, addedAt: "2026-09-15T00:00:00Z" },
  { id: "r3", word: "diligent", definition: "근면한", example1: null, example2: null, synonymWords: null, antonymWords: null, addedAt: "2026-09-15T00:00:00Z" },
  { id: "r4", word: "eloquent", definition: "유창한", example1: null, example2: null, synonymWords: null, antonymWords: null, addedAt: "2026-09-15T00:00:00Z" },
];

describe("VocabLibraryTab — 복습 대상·오답 흐름", () => {
  it("복습 대상이 4개 미만이면 복습 시험 만들기가 비활성화된다", () => {
    render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[]} reviewItems={reviewItems.slice(0, 2)} />);
    fireEvent.click(screen.getByText("시험"));
    const btn = screen.getByText(/복습 시험 만들기/);
    expect(btn).toBeDisabled();
  });

  it("복습 대상이 4개 이상이면 복습 시험을 만들 수 있고, reviewOnly로 요청한다", async () => {
    createVocabQuizAction.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "quiz-1",
        items: [{ word: "abate", definitionShown: "abate", options: ["줄어들다", "다른뜻1", "다른뜻2", "다른뜻3"], correctIndex: 0, example1: "ex1", example2: null }],
      },
    });
    render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[]} reviewItems={reviewItems} />);
    fireEvent.click(screen.getByText("시험"));
    fireEvent.click(screen.getByText(/복습 시험 만들기/));
    await waitFor(() => expect(createVocabQuizAction).toHaveBeenCalledWith(expect.objectContaining({ reviewOnly: true })));
    expect(screen.getByText("abate")).toBeInTheDocument();
  });

  it("시험 응시 후 오답이 있으면 결과 화면에 뜻·예문과 함께 보여준다", async () => {
    const quiz: VocabQuiz = {
      id: "quiz-2",
      status: "pending",
      wordCount: 1,
      items: [{ word: "abate", definitionShown: "abate", options: ["줄어들다", "다른뜻1", "다른뜻2", "다른뜻3"], correctIndex: 0, example1: "The storm began to abate.", example2: null }],
      score: null,
      total: null,
      answers: null,
      createdAt: "2026-09-15T00:00:00Z",
      dueAt: null,
      sessionId: null,
      assignedByTeacher: false,
    };
    submitVocabQuizAction.mockResolvedValueOnce({ ok: true, value: { score: 0, total: 1 } });
    render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[quiz]} reviewItems={[]} />);
    fireEvent.click(screen.getByText("시험"));
    fireEvent.click(screen.getByText("응시하기"));
    fireEvent.click(screen.getByText("다른뜻1"));
    fireEvent.click(screen.getByText("제출"));
    await waitFor(() => expect(screen.getByText("결과: 0 / 1")).toBeInTheDocument());
    expect(screen.getByText(/The storm began to abate\./)).toBeInTheDocument();
    expect(screen.getByText(/복습 대상에 추가/)).toBeInTheDocument();
  });
});
