import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MaterialLibraryTree from "./MaterialLibraryTree";
import type { LibrarySubjectTree } from "@/lib/subject-material-library";

const tree: LibrarySubjectTree[] = [
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    flatDocIds: ["doc1"],
    units: [
      {
        unitId: "u1",
        unitTitle: "이차방정식과 이차함수",
        keywordGroups: [
          { keywordId: "k1", label: "Quadratics", docs: [{ id: "doc1", title: "이차함수 개념", kind: "pdf" }] },
        ],
      },
    ],
  },
  {
    subjectId: "sub2",
    subjectName: "SAT Reading",
    flatDocIds: ["doc2"],
    units: [
      {
        unitId: "u2",
        unitTitle: "Words in Context",
        keywordGroups: [
          { keywordId: "k2", label: "Vocabulary", docs: [{ id: "doc2", title: "문맥 속 단어", kind: "html" }] },
        ],
      },
    ],
  },
];

describe("MaterialLibraryTree — 2026-09-22 갤러리뷰 재설계", () => {
  it("첫 과목이 기본 선택되어 그 과목의 교재만 보인다", () => {
    render(
      <MaterialLibraryTree
        subjects={tree}
        description="desc"
        emptyMessage="empty"
        docHref={(id) => `/materials/${id}`}
      />
    );
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("SAT Reading")).toBeInTheDocument();
    expect(screen.getByText("이차함수 개념")).toBeInTheDocument();
    expect(screen.queryByText("문맥 속 단어")).toBeNull();
  });

  it("다른 과목 버튼을 누르면 그 과목의 교재로 바뀐다", () => {
    render(
      <MaterialLibraryTree
        subjects={tree}
        description="desc"
        emptyMessage="empty"
        docHref={(id) => `/materials/${id}`}
      />
    );
    fireEvent.click(screen.getByText("SAT Reading"));
    expect(screen.getByText("문맥 속 단어")).toBeInTheDocument();
    expect(screen.queryByText("이차함수 개념")).toBeNull();
  });

  it("교재 링크는 여전히 docHref로 새 탭에서 연다", () => {
    render(
      <MaterialLibraryTree
        subjects={tree}
        description="desc"
        emptyMessage="empty"
        docHref={(id) => `/materials/${id}`}
      />
    );
    const link = screen.getByText("이차함수 개념").closest("a");
    expect(link).toHaveAttribute("href", "/materials/doc1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("교재가 없으면 안내 문구를 보여주고 과목 버튼도 없다", () => {
    render(<MaterialLibraryTree subjects={[]} description="desc" emptyMessage="배정된 교재가 없습니다." docHref={(id) => id} />);
    expect(screen.getByText("배정된 교재가 없습니다.")).toBeInTheDocument();
  });
});
