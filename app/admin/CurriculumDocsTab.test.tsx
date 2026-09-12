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
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    units: [{ id: "u1", position: 1, unitTitle: "함수의 기초", note: null }],
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
};

const existingDocDetail: DocEditorData = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  subjectId: "sub1",
  subjectName: "SAT Math",
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
    expect(screen.getByText("아직 만든 교재가 없습니다.")).toBeInTheDocument();
  });

  it("새 교재 만들기 폼에서 제목/과목/단원을 골라 생성하면 바로 에디터로 이동한다", async () => {
    vi.mocked(docActions.createCurriculumDoc).mockResolvedValue({ id: "doc2" });
    render(<Wrapper initialDocs={[]} subjects={subjects} />);

    fireEvent.click(screen.getByText("+ 새 교재 만들기"));
    fireEvent.change(screen.getByPlaceholderText("예: 이차방정식 개념 정리"), {
      target: { value: "새 교재" },
    });
    fireEvent.click(screen.getByText("SAT Math"));
    fireEvent.click(screen.getByText("1회차 · 함수의 기초"));
    fireEvent.click(screen.getByText("만들기"));

    await waitFor(() =>
      expect(docActions.createCurriculumDoc).toHaveBeenCalledWith({
        title: "새 교재",
        subjectId: "sub1",
        unitId: "u1",
      })
    );
    // 새로 만든 교재는 이미 전체 데이터를 들고 있으므로(빈 sections) 추가
    // 조회 없이 바로 에디터로 진입한다 — getCurriculumDocDetailAction 호출 없음.
    await waitFor(() => expect(screen.getByDisplayValue("새 교재")).toBeInTheDocument());
    expect(docActions.getCurriculumDocDetailAction).not.toHaveBeenCalled();
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
