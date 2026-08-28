import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumDocEditor from "./CurriculumDocEditor";
import * as docActions from "./curriculum-doc-actions";
import type { DocEditorData } from "./curriculum-doc-data";

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateDocTitle: vi.fn(),
  setDocPublished: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
  generateSectionProblems: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
}));

const doc: DocEditorData = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  subjectId: "sub1",
  subjectName: "SAT Math",
  unitId: null,
  unitTitle: null,
  status: "draft",
  sections: [
    {
      id: "sec1",
      position: 1,
      title: "Lesson Overview",
      body: "<p>본문</p>",
      teachingTip: null,
      problems: [],
    },
  ],
};

describe("CurriculumDocEditor", () => {
  it("제목/과목/섹션을 보여준다", () => {
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} />);
    expect(screen.getByDisplayValue("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lesson Overview")).toBeInTheDocument();
    expect(screen.getByText("배포하기")).toBeInTheDocument();
  });

  it("배포하기를 누르면 배포됨 상태로 바뀐다", async () => {
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("배포하기"));
    await waitFor(() =>
      expect(docActions.setDocPublished).toHaveBeenCalledWith("doc1", true)
    );
    await waitFor(() => expect(screen.getByText("배포 취소(초안으로)")).toBeInTheDocument());
  });

  it("섹션을 추가할 수 있다", async () => {
    vi.mocked(docActions.addSection).mockResolvedValue({
      id: "sec2",
      position: 2,
      title: "새 섹션",
      body: "",
      teachingTip: null,
      problems: [],
    });
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("+ 섹션 추가"));
    await waitFor(() => expect(docActions.addSection).toHaveBeenCalledWith("doc1", 2));
    await waitFor(() => expect(screen.getByDisplayValue("새 섹션")).toBeInTheDocument());
  });

  it("뒤로가기 시 현재 상태를 그대로 부모에 전달한다", () => {
    const onBack = vi.fn();
    render(<CurriculumDocEditor doc={doc} onBack={onBack} />);
    fireEvent.click(screen.getByText("← 뒤로"));
    expect(onBack).toHaveBeenCalledWith(doc);
  });

  it("문제 추가 폼에서 AI 생성 후 문제로 추가할 수 있다", async () => {
    vi.mocked(docActions.generateSectionProblems).mockResolvedValue([
      {
        format: "mc",
        passage: "판별식 문제",
        options: ["A", "B", "C", "D"],
        correctIndex: 1,
        explanation: "해설",
        difficulty: "medium",
      },
    ]);
    vi.mocked(docActions.confirmSectionProblems).mockResolvedValue([
      {
        id: "prob1",
        format: "mc",
        passage: "판별식 문제",
        options: ["A", "B", "C", "D"],
        correctIndex: 1,
        explanation: "해설",
        difficulty: "medium",
      },
    ]);
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText("+ 문제 추가"));
    fireEvent.change(screen.getByPlaceholderText("문제 유형 (예: 판별식 응용)"), {
      target: { value: "판별식" },
    });
    fireEvent.click(screen.getByText("✨ AI로 생성하기"));

    await waitFor(() =>
      expect(docActions.generateSectionProblems).toHaveBeenCalledWith(
        expect.objectContaining({ skillType: "판별식", sectionTitle: "Lesson Overview" })
      )
    );
    await waitFor(() => expect(screen.getByText("AI 초안 (1개)")).toBeInTheDocument());

    fireEvent.click(screen.getByText("문제로 추가"));
    await waitFor(() =>
      expect(docActions.confirmSectionProblems).toHaveBeenCalledWith(
        "sec1",
        "sub1",
        expect.any(Array)
      )
    );
    await waitFor(() => expect(screen.getByText("문제 (1)")).toBeInTheDocument());
  });
});
