import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatalogTab from "./CatalogTab";
import * as docActions from "./curriculum-doc-actions";
import type { AdminSubject } from "./subject-data";
import type { CurriculumDocListItem, DocEditorData } from "./curriculum-doc-data";

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  getCurriculumDocDetailAction: vi.fn(),
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

// 2026-09-10(P1 성능 배치) — CatalogTab/CurriculumDocsTab은 이제 경량 목록
// (CurriculumDocListItem)만 받고, "편집"을 눌러야 getCurriculumDocDetailAction()으로
// 전체 상세를 지연 조회한다. 테스트에서는 목록 항목과 그에 대응하는 전체
// 상세를 함께 준비하고, 상세 액션 mock이 id로 찾아 돌려주게 한다.
function listItem(overrides: Partial<CurriculumDocListItem> & { id: string }): CurriculumDocListItem {
  return {
    title: "이차방정식",
    subjectId: "sub1",
    subjectName: "SAT Math",
    unitId: null,
    unitTitle: null,
    status: "draft",
    sectionCount: 0,
    ...overrides,
  };
}

function toDetail(item: CurriculumDocListItem): DocEditorData {
  return { ...item, sections: [] };
}

function mockDetailLookup(items: CurriculumDocListItem[]) {
  const byId = new Map(items.map((d) => [d.id, toDetail(d)]));
  vi.mocked(docActions.getCurriculumDocDetailAction).mockImplementation(async (id: string) => byId.get(id) ?? null);
}

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

  it("2026-09-10(UI/UX 정리 1차): 미구현 '승인 대기' 서브탭은 더 이상 노출되지 않는다", () => {
    render(<CatalogTab subjects={subjects} docs={[]} />);
    expect(screen.queryByText("승인 대기")).not.toBeInTheDocument();
  });

  it("교재 문서 탭에서 배포하면 교재 라이브러리 탭에도 서브탭 전환 없이 즉시 반영된다", async () => {
    const docs = [listItem({ id: "doc1", status: "draft" })];
    mockDetailLookup(docs);
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    render(<CatalogTab subjects={subjects} docs={docs} />);

    fireEvent.click(screen.getByText("교재 문서"));
    fireEvent.click(screen.getByText("편집"));
    await screen.findByText("배포하기");
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
    const docs = [listItem({ id: "doc1", status: "published" })];
    mockDetailLookup(docs);
    vi.mocked(docActions.setDocPublished).mockResolvedValue(undefined);
    render(<CatalogTab subjects={subjects} docs={docs} />);

    fireEvent.click(screen.getByText("교재 문서"));
    fireEvent.click(screen.getByText("편집"));
    await screen.findByText("배포 취소(초안으로)");
    fireEvent.click(screen.getByText("배포 취소(초안으로)"));
    await waitFor(() => expect(screen.getByText("배포하기")).toBeInTheDocument());

    // "← 뒤로"를 누르지 않고 곧바로 라이브러리 탭으로 이동 — 그래도 방금
    // 취소한 배포 상태가 반영되어 더 이상 배포된 교재로 카운트되면 안 된다.
    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText("배포된 교재가 없습니다.")).toBeInTheDocument();
  });

  it("교재 문서 탭에서 삭제하면 교재 라이브러리 탭 카운트에도 즉시 반영된다", async () => {
    const docs = [
      listItem({ id: "doc1", title: "이차방정식", status: "draft" }),
      listItem({ id: "doc2", title: "이차함수", status: "published" }),
    ];
    mockDetailLookup(docs);
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    render(<CatalogTab subjects={subjects} docs={docs} />);

    fireEvent.click(screen.getByText("교재 라이브러리"));
    expect(screen.getByText(/1개 교재/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("교재 문서"));
    fireEvent.click(screen.getAllByText("편집")[1]); // doc2(published)
    await screen.findByText("배포 취소(초안으로)");
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
