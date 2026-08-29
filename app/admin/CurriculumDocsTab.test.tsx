import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumDocsTab from "./CurriculumDocsTab";
import * as docActions from "./curriculum-doc-actions";
import type { DocEditorData } from "./curriculum-doc-data";
import type { AdminSubject } from "./subject-data";

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
  deleteCurriculumDoc: vi.fn(),
}));

const subjects: AdminSubject[] = [
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    units: [{ id: "u1", position: 1, unitTitle: "함수의 기초", note: null }],
  },
];

const existingDoc: DocEditorData = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  subjectId: "sub1",
  subjectName: "SAT Math",
  unitId: "u1",
  unitTitle: "함수의 기초",
  status: "draft",
  sections: [],
};

describe("CurriculumDocsTab", () => {
  it("교재 목록을 보여준다", () => {
    render(<CurriculumDocsTab initialDocs={[existingDoc]} subjects={subjects} />);
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByText(/SAT Math · 함수의 기초 · 섹션 0개 · 초안/)).toBeInTheDocument();
  });

  it("교재가 없으면 안내 문구를 보여준다", () => {
    render(<CurriculumDocsTab initialDocs={[]} subjects={subjects} />);
    expect(screen.getByText("아직 만든 교재가 없습니다.")).toBeInTheDocument();
  });

  it("새 교재 만들기 폼에서 제목/과목/단원을 골라 생성하면 바로 에디터로 이동한다", async () => {
    vi.mocked(docActions.createCurriculumDoc).mockResolvedValue({ id: "doc2" });
    render(<CurriculumDocsTab initialDocs={[]} subjects={subjects} />);

    fireEvent.click(screen.getByText("+ 새 교재 만들기"));
    fireEvent.change(screen.getByPlaceholderText("예: 이차방정식 개념 정리"), {
      target: { value: "새 교재" },
    });
    fireEvent.click(screen.getByText("SAT Math"));
    fireEvent.click(screen.getByText("1회차 · 함수의 기초"));
    fireEvent.click(screen.getByText("만들기"));

    await waitFor(() =>
      expect(docActions.createCurriculumDoc).toHaveBeenCalledWith({
        title: "새 교재",
        subjectId: "sub1",
        unitId: "u1",
      })
    );
    await waitFor(() => expect(screen.getByDisplayValue("새 교재")).toBeInTheDocument());
  });

  it("편집 버튼을 누르면 에디터로 진입하고 뒤로가기 시 목록에 상태가 반영된다", () => {
    render(<CurriculumDocsTab initialDocs={[existingDoc]} subjects={subjects} />);
    fireEvent.click(screen.getByText("편집"));
    expect(screen.getByText("배포하기")).toBeInTheDocument();
    fireEvent.click(screen.getByText("← 뒤로"));
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
  });

  it("교재를 삭제하면 목록에서 사라진다", async () => {
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    render(<CurriculumDocsTab initialDocs={[existingDoc]} subjects={subjects} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("이 교재 삭제"));
    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() =>
      expect(docActions.deleteCurriculumDoc).toHaveBeenCalledWith("doc1")
    );
    await waitFor(() =>
      expect(screen.queryByText("이차방정식 개념 정리")).not.toBeInTheDocument()
    );
  });
});
