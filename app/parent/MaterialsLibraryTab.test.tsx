import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParentMaterialsLibraryTab from "./MaterialsLibraryTab";
import type { ParentChildLibrary } from "./materials-data";

const childLibraries: ParentChildLibrary[] = [
  {
    childId: "child1",
    childName: "지훈",
    tree: [
      {
        subjectId: "sub1",
        subjectName: "SAT Math",
        flatDocIds: ["doc1"],
        units: [
          {
            unitId: null,
            unitTitle: "단원 미지정",
            keywordGroups: [
              { keywordId: null, label: "키워드 미지정", docs: [{ id: "doc1", title: "이차방정식 개념", kind: "html" }] },
            ],
          },
        ],
      },
    ],
  },
];

describe("ParentMaterialsLibraryTab", () => {
  it("자녀별로 구분해서 교재를 보여준다", () => {
    render(<ParentMaterialsLibraryTab childLibraries={childLibraries} />);
    expect(screen.getByText("지훈 학생 교재")).toBeInTheDocument();
    expect(screen.getByText(/이차방정식 개념/)).toBeInTheDocument();
  });

  it("교재 링크에 자녀 id가 붙는다(정답·해설이 그 자녀 기준으로 갈리므로)", () => {
    render(<ParentMaterialsLibraryTab childLibraries={childLibraries} />);
    const link = screen.getByText(/이차방정식 개념/).closest("a");
    expect(link).toHaveAttribute("href", "/materials/doc1?childId=child1");
  });

  it("활성 자녀가 없으면 안내 문구를 보여준다", () => {
    render(<ParentMaterialsLibraryTab childLibraries={[]} />);
    expect(screen.getByText("아직 활성 자녀가 없어요.")).toBeInTheDocument();
  });
});
