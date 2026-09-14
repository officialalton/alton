import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CurriculumDocsTab from "./CurriculumDocsTab";
import * as docActions from "./curriculum-doc-actions";
import type { DocEditorData, CurriculumDocListItem } from "./curriculum-doc-data";
import type { AdminSubject } from "./subject-data";

// CurriculumDocsTab은 이제 docs를 부모(CatalogTab)에서 controlled로 받는다 —
// 서브탭을 전환해도(언마운트/리마운트) 최신 상태가 유지되어야 하고, 교재
// 라이브러리 탭도 같은 상태를 봐야 하기 때문(배포/삭제가 다른 탭에 즉시
// 반영되지 않던 버그 수정). 테스트에서도 실제 부모처럼 상태를 들고 있는
// 래퍼가 필요하다.
//
// 2026-09-10(P1 성능 배치) — docs는 이제 경량 목록(CurriculumDocListItem,
// 섹션·문제 본문 미포함)이고, "편집"을 눌러야 getCurriculumDocDetailAction()으로
// 전체 상세를 지연 조회한다.
function Wrapper({
  initialDocs,
  subjects,
}: {
  initialDocs: CurriculumDocListItem[];
  subjects: AdminSubject[];
}) {
  const [docs, setDocs] = useState(initialDocs);
  return <CurriculumDocsTab docs={docs} setDocs={setDocs} subjects={subjects} />;
}

vi.mock("./curriculum-asset-actions", () => ({
  publishAssetDocAction: vi.fn(),
}));

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  getCurriculumDocDetailAction: vi.fn(),
  setDocArchived: vi.fn(),
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
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    units: [{ id: "u1", position: 1, unitTitle: "함수의 기초", note: null, keywordIds: ["kw1"] }],
    keywords: [{ id: "kw1", label: "이차방정식", status: "active" }],
  },
];

const existingDocListItem: CurriculumDocListItem = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  subjectId: "sub1",
  subjectName: "SAT Math",
  unitId: "u1",
  unitTitle: "함수의 기초",
  status: "draft",
  sectionCount: 0,
  hasPrimaryKeyword: false,
  primaryKeywordId: null,
  primaryKeywordLabel: null,
  kind: "html" as const,
  sourceDriveName: null,
  hasDriveSource: false,
  archivedAt: null,
  archivedReason: null,
};

const existingDocDetail: DocEditorData = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  subjectId: "sub1",
  subjectName: "SAT Math",
  primaryKeywordId: null,
  primaryKeywordPosition: null,
  unitId: "u1",
  unitTitle: "함수의 기초",
  status: "draft",
  sections: [],
};

