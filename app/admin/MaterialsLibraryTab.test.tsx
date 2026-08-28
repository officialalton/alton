import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MaterialsLibraryTab from "./MaterialsLibraryTab";
import type { DocEditorData } from "./curriculum-doc-data";

function makeDoc(overrides: Partial<DocEditorData>): DocEditorData {
  return {
    id: "doc1",
    title: "제목",
    subjectId: "sub1",
    subjectName: "SAT Math",
    unitId: null,
    unitTitle: null,
    status: "published",
    sections: [],
    ...overrides,
  };
}

const docs: DocEditorData[] = [
  makeDoc({ id: "d1", title: "이차방정식 개념 정리", unitId: "u1", unitTitle: "이차방정식과 이차함수" }),
  makeDoc({ id: "d2", title: "이차함수 그래프 심화", unitId: "u1", unitTitle: "이차방정식과 이차함수" }),
  makeDoc({ id: "d3", title: "미배정 교재", unitId: null, unitTitle: null }),
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

  it("과목을 클릭하면 단원별로 그룹핑되고, 단원 없는 교재는 (단원 미지정)에 담긴다", () => {
    render(<MaterialsLibraryTab docs={docs} />);
    fireEvent.click(screen.getByText("📁 SAT Math"));
    expect(screen.getByText("📁 이차방정식과 이차함수")).toBeInTheDocument();
    expect(screen.getByText("📁 (단원 미지정)")).toBeInTheDocument();
  });

  it("단원을 클릭하면 그 안의 교재가 라이브러리 뷰어 링크로 보인다", () => {
    render(<MaterialsLibraryTab docs={docs} />);
    fireEvent.click(screen.getByText("📁 SAT Math"));
    fireEvent.click(screen.getByText("📁 이차방정식과 이차함수"));
    const link1 = screen.getByText("📖 이차방정식 개념 정리").closest("a");
    const link2 = screen.getByText("📖 이차함수 그래프 심화").closest("a");
    expect(link1).toHaveAttribute("href", "/materials/d1");
    expect(link1).toHaveAttribute("target", "_blank");
    expect(link2).toHaveAttribute("href", "/materials/d2");
  });

  it("배포된 교재가 없으면 안내 문구를 보여준다", () => {
    render(<MaterialsLibraryTab docs={[]} />);
    expect(screen.getByText("배포된 교재가 없습니다.")).toBeInTheDocument();
  });
});
