import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MaterialsLibraryTab from "./MaterialsLibraryTab";
import type { LibrarySubject } from "./materials-data";

const subjects: LibrarySubject[] = [
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    docs: [
      { id: "doc1", title: "이차방정식 개념 정리", unitTitle: null },
      { id: "doc2", title: "이차함수의 그래프와 성질", unitTitle: "이차방정식과 이차함수" },
    ],
  },
];

describe("MaterialsLibraryTab", () => {
  it("과목별로 교재를 그룹핑해서 보여준다", () => {
    render(<MaterialsLibraryTab subjects={subjects} />);
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText(/이차방정식 개념 정리/)).toBeInTheDocument();
    expect(screen.getByText(/이차함수의 그래프와 성질/)).toBeInTheDocument();
    expect(screen.getByText(/이차방정식과 이차함수/)).toBeInTheDocument();
  });

  it("교재 링크는 /materials/[id]로 새 탭에서 연다", () => {
    render(<MaterialsLibraryTab subjects={subjects} />);
    const link = screen.getByText(/이차방정식 개념 정리/).closest("a");
    expect(link).toHaveAttribute("href", "/materials/doc1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("교재가 없으면 안내 문구를 보여준다", () => {
    render(<MaterialsLibraryTab subjects={[]} />);
    expect(screen.getByText("열람할 수 있는 교재가 없습니다.")).toBeInTheDocument();
  });
});
