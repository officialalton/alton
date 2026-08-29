import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
  regenerateProblem: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
  deleteCurriculumDoc: vi.fn(),
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
      sectionType: "concept",
      problems: [],
    },
  ],
};

describe("CurriculumDocEditor", () => {
  it("제목/과목/섹션을 보여준다", () => {
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByDisplayValue("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lesson Overview")).toBeInTheDocument();
    expect(screen.getByText("배포하기")).toBeInTheDocument();
  });

  it("배포하기를 누르면 배포됨 상태로 바뀐다", async () => {
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByText("배포하기"));
    await waitFor(() =>
      expect(docActions.setDocPublished).toHaveBeenCalledWith("doc1", true)
    );
    await waitFor(() => expect(screen.getByText("배포 취소(초안으로)")).toBeInTheDocument());
  });

  it("섹션 추가 시 타입을 먼저 선택해야 한다", async () => {
    vi.mocked(docActions.addSection).mockResolvedValue({
      id: "sec2",
      position: 2,
      title: "새 섹션",
      body: "",
      teachingTip: null,
      sectionType: "concept",
      problems: [],
    });
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByText("+ 섹션 추가"));
    expect(screen.getByText("개념 설명 섹션")).toBeInTheDocument();
    expect(screen.getByText("문제 생성 섹션")).toBeInTheDocument();

    fireEvent.click(screen.getByText("개념 설명 섹션"));
    await waitFor(() =>
      expect(docActions.addSection).toHaveBeenCalledWith("doc1", 2, "concept")
    );
    await waitFor(() => expect(screen.getByDisplayValue("새 섹션")).toBeInTheDocument());
  });

  it("문제 생성 섹션은 본문/티칭팁 없이 문제 목록만 보여준다", async () => {
    vi.mocked(docActions.addSection).mockResolvedValue({
      id: "sec3",
      position: 2,
      title: "새 섹션",
      body: "",
      teachingTip: null,
      sectionType: "problem",
      problems: [],
    });
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByText("+ 섹션 추가"));
    fireEvent.click(screen.getByText("문제 생성 섹션"));
    await waitFor(() =>
      expect(docActions.addSection).toHaveBeenCalledWith("doc1", 2, "problem")
    );
    await waitFor(() => expect(screen.getByDisplayValue("새 섹션")).toBeInTheDocument());
    const newSectionTitleInput = screen.getByDisplayValue("새 섹션");
    const newSectionEl = newSectionTitleInput.parentElement!.parentElement!;
    expect(within(newSectionEl).queryByText("본문")).not.toBeInTheDocument();
    expect(within(newSectionEl).queryByText("티칭 팁 (선생님 전용)")).not.toBeInTheDocument();
  });

  it("뒤로가기 시 현재 상태를 그대로 부모에 전달한다", () => {
    const onBack = vi.fn();
    render(<CurriculumDocEditor doc={doc} onBack={onBack} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByText("← 뒤로"));
    expect(onBack).toHaveBeenCalledWith(doc);
  });

  it("문제 추가 폼에서 AI 생성 후 문제로 추가할 수 있다", async () => {
    vi.mocked(docActions.generateSectionProblems).mockResolvedValue([
      {
        format: "mc",
        passage: "판별식 문제",
        options: ["A", "B", "C", "D", "E"],
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
        options: ["A", "B", "C", "D", "E"],
        correctIndex: 1,
        explanation: "해설",
        difficulty: "medium",
      },
    ]);
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);

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
    expect(screen.getAllByPlaceholderText(/선택지/)).toHaveLength(5);

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

  it("AI 초안에 피드백을 남기고 그 문제만 재생성할 수 있다", async () => {
    vi.mocked(docActions.generateSectionProblems).mockResolvedValue([
      {
        format: "mc",
        passage: "판별식 문제",
        options: ["A", "B", "C", "D", "E"],
        correctIndex: 1,
        explanation: "해설",
        difficulty: "medium",
      },
    ]);
    vi.mocked(docActions.regenerateProblem).mockResolvedValue({
      format: "mc",
      passage: "판별식 문제(수정됨)",
      options: ["A2", "B2", "C2", "D2", "E2"],
      correctIndex: 2,
      explanation: "수정된 해설",
      difficulty: "medium",
    });
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByText("+ 문제 추가"));
    fireEvent.change(screen.getByPlaceholderText("문제 유형 (예: 판별식 응용)"), {
      target: { value: "판별식" },
    });
    fireEvent.click(screen.getByText("✨ AI로 생성하기"));
    await waitFor(() => expect(screen.getByText("AI 초안 (1개)")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("이 문제에 대한 피드백을 입력하세요"), {
      target: { value: "더 어렵게 만들어주세요" },
    });
    fireEvent.click(screen.getByText("피드백 반영 재생성"));

    await waitFor(() =>
      expect(docActions.regenerateProblem).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: "더 어렵게 만들어주세요" })
      )
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue("판별식 문제(수정됨)")).toBeInTheDocument()
    );
  });

  it("서술형 문제는 확정 목록에서 모범답안을 함께 보여준다", () => {
    const essayDoc = {
      ...doc,
      sections: [
        {
          ...doc.sections[0],
          sectionType: "problem" as const,
          problems: [
            {
              id: "prob1",
              format: "essay" as const,
              passage: "서술형 문제",
              options: null,
              correctIndex: null,
              explanation: "모범답안 내용",
              difficulty: "medium" as const,
            },
          ],
        },
      ],
    };
    render(<CurriculumDocEditor doc={essayDoc} onBack={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByText(/서술형 문제/)).toBeInTheDocument();
    expect(screen.getByText(/모범답안 내용/)).toBeInTheDocument();
  });

  it("초안 상태에서는 삭제 확인 후 onDeleted가 호출된다", async () => {
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByText("이 교재 삭제"));
    expect(screen.getByText(/정말 "이차방정식 개념 정리" 교재를 삭제하시겠습니까/)).toBeInTheDocument();
    const deleteButtons = screen.getAllByText("삭제");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(docActions.deleteCurriculumDoc).toHaveBeenCalledWith("doc1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("doc1"));
  });

  it("배포된 문서는 삭제 버튼이 비활성화된다", () => {
    render(
      <CurriculumDocEditor doc={{ ...doc, status: "published" }} onBack={vi.fn()} onDeleted={vi.fn()} />
    );
    expect(screen.getByText("이 교재 삭제")).toBeDisabled();
    expect(screen.getByText("배포 취소 후 삭제할 수 있습니다.")).toBeInTheDocument();
  });
});
