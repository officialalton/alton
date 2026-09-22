import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CatalogTab from "./CatalogTab";
import { listSubjectCatalogAction } from "./subject-actions";

// 교재 서브탭이 AI 생성 액션을 import하는데, 그 모듈이 로드 시점에 Anthropic
// 클라이언트를 만든다(브라우저 환경에서 거부됨). 이 테스트가 보는 것은 과목
// 목록의 첫 진입 동작이므로 그 모듈은 대역으로 둔다.
vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateCurriculumDoc: vi.fn(),
  publishCurriculumDoc: vi.fn(),
  unpublishCurriculumDoc: vi.fn(),
  deleteCurriculumDoc: vi.fn(),
  generateCurriculumDocDraft: vi.fn(),
  addDocSection: vi.fn(),
  updateDocSection: vi.fn(),
  removeDocSection: vi.fn(),
  moveDocSection: vi.fn(),
  assignSectionKeyword: vi.fn(),
  removeSectionKeyword: vi.fn(),
  listCurriculumDocsAction: vi.fn(async () => []),
}));

vi.mock("./subject-actions", () => ({
  listSubjectCatalogAction: vi.fn(),
  createSubject: vi.fn(),
  renameSubject: vi.fn(),
  deleteSubject: vi.fn(),
  addSubjectUnit: vi.fn(),
  updateSubjectUnit: vi.fn(),
  removeSubjectUnit: vi.fn(),
  createSubjectKeyword: vi.fn(),
  assignUnitKeyword: vi.fn(),
  removeUnitKeyword: vi.fn(),
  moveSubjectUnit: vi.fn(),
  archiveSubject: vi.fn(),
  restoreSubject: vi.fn(),
}));

const subject = { subjectId: "s1", subjectName: "SAT Math", units: [], keywords: [] };

beforeEach(() => {
  vi.clearAllMocks();
  (listSubjectCatalogAction as ReturnType<typeof vi.fn>).mockResolvedValue([subject]);
});

describe("과목 템플릿 첫 진입", () => {
  it("SSR prop이 비어 있어도 화면이 스스로 불러온다", async () => {
    render(<CatalogTab subjects={[]} docs={[]} />);
    await waitFor(() => expect(screen.getByText("SAT Math")).toBeInTheDocument());
    expect(listSubjectCatalogAction).toHaveBeenCalled();
  });

  it("불러오는 중임을 '과목이 없음'과 구분해 보여준다", () => {
    (listSubjectCatalogAction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );
    render(<CatalogTab subjects={[]} docs={[]} />);
    expect(screen.getByText("과목을 불러오는 중…")).toBeInTheDocument();
  });

  it("실제로 비어 있으면 목록이 비었음을 보여준다(로딩 문구가 남지 않는다)", async () => {
    (listSubjectCatalogAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<CatalogTab subjects={[]} docs={[]} />);
    await waitFor(() =>
      expect(screen.queryByText("과목을 불러오는 중…")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("SAT Math")).not.toBeInTheDocument();
  });

  it("실패하면 사유와 다시 시도를 준다", async () => {
    (listSubjectCatalogAction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("관리자만 사용할 수 있습니다.")
    );
    render(<CatalogTab subjects={[]} docs={[]} />);
    await waitFor(() =>
      expect(screen.getByText("관리자만 사용할 수 있습니다.")).toBeInTheDocument()
    );
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
  });

  it("다시 시도를 누르면 한 번 더 불러온다", async () => {
    (listSubjectCatalogAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("일시적 오류")
    );
    render(<CatalogTab subjects={[]} docs={[]} />);
    await waitFor(() => expect(screen.getByText("다시 시도")).toBeInTheDocument());
    fireEvent.click(screen.getByText("다시 시도"));
    await waitFor(() => expect(screen.getByText("SAT Math")).toBeInTheDocument());
  });

  // 2026-09-22(성능 전수 점검) — SSR이 이미 받아 온 값이 있으면 마운트 시
  // 다시 조회하지 않는다(예전엔 "배경 갱신"이라며 매번 다시 불러 매 탭 진입마다
  // 불필요한 왕복이 있었다 — 갱신할 신선도 문제가 없었다).
  it("SSR prop이 있으면 즉시 보여주고 다시 조회하지 않는다", () => {
    render(<CatalogTab subjects={[subject]} docs={[]} />);
    // 첫 렌더부터 보인다(로딩 문구로 가리지 않는다).
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(listSubjectCatalogAction).not.toHaveBeenCalled();
  });
});
