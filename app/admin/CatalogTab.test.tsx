import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatalogTab from "./CatalogTab";
import * as docActions from "./curriculum-doc-actions";
import type { AdminSubject } from "./subject-data";
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

  it("교재 라이브러리 서브탭을 누르면 MaterialsLibraryTab이 렌더링된다", () => {
    render(<CatalogTab subjects={subjects} docs={[]} />);
    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText("배포된 교재가 없습니다.")).toBeInTheDocument();
  });

  it("아직 구현 안 된 서브탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<CatalogTab subjects={subjects} docs={[]} />);
    fireEvent.click(screen.getByText("승인 대기"));
    expect(screen.getByText("승인 대기 탭은 준비 중입니다.")).toBeInTheDocument();
  });

  it("교재 문서 탭에서 배포하면 교재 라이브러리 탭에도 서브탭 전환 없이 즉시 반영된다", async () => {
    const docs: DocEditorData[] = [
      {
        id: "doc1",
        title: "이차방정식",
        subjectId: "sub1",
        subjectName: "SAT Math",
        unitId: null,
        unitTitle: null,
        status: "draft",
        sections: [],
      },
    ];
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    render(<CatalogTab subjects={subjects} docs={docs} />);

    fireEvent.click(screen.getByText("교재 문서"));
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("배포하기"));
    await waitFor(() =>
      expect(screen.getByText("배포 취소(초안으로)")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("← 뒤로"));

    // 서브탭을 전환해도(언마운트/리마운트) 방금 배포한 상태가 유지되고,
    // 라이브러리 탭에도 즉시 반영되어야 한다 — CurriculumDocsTab이 독립적인
    // 초기 스냅샷으로 리마운트되면 이 값이 옛날 걸로 되돌아간다.
    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText(/1개 교재/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("교재 문서"));
    expect(screen.getByText(/배포됨/)).toBeInTheDocument();
  });

  it("배포 취소 직후 '뒤로'를 누르지 않고 바로 라이브러리 탭으로 이동해도 즉시 반영된다", async () => {
    const docs: DocEditorData[] = [
      {
        id: "doc1",
        title: "이차방정식",
        subjectId: "sub1",
        subjectName: "SAT Math",
        unitId: null,
        unitTitle: null,
        status: "published",
        sections: [],
      },
    ];
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    render(<CatalogTab subjects={subjects} docs={docs} />);

    fireEvent.click(screen.getByText("교재 문서"));
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("배포 취소(초안으로)"));
    await waitFor(() => expect(screen.getByText("배포하기")).toBeInTheDocument());

    // "← 뒤로"를 누르지 않고 곧바로 라이브러리 탭으로 이동 — 그래도 방금
    // 취소한 배포 상태가 반영되어 더 이상 배포된 교재로 카운트되면 안 된다.
    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText("배포된 교재가 없습니다.")).toBeInTheDocument();
  });

  it("교재 문서 탭에서 삭제하면 교재 라이브러리 탭 카운트에도 즉시 반영된다", async () => {
    const docs: DocEditorData[] = [
      {
        id: "doc1",
        title: "이차방정식",
        subjectId: "sub1",
        subjectName: "SAT Math",
        unitId: null,
        unitTitle: null,
        status: "draft",
        sections: [],
      },
      {
        id: "doc2",
        title: "이차함수",
        subjectId: "sub1",
        subjectName: "SAT Math",
        unitId: null,
        unitTitle: null,
        status: "published",
        sections: [],
      },
    ];
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    render(<CatalogTab subjects={subjects} docs={docs} />);

    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText(/1개 교재/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("교재 문서"));
    fireEvent.click(screen.getAllByText("편집")[1]); // doc2(published)
    fireEvent.click(screen.getByText("배포 취소(초안으로)"));
    await waitFor(() => expect(screen.getByText("배포하기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("이 교재 삭제"));
    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() =>
      expect(docActions.deleteCurriculumDoc).toHaveBeenCalledWith("doc2")
    );

    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText("배포된 교재가 없습니다.")).toBeInTheDocument();
  });
});
