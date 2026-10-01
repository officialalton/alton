import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MaterialsLibraryTab from "./MaterialsLibraryTab";
import type { LibrarySubjectTree } from "@/lib/subject-material-library";

const tree: LibrarySubjectTree[] = [
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    flatDocIds: ["doc1", "doc2"],
    units: [
      {
        unitId: null,
        unitTitle: "단원 미지정",
        keywordGroups: [
          {
            keywordId: null,
            label: "키워드 미지정",
            docs: [{ id: "doc1", title: "이차방정식 개념 정리", kind: "html" }],
          },
        ],
      },
      {
        unitId: "u1",
        unitTitle: "이차방정식과 이차함수",
        keywordGroups: [
          {
            keywordId: "k1",
            label: "Quadratics",
            docs: [{ id: "doc2", title: "이차함수의 그래프와 성질", kind: "html" }],
          },
        ],
      },
    ],
  },
];

describe("MaterialsLibraryTab", () => {
  it("과목 → 단원 → 키워드 순서로 교재를 보여준다", () => {
    render(<MaterialsLibraryTab tree={tree} />);
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText(/이차방정식 개념 정리/)).toBeInTheDocument();
    expect(screen.getByText(/이차함수의 그래프와 성질/)).toBeInTheDocument();
    expect(screen.getByText("이차방정식과 이차함수")).toBeInTheDocument();
    expect(screen.getByText("Quadratics")).toBeInTheDocument();
  });

  it("교재 링크는 /materials/[id]로 새 탭에서 연다", () => {
    render(<MaterialsLibraryTab tree={tree} />);
    const link = screen.getByText(/이차방정식 개념 정리/).closest("a");
    expect(link).toHaveAttribute("href", "/materials/doc1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("교재가 없으면 안내 문구를 보여준다", () => {
    render(<MaterialsLibraryTab tree={[]} />);
    expect(
      screen.getByText("아직 배정된 교재가 없어요. 담당 선생님이 곧 준비해드릴 예정이에요.")
    ).toBeInTheDocument();
  });
});
