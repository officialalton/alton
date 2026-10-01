import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CurriculumDocEditor from "./CurriculumDocEditor";
import * as docActions from "./curriculum-doc-actions";
import type { DocEditorData } from "./curriculum-doc-data";

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateDocTitle: vi.fn(),
  setDocPublished: vi.fn(),
  setDocPrimaryKeyword: vi.fn(),
  setDocUnit: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
  generateSectionProblems: vi.fn(),
  regenerateProblem: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
  deleteCurriculumDoc: vi.fn(),
  assignSectionKeyword: vi.fn(),
  removeSectionKeyword: vi.fn(),
  assignProblemKeyword: vi.fn(),
  removeProblemKeyword: vi.fn(),
  createSubjectKeywordForDoc: vi.fn(),
}));

const doc: DocEditorData = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  subjectId: "sub1",
  subjectName: "SAT Math",
  unitId: null,
  unitTitle: null,
  status: "draft",
  primaryKeywordId: null,
  primaryKeywordPosition: null,
  sections: [
    {
      id: "sec1",
      position: 1,
      title: "Lesson Overview",
      body: "<p>본문</p>",
      teachingTip: null,
      sectionType: "problem",
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

  it("배포 상태를 바꾸면 '뒤로'를 누르지 않아도 즉시 onDocChange로 부모에 알린다", async () => {
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    const onDocChange = vi.fn();
    render(
      <CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} onDocChange={onDocChange} />
    );
    fireEvent.click(screen.getByText("배포하기"));
    await waitFor(() =>
      expect(onDocChange).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }))
    );
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

  it("객관식 선택지가 5개 모두 채워지지 않으면 확정을 막고 에러를 보여준다", async () => {
    vi.mocked(docActions.confirmSectionProblems).mockClear();
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
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("문제 유형 (예: 판별식 응용)"), {
      target: { value: "판별식" },
    });
    fireEvent.click(screen.getByText("✨ AI로 생성하기"));
    await waitFor(() => expect(screen.getByText("AI 초안 (1개)")).toBeInTheDocument());

    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[2], {
      target: { value: "" },
    });

    fireEvent.click(screen.getByText("문제로 추가"));

    await waitFor(() =>
      expect(
        screen.getByText("객관식 문제는 선택지 5개를 모두 입력해야 합니다.")
      ).toBeInTheDocument()
    );
    expect(docActions.confirmSectionProblems).not.toHaveBeenCalled();
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

  // 2026-09-12(UAT 확정) — 섹션별 키워드 입력을 없앴다. 교재 단위 대표 키워드와
  // 기능이 겹친다: 회차에 키워드가 붙으면 교재 전체가 구성에 들어가고, 수업에
  // 담기는 것도 교재 단위다. 조각마다 다시 매기는 층은 하는 일이 없다.
  it("섹션에는 더 이상 키워드 입력이 없다", () => {
    render(
      <CurriculumDocEditor
        doc={{ ...doc, status: "published" }}
        onBack={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    expect(screen.queryByPlaceholderText("키워드 검색 또는 새 키워드 입력")).not.toBeInTheDocument();
    expect(screen.queryByText("태그된 키워드 없음")).not.toBeInTheDocument();
  });

  it("섹션 키워드 서버 액션을 부르지 않는다", async () => {
    const src = (await import("node:fs")).readFileSync(
      "app/admin/CurriculumDocEditor.tsx",
      "utf-8"
    );
    // 기존 데이터와 과거 수업 조회 경로는 그대로 두고, 새로 매기는 자리만 없앴다.
    expect(src).not.toContain("assignSectionKeyword");
    expect(src).not.toContain("removeSectionKeyword");
  });
});

