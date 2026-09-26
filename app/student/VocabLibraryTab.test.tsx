import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VocabLibraryTab from "./VocabLibraryTab";
import type { VocabQuiz, VocabFolder } from "./vocab-library-data";

const createVocabQuizAction = vi.fn();
const submitVocabQuizAction = vi.fn();
const saveVocabQuizProgressAction = vi.fn();
const retakeVocabQuizAction = vi.fn();

vi.mock("./vocab-library-actions", () => ({
  addMyVocabWordAction: vi.fn(),
  updateMyVocabWordAction: vi.fn(),
  deleteMyVocabWordAction: vi.fn(),
  createVocabFolderAction: vi.fn(),
  setMyVocabWordFolderAction: vi.fn(),
  toggleLibraryWordInMyVocabAction: vi.fn(),
  createVocabQuizAction: (...args: unknown[]) => createVocabQuizAction(...args),
  submitVocabQuizAction: (...args: unknown[]) => submitVocabQuizAction(...args),
  saveVocabQuizProgressAction: (...args: unknown[]) => saveVocabQuizProgressAction(...args),
  retakeVocabQuizAction: (...args: unknown[]) => retakeVocabQuizAction(...args),
}));

const folders: VocabFolder[] = [{ id: "f1", name: "오답 노트", isDefault: true }];
saveVocabQuizProgressAction.mockResolvedValue({ ok: true, value: undefined });
retakeVocabQuizAction.mockResolvedValue({ ok: true, value: undefined });

describe("VocabLibraryTab — 시험 만들기·채점 흐름", () => {
  it("폴더를 선택해 시험을 만들면 folderIds로 요청한다", async () => {
    createVocabQuizAction.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "quiz-1",
        items: [{ word: "abate", definitionShown: "abate", options: ["diminish", "다른1", "다른2", "다른3"], correctIndex: 0, example1: "ex1", example2: null }],
      },
    });
    render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[]} folders={folders} />);
    fireEvent.click(screen.getByText("시험"));
    fireEvent.click(screen.getByText("시험 만들기"));
    fireEvent.click(screen.getByLabelText("오답 노트"));
    fireEvent.click(screen.getByText("만들기"));
    await waitFor(() => expect(createVocabQuizAction).toHaveBeenCalledWith(expect.objectContaining({ folderIds: ["f1"] })));
    expect(screen.getByText("abate")).toBeInTheDocument();
  });

  it("시험 응시 중 클릭하면 즉시 정답/오답이 표시되고, 제출 후 결과 화면에 뜻·예문과 함께 보여준다", async () => {
    const quiz: VocabQuiz = {
      id: "quiz-2",
      status: "pending",
      wordCount: 1,
      items: [{ word: "abate", definitionShown: "abate", options: ["diminish", "다른1", "다른2", "다른3"], correctIndex: 0, example1: "The storm began to abate.", example2: null }],
      score: null,
      total: null,
      answers: null,
      source: { customWords: true, bookIds: [], folderIds: [] },
      createdAt: "2026-09-15T00:00:00Z",
      dueAt: null,
      sessionId: null,
      assignedByTeacher: false,
    };
    submitVocabQuizAction.mockResolvedValueOnce({ ok: true, value: { score: 0, total: 1 } });
    render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[quiz]} folders={folders} />);
    fireEvent.click(screen.getByText("시험"));
    fireEvent.click(screen.getByText("응시하기"));
    fireEvent.click(screen.getByText("다른1"));
    expect(screen.getByText(/✗ 오답/)).toBeInTheDocument();
    expect(screen.getByText(/✓ 정답/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("제출"));
    await waitFor(() => expect(screen.getByText("결과: 0 / 1")).toBeInTheDocument());
    expect(screen.getByText(/The storm began to abate\./)).toBeInTheDocument();
    expect(screen.getByText(/오답 노트/)).toBeInTheDocument();
  });
});
