import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatalogTab from "./CatalogTab";
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
}));

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
];

describe("CatalogTab", () => {
  it("기본 서브탭은 과목 템플릿이다", () => {
    render(<CatalogTab subjects={subjects} docs={[]} />);
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
  });

  it("교재 문서 서브탭을 누르면 CurriculumDocsTab이 렌더링된다", () => {
    render(<CatalogTab subjects={subjects} docs={[]} />);
    fireEvent.click(screen.getByText("교재 문서"));
    expect(screen.getByText("아직 만든 교재가 없습니다.")).toBeInTheDocument();
  });

  it("아직 구현 안 된 서브탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<CatalogTab subjects={subjects} docs={[]} />);
    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText("교재 라이브러리 탭은 준비 중입니다.")).toBeInTheDocument();
  });
});
