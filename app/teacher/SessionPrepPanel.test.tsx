import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionPrepPanel from "./SessionPrepPanel";
import * as actions from "./session-prep-actions";
import type { OverlayUnit, LibraryKeyword } from "./student-curriculum-data";

vi.mock("./session-prep-actions", () => ({
  loadHeldSelectionsForEnrollment: vi.fn(),
  loadSessionSelectionForSession: vi.fn(),
  loadEligibleContent: vi.fn(),
  createPreparedSelection: vi.fn(),
  addUnitToSelection: vi.fn(),
  removeUnitFromSelection: vi.fn(),
  setSelectionActiveKeywords: vi.fn(),
  pickContentItem: vi.fn(),
  excludeContentItem: vi.fn(),
  includeContentItem: vi.fn(),
  attachSelectionToSession: vi.fn(),
  pinSessionSelection: vi.fn(),
}));

const overlayUnits: OverlayUnit[] = [
  {
    id: "ou1",
    sourceUnitId: "src1",
    position: 1,
    unitTitle: "이차방정식",
    note: null,
    status: "in_progress",
    statusChangedAt: null,
    keywordIds: ["kw1"],
    materialDocIds: [],
  },
];

const keywords: LibraryKeyword[] = [{ id: "kw1", label: "판별식" }];

// 2026-09-09(UAT 지적, 제품 오너 승인) 최초 구현 테스트 — session-prep-actions.ts
// 백엔드는 있었지만 이를 실제로 쓰는 화면이 없었다. 핵심 흐름(시작 → 회차 포함
// → 키워드 지정 → 후보 선택 → 세션 고정)이 실제로 서버 액션을 호출하는지 검증.
describe("SessionPrepPanel", () => {
  it("준비된 선택이 없으면 '새 세션 준비 시작' 버튼이 보이고, 누르면 생성된다", async () => {
    vi.mocked(actions.loadHeldSelectionsForEnrollment).mockResolvedValue([]);
    vi.mocked(actions.createPreparedSelection).mockResolvedValue("sel1");
    render(
      <SessionPrepPanel subjectEnrollmentId="se1" overlayUnits={overlayUnits} keywords={keywords} sessionId={null} studentName="지훈" subjectName="SAT Math" onBack={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByText("+ 새 세션 준비 시작")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ 새 세션 준비 시작"));
    await waitFor(() => expect(actions.createPreparedSelection).toHaveBeenCalledWith("se1"));
    await waitFor(() => expect(screen.getByText("이차방정식", { selector: "button" })).toBeInTheDocument());
  });

  it("회차를 포함시키면 addUnitToSelection이 호출되고, 키워드를 고르면 setSelectionActiveKeywords가 호출된다", async () => {
    vi.mocked(actions.loadHeldSelectionsForEnrollment).mockResolvedValue([
      { id: "sel1", subjectEnrollmentId: "se1", teacherId: "t1", status: "staged", sessionId: null, pinnedAt: null, units: [], contentItems: [] },
    ]);
    vi.mocked(actions.loadEligibleContent).mockResolvedValue({ materialSections: [], problems: [] });
    vi.mocked(actions.addUnitToSelection).mockResolvedValue("su1");
    vi.mocked(actions.setSelectionActiveKeywords).mockResolvedValue({ ok: true });

    render(
      <SessionPrepPanel subjectEnrollmentId="se1" overlayUnits={overlayUnits} keywords={keywords} sessionId={null} studentName="지훈" subjectName="SAT Math" onBack={vi.fn()} />
    );

    const unitButton = await screen.findByText("이차방정식", { selector: "button" });
    fireEvent.click(unitButton);
    await waitFor(() => expect(actions.addUnitToSelection).toHaveBeenCalledWith("sel1", "ou1"));

    const keywordButton = await screen.findByText("판별식");
    fireEvent.click(keywordButton);
    await waitFor(() => expect(actions.setSelectionActiveKeywords).toHaveBeenCalledWith("sel1", "su1", ["kw1"]));
  });

  it("2026-09-10(P0-2) — 키워드 변경 실패는 { ok:false, error } 문구만 안내하고 던지지 않는다(Minified React error #441 마스킹 버그 재발 방지)", async () => {
    vi.mocked(actions.loadHeldSelectionsForEnrollment).mockResolvedValue([
      { id: "sel1", subjectEnrollmentId: "se1", teacherId: "t1", status: "staged", sessionId: null, pinnedAt: null, units: [], contentItems: [] },
    ]);
    vi.mocked(actions.loadEligibleContent).mockResolvedValue({ materialSections: [], problems: [] });
    vi.mocked(actions.addUnitToSelection).mockResolvedValue("su1");
    vi.mocked(actions.setSelectionActiveKeywords).mockResolvedValue({
      ok: false,
      error: "담당 학생의 커리큘럼만 조정할 수 있습니다.",
    });

    render(
      <SessionPrepPanel subjectEnrollmentId="se1" overlayUnits={overlayUnits} keywords={keywords} sessionId={null} studentName="지훈" subjectName="SAT Math" onBack={vi.fn()} />
    );

    const unitButton = await screen.findByText("이차방정식", { selector: "button" });
    fireEvent.click(unitButton);
    await waitFor(() => expect(actions.addUnitToSelection).toHaveBeenCalledWith("sel1", "ou1"));

    const keywordButton = await screen.findByText("판별식");
    fireEvent.click(keywordButton);
    await waitFor(() =>
      expect(screen.getByText("담당 학생의 커리큘럼만 조정할 수 있습니다.")).toBeInTheDocument()
    );
  });

  it("교재 후보를 선택하면 pickContentItem이 호출되고, sessionId가 있으면 고정 버튼이 attachSelectionToSession과 pinSessionSelection을 호출한다", async () => {
    vi.mocked(actions.loadHeldSelectionsForEnrollment).mockResolvedValue([
      {
        id: "sel1",
        subjectEnrollmentId: "se1",
        teacherId: "t1",
        status: "staged",
        sessionId: "sess1",
        pinnedAt: null,
        units: [{ id: "su1", overlayUnitId: "ou1", position: 1, keywordIds: ["kw1"] }],
        contentItems: [],
      },
    ]);
    vi.mocked(actions.loadEligibleContent).mockResolvedValue({
      materialSections: [{ sectionId: "sec1", title: "판별식 개념", curriculumDocId: "doc1", keywordId: "kw1" }],
      problems: [],
    });
    vi.mocked(actions.pickContentItem).mockResolvedValue("ci1");
    vi.mocked(actions.attachSelectionToSession).mockResolvedValue(undefined);
    vi.mocked(actions.pinSessionSelection).mockResolvedValue(undefined);

    render(
      <SessionPrepPanel subjectEnrollmentId="se1" overlayUnits={overlayUnits} keywords={keywords} sessionId="sess1" studentName="지훈" subjectName="SAT Math" onBack={vi.fn()} />
    );

    const pickButton = await screen.findByText("선택");
    fireEvent.click(pickButton);
    await waitFor(() => expect(actions.pickContentItem).toHaveBeenCalledWith("sel1", "su1", "material_section", "sec1"));

    const pinButton = await screen.findByText("이 세션에 고정하기(이후 수정 불가)");
    fireEvent.click(pinButton);
    await waitFor(() => expect(actions.pinSessionSelection).toHaveBeenCalledWith("sess1"));
    // sessionId가 이미 selection.sessionId와 일치하므로 attach는 다시 호출되지 않는다.
    expect(actions.attachSelectionToSession).not.toHaveBeenCalled();
  });
});