describe("CurriculumDocsTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("교재 목록을 보여준다", () => {
    render(<Wrapper initialDocs={[existingDocListItem]} subjects={subjects} />);
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByText(/SAT Math · 함수의 기초 · 섹션 0개 · 초안/)).toBeInTheDocument();
  });

  it("교재가 없으면 안내 문구를 보여준다", () => {
    render(<Wrapper initialDocs={[]} subjects={subjects} />);
    expect(screen.getByText(/아직 교재가 없습니다/)).toBeInTheDocument();
  });

  it("편집 버튼을 누르면 상세를 지연 조회해 에디터로 진입하고 뒤로가기 시 목록에 상태가 반영된다", async () => {
    vi.mocked(docActions.getCurriculumDocDetailAction).mockResolvedValue(existingDocDetail);
    render(<Wrapper initialDocs={[existingDocListItem]} subjects={subjects} />);
    fireEvent.click(screen.getByText("편집"));
    expect(docActions.getCurriculumDocDetailAction).toHaveBeenCalledWith("doc1");
    await screen.findByText("배포하기");
    fireEvent.click(screen.getByText("← 뒤로"));
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
  });

  it("같은 교재를 다시 열면 상세를 다시 조회하지 않는다(세션 내 캐시)", async () => {
    vi.mocked(docActions.getCurriculumDocDetailAction).mockResolvedValue(existingDocDetail);
    render(<Wrapper initialDocs={[existingDocListItem]} subjects={subjects} />);
    fireEvent.click(screen.getByText("편집"));
    await screen.findByText("배포하기");
    fireEvent.click(screen.getByText("← 뒤로"));

    fireEvent.click(screen.getByText("편집"));
    await screen.findByText("배포하기");
    expect(docActions.getCurriculumDocDetailAction).toHaveBeenCalledTimes(1);
  });

  it("교재를 삭제하면 목록에서 사라진다", async () => {
    vi.mocked(docActions.getCurriculumDocDetailAction).mockResolvedValue(existingDocDetail);
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    render(<Wrapper initialDocs={[existingDocListItem]} subjects={subjects} />);
    fireEvent.click(screen.getByText("편집"));
    await screen.findByText("이 교재 삭제");
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

// P2 2차 — 임의 백필을 하지 않았으므로 기존 교재는 전부 대표 키워드가 없다.
// 관리자가 그것을 찾아 지정할 수 있어야 한다.
describe("대표 키워드 미지정 교재 찾기", () => {
  const withKeyword = { ...existingDocListItem, id: "doc2", title: "지정된 교재", hasPrimaryKeyword: true };

  it("미지정 교재에 표시가 붙고 건수를 알려준다", () => {
    render(<Wrapper initialDocs={[existingDocListItem, withKeyword]} subjects={subjects} />);
    expect(screen.getByText("(1건)")).toBeInTheDocument();
    expect(screen.getByText(/대표 키워드 없음/)).toBeInTheDocument();
  });

  it("미지정만 보기로 좁힐 수 있다", () => {
    render(<Wrapper initialDocs={[existingDocListItem, withKeyword]} subjects={subjects} />);
    expect(screen.getByText("지정된 교재")).toBeInTheDocument();

    fireEvent.click(screen.getByText("대표 키워드가 없는 교재만 보기"));
    expect(screen.queryByText("지정된 교재")).not.toBeInTheDocument();
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
  });
});

// 보관됨과 현재는 한 목록에 섞지 않는다. 기본 진입은 현재이고, 검색도 지금 보고
// 있는 구분 안에서만 동작한다.
describe("교재 현재/보관됨 분리", () => {
  const archivedDoc = {
    ...existingDocListItem,
    id: "doc9",
    title: "보관된 교재",
    archivedAt: "2026-09-11T00:00:00Z",
  };

  it("보관됨으로 옮기면 보관된 교재만 보인다", () => {
    render(<Wrapper initialDocs={[existingDocListItem, archivedDoc]} subjects={subjects} />);
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.queryByText("보관된 교재")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/^보관됨/));
    expect(screen.getByText("보관된 교재")).toBeInTheDocument();
    expect(screen.queryByText("이차방정식 개념 정리")).not.toBeInTheDocument();
  });

  it("검색은 지금 보고 있는 구분 안에서만 동작한다", () => {
    render(<Wrapper initialDocs={[existingDocListItem, archivedDoc]} subjects={subjects} />);
    fireEvent.change(screen.getByLabelText("교재 검색"), { target: { value: "보관된" } });
    // 현재 목록에는 그런 교재가 없다 — 보관됨 쪽을 뒤져서 끌어오지 않는다.
    expect(screen.queryByText("보관된 교재")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/^보관됨/));
    expect(screen.getByText("보관된 교재")).toBeInTheDocument();
  });

  it("보관해도 삭제가 아니라는 것을 문구로 알린다", () => {
    render(<Wrapper initialDocs={[existingDocListItem, archivedDoc]} subjects={subjects} />);
    fireEvent.click(screen.getByText(/^보관됨/));
    expect(
      screen.getByText(/이미 담긴 회차와 과거 수업 기록은\s*그대로 남아 있습니다/)
    ).toBeInTheDocument();
  });

  it("보관 버튼이 서버 액션을 부른다", async () => {
    vi.mocked(docActions.setDocArchived).mockResolvedValue({ ok: true });
    render(<Wrapper initialDocs={[existingDocListItem]} subjects={subjects} />);
    fireEvent.click(screen.getByText("보관"));
    await waitFor(() => expect(docActions.setDocArchived).toHaveBeenCalledWith("doc1", true));
  });
});

// 2026-09-12(UAT) — 방금 만든 교재의 편집 화면에서 대표 키워드 선택지가 비어
// 보였다. 로딩이 느린 게 아니라 만들 때 넘기는 객체에 과목 키워드·단원이
// 아예 없었다. "다시 들어가니까 나온다"가 그 증거다(그때는 상세를 조회한다).
describe("새로 만든 교재도 과목 키워드·단원을 바로 쓴다", () => {

  // 2026-09-14 — 라이브러리 탭을 합쳤다. 새 교재 만들기는 막았다.
  it("새 교재 만들기 버튼이 없다", () => {
    render(<Wrapper initialDocs={[existingDocListItem]} subjects={subjects} />);
    expect(screen.queryByText("+ 새 교재 만들기")).not.toBeInTheDocument();
  });

  it("키워드별 보기(기본)는 과목 › 키워드로 접히고, 단원별 보기는 그 키워드가 붙은 단원마다 교재가 나온다", () => {
    const pdf = {
      ...existingDocListItem,
      id: "pdf1",
      title: "Words Core",
      kind: "pdf" as const,
      hasPrimaryKeyword: true,
      primaryKeywordId: "kw1",
      primaryKeywordLabel: "이차방정식",
      hasDriveSource: true,
      sourceDriveName: "SAT_..._Core_v1.pdf",
    };
    render(<Wrapper initialDocs={[existingDocListItem, pdf]} subjects={subjects} />);
    const groups = screen.getAllByTestId("doc-group");
    expect(groups.map((g) => g.textContent)).toEqual([
      expect.stringContaining("SAT Math › 이차방정식"),
      expect.stringContaining("SAT Math › (키워드 미지정)"),
    ]);
    // 원 파일명과 노출용 이름이 함께 보인다.
    expect(screen.getByText("SAT_..._Core_v1.pdf")).toBeInTheDocument();
    expect(screen.getByLabelText("SAT_..._Core_v1.pdf 노출용 이름")).toHaveValue("Words Core");

    fireEvent.click(screen.getByRole("button", { name: "단원별 보기" }));
    const unitGroups = screen.getAllByTestId("doc-group").map((g) => g.textContent ?? "");
    expect(unitGroups.some((t) => t.includes("1. 함수의 기초") && t.includes("Words Core"))).toBe(true);
    expect(unitGroups.some((t) => t.includes("(단원에 아직 안 들어감)"))).toBe(true);
  });
});
