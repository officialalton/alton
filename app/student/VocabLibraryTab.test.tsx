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

const folders: VocabFolder[] = [{ id: "f1", name: "Missed Words", isDefault: true }];
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
    fireEvent.click(screen.getByText("Quiz"));
    fireEvent.click(screen.getByText("Create quiz"));
    fireEvent.click(screen.getByLabelText("Missed Words"));
    fireEvent.click(screen.getByText("Create"));
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
    fireEvent.click(screen.getByText("Quiz"));
    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByText("다른1"));
    expect(screen.getByText(/✗ Incorrect/)).toBeInTheDocument();
    expect(screen.getByText(/✓ Correct/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(screen.getByText("Result: 0 / 1")).toBeInTheDocument());
    expect(screen.getByText(/The storm began to abate\./)).toBeInTheDocument();
    expect(screen.getByText(/Missed Words/)).toBeInTheDocument();
  });
});

describe("VocabLibraryTab — 단어 뜻 영어 기본 + 한국어 토글", () => {
  const word = (over: Record<string, unknown>) => ({
    id: "w1", word: "abate", definition: "줄어들다", definitionEn: "to become less intense",
    example: null, example2: null, synonymWords: ["diminish"], antonymWords: null,
    createdAt: "2026-10-05T00:00:00Z", folderId: null, ...over,
  });

  it("영어 뜻이 기본으로 보이고 한국어 버튼을 누르면 한국어 뜻이 보인다", () => {
    render(<VocabLibraryTab myWords={[word({})]} books={[]} quizzes={[]} folders={folders} />);
    expect(screen.getByText("to become less intense")).toBeInTheDocument();
    expect(screen.queryByText("줄어들다")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "한국어" }));
    expect(screen.getByText("줄어들다")).toBeInTheDocument();
    expect(screen.queryByText("to become less intense")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("to become less intense")).toBeInTheDocument();
  });

  it("영어 뜻이 없는 레거시 단어는 한국어 뜻만 보이고 토글이 없다", () => {
    render(<VocabLibraryTab myWords={[word({ definitionEn: null })]} books={[]} quizzes={[]} folders={folders} />);
    expect(screen.getByText("줄어들다")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "한국어" })).not.toBeInTheDocument();
  });
});