// P2 2차 — 교재당 대표 키워드 1개.
// 섹션별 키워드("이 조각이 무엇을 다루는가")와는 다른 층이다. 대표 키워드는
// "이 교재를 어느 키워드의 기본 교재로 둘 것인가"이고, 회차에 그 키워드가 붙으면
// 이 교재가 자동으로 구성에 들어간다.
describe("대표 키워드 지정", () => {
  const docWithKeywords: DocEditorData = {
    ...doc,
    subjectKeywords: [
      { id: "kw1", label: "이차함수", status: "active" },
      { id: "kw2", label: "삼각비", status: "active" },
    ],
  };

  beforeEach(() => vi.clearAllMocks());

  it("미지정 상태로 시작하고, 고르면 바로 저장한다", async () => {
    vi.mocked(docActions.setDocPrimaryKeyword).mockResolvedValue({ ok: true });
    render(<CurriculumDocEditor doc={docWithKeywords} onBack={vi.fn()} onDeleted={vi.fn()} />);

    const select = screen.getByLabelText("대표 키워드") as HTMLSelectElement;
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "kw1" } });
    await waitFor(() =>
      expect(docActions.setDocPrimaryKeyword).toHaveBeenCalledWith("doc1", "kw1", null)
    );
  });

  it("키워드를 고르기 전에는 순서를 입력할 수 없다", () => {
    render(<CurriculumDocEditor doc={docWithKeywords} onBack={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByLabelText("키워드 안 순서")).toBeDisabled();
  });

  it("순서를 숫자로 적으면 함께 저장한다", async () => {
    vi.mocked(docActions.setDocPrimaryKeyword).mockResolvedValue({ ok: true });
    render(
      <CurriculumDocEditor
        doc={{ ...docWithKeywords, primaryKeywordId: "kw1" }}
        onBack={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    const position = screen.getByLabelText("키워드 안 순서");
    fireEvent.change(position, { target: { value: "2" } });
    fireEvent.blur(position);
    await waitFor(() =>
      expect(docActions.setDocPrimaryKeyword).toHaveBeenCalledWith("doc1", "kw1", 2)
    );
  });

  it("순서에 숫자가 아닌 값을 넣으면 저장하지 않고 알려준다", async () => {
    render(
      <CurriculumDocEditor
        doc={{ ...docWithKeywords, primaryKeywordId: "kw1" }}
        onBack={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    const position = screen.getByLabelText("키워드 안 순서");
    fireEvent.change(position, { target: { value: "첫째" } });
    fireEvent.blur(position);
    await waitFor(() =>
      expect(screen.getByText("순서는 1 이상의 숫자로 적어주세요.")).toBeInTheDocument()
    );
    expect(docActions.setDocPrimaryKeyword).not.toHaveBeenCalled();
  });

  it("저장 실패 사유를 그대로 보여준다", async () => {
    vi.mocked(docActions.setDocPrimaryKeyword).mockResolvedValue({
      ok: false,
      error: "대표 키워드는 교재와 같은 과목이어야 합니다.",
    });
    render(<CurriculumDocEditor doc={docWithKeywords} onBack={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("대표 키워드"), { target: { value: "kw2" } });
    await waitFor(() =>
      expect(screen.getByText("대표 키워드는 교재와 같은 과목이어야 합니다.")).toBeInTheDocument()
    );
  });
});

// 2026-09-12(UAT) — 교재를 만들 때 단원을 안 정했으면 나중에 정할 길이 없었다.
describe("교재 단원 나중에 정하기", () => {
  const docWithUnits: DocEditorData = {
    ...doc,
    unitId: null,
    subjectUnits: [
      { id: "u1", unitTitle: "함수의 기초", position: 1 },
      { id: "u2", unitTitle: "이차방정식", position: 2 },
    ],
  };

  beforeEach(() => vi.clearAllMocks());

  it("단원 없이 만든 교재도 편집 화면에서 단원을 고를 수 있다", async () => {
    vi.mocked(docActions.setDocUnit).mockResolvedValue({ ok: true });
    render(<CurriculumDocEditor doc={docWithUnits} onBack={vi.fn()} onDeleted={vi.fn()} />);

    const select = screen.getByLabelText("단원") as HTMLSelectElement;
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "u2" } });
    await waitFor(() => expect(docActions.setDocUnit).toHaveBeenCalledWith("doc1", "u2"));
  });

  it("단원을 다시 없앨 수 있다", async () => {
    vi.mocked(docActions.setDocUnit).mockResolvedValue({ ok: true });
    render(
      <CurriculumDocEditor
        doc={{ ...docWithUnits, unitId: "u1" }}
        onBack={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("단원"), { target: { value: "" } });
    await waitFor(() => expect(docActions.setDocUnit).toHaveBeenCalledWith("doc1", null));
  });

  it("저장 실패 사유를 보여준다", async () => {
    vi.mocked(docActions.setDocUnit).mockResolvedValue({
      ok: false,
      error: "교재와 단원은 같은 과목이어야 합니다.",
    });
    render(<CurriculumDocEditor doc={docWithUnits} onBack={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("단원"), { target: { value: "u1" } });
    await waitFor(() =>
      expect(screen.getByText("교재와 단원은 같은 과목이어야 합니다.")).toBeInTheDocument()
    );
  });
});
