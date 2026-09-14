import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MaterialsLibraryTab from "./MaterialsLibraryTab";
import type { CurriculumDocListItem } from "./curriculum-doc-data";

function makeDoc(overrides: Partial<CurriculumDocListItem>): CurriculumDocListItem {
  return {
    id: "doc1",
    title: "제목",
    subjectId: "sub1",
    subjectName: "SAT Math",
    unitId: null,
    unitTitle: null,
    status: "published",
    hasPrimaryKeyword: false,
    primaryKeywordLabel: null,
    kind: "html" as const,
    sourceDriveName: null,
    hasDriveSource: false,
    archivedAt: null,
    archivedReason: null,
    sectionCount: 0,
    ...overrides,
  };
}

const docs: CurriculumDocListItem[] = [
  makeDoc({ id: "d1", title: "이차방정식 개념 정리", hasPrimaryKeyword: true, primaryKeywordLabel: "이차방정식" }),
  makeDoc({ id: "d2", title: "이차함수 그래프 심화", hasPrimaryKeyword: true, primaryKeywordLabel: "이차방정식", kind: "pdf" }),
  makeDoc({ id: "d3", title: "미배정 교재" }),
  makeDoc({ id: "d6", title: "보관된 교재", archivedAt: "2026-09-14T00:00:00Z" }),
  makeDoc({ id: "d4", title: "초안 교재", status: "draft" }),
  makeDoc({
    id: "d5",
    title: "AP Statistics 자료",
    subjectId: "sub2",
    subjectName: "AP Statistics",
  }),
];

describe("MaterialsLibraryTab", () => {
  it("배포된 교재의 과목만 폴더로 보여주고, 초안은 제외한다", () => {
    render(<MaterialsLibraryTab docs={docs} />);
    expect(screen.getByText("📁 SAT Math")).toBeInTheDocument();
    expect(screen.getByText("📁 AP Statistics")).toBeInTheDocument();
    expect(screen.queryByText("초안 교재")).not.toBeInTheDocument();
  });

  it("과목을 클릭하면 대표 키워드별로 접히고, 키워드 없는 교재는 (키워드 미지정)에 담긴다 — 단원 폴더는 없다(2026-09-14)", () => {
    render(<MaterialsLibraryTab docs={docs} />);
    fireEvent.click(screen.getByText("📁 SAT Math"));
    expect(screen.getByText("📁 이차방정식")).toBeInTheDocument();
    expect(screen.getByText("📁 (키워드 미지정)")).toBeInTheDocument();
    expect(screen.queryByText(/단원 미지정/)).not.toBeInTheDocument();
    // 보관된 교재는 라이브러리에서 빠진다.
    expect(screen.queryByText("보관된 교재")).not.toBeInTheDocument();
  });

  it("키워드를 클릭하면 그 안의 교재가 종류 아이콘과 함께 라이브러리 뷰어 링크로 보인다", () => {
    render(<MaterialsLibraryTab docs={docs} />);
    fireEvent.click(screen.getByText("📁 SAT Math"));
    fireEvent.click(screen.getByText("📁 이차방정식"));
    const link1 = screen.getByText(/이차방정식 개념 정리/).closest("a");
    const link2 = screen.getByText(/이차함수 그래프 심화/).closest("a");
    expect(link1).toHaveAttribute("href", "/materials/d1");
    expect(link1).toHaveAttribute("target", "_blank");
    expect(link1?.textContent).toContain("📖");
    expect(link2).toHaveAttribute("href", "/materials/d2");
    expect(link2?.textContent).toContain("📄");
    expect(link2?.textContent).toContain("PDF");
  });

  it("배포된 교재가 없으면 안내 문구를 보여준다", () => {
    render(<MaterialsLibraryTab docs={[]} />);
    expect(screen.getByText("배포된 교재가 없습니다.")).toBeInTheDocument();
  });
});
