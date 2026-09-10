import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SubjectTemplateTab from "./SubjectTemplateTab";
import * as actions from "./subject-actions";
import type { AdminSubject } from "./subject-data";

// SubjectTemplateTab은 이제 subjects를 부모(CatalogTab)에서 controlled로 받는다 —
// 부모가 CurriculumDocsTab과 같은 목록을 공유하기 위함(과목 생성 직후 다른 서브탭에서도
// 바로 보여야 하는 버그 수정). 테스트에서도 실제 부모처럼 상태를 들고 있는 래퍼가 필요하다.
function Wrapper({ initialSubjects }: { initialSubjects: AdminSubject[] }) {
  const [subjects, setSubjects] = useState(initialSubjects);
  return <SubjectTemplateTab subjects={subjects} setSubjects={setSubjects} />;
}

vi.mock("./subject-actions", () => ({
  createSubject: vi.fn(),
  renameSubject: vi.fn(),
  deleteSubject: vi.fn(),
  addSubjectUnit: vi.fn(),
  updateSubjectUnit: vi.fn(),
  removeSubjectUnit: vi.fn(),
  moveSubjectUnit: vi.fn(),
  createSubjectKeyword: vi.fn(),
  assignUnitKeyword: vi.fn(),
  removeUnitKeyword: vi.fn(),
}));

const satMath: AdminSubject = {
  subjectId: "sub1",
  subjectName: "SAT Math",
  units: [
    { id: "u1", position: 1, unitTitle: "함수의 기초", note: null },
    { id: "u2", position: 2, unitTitle: "이차방정식", note: "메모" },
  ],
};

describe("SubjectTemplateTab", () => {
  it("과목 목록과 회차 수를 보여준다", () => {
    render(<Wrapper initialSubjects={[satMath]} />);
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("2개 회차")).toBeInTheDocument();
  });

  it("새 과목을 추가할 수 있다", async () => {
    vi.mocked(actions.createSubject).mockResolvedValue({ id: "sub2", name: "AP Physics" });
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("+ 과목 추가"));
    fireEvent.change(screen.getByPlaceholderText("새 과목명"), {
      target: { value: "AP Physics" },
    });
    fireEvent.click(screen.getByText("추가"));
    await waitFor(() => expect(actions.createSubject).toHaveBeenCalledWith("AP Physics"));
    await waitFor(() => expect(screen.getByText("AP Physics")).toBeInTheDocument());
  });

  it("과목 추가 실패 시 에러 메시지를 보여준다", async () => {
    vi.mocked(actions.createSubject).mockRejectedValue(new Error("이미 존재하는 과목명입니다."));
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("+ 과목 추가"));
    fireEvent.change(screen.getByPlaceholderText("새 과목명"), {
      target: { value: "SAT Math" },
    });
    fireEvent.click(screen.getByText("추가"));
    await waitFor(() =>
      expect(screen.getByText("이미 존재하는 과목명입니다.")).toBeInTheDocument()
    );
  });

  it("편집 화면에서 회차 추가/삭제, 과목명 수정이 가능하다", async () => {
    vi.mocked(actions.addSubjectUnit).mockResolvedValue({
      id: "u3",
      position: 3,
      unitTitle: "새 회차",
      note: null,
    });
    vi.mocked(actions.removeSubjectUnit).mockResolvedValue(undefined);
    vi.mocked(actions.renameSubject).mockResolvedValue(undefined);
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));

    expect(screen.getByDisplayValue("SAT Math")).toBeInTheDocument();

    fireEvent.click(screen.getByText("+ 회차 추가"));
    await waitFor(() => expect(actions.addSubjectUnit).toHaveBeenCalledWith("sub1", 3));
    await waitFor(() => expect(screen.getByDisplayValue("새 회차")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("삭제")[0]);
    await waitFor(() => expect(actions.removeSubjectUnit).toHaveBeenCalledWith("u1"));
  });

  it("과목 삭제는 확인 단계를 거치고, 예상치 못한 오류면 에러 메시지를 보여준다", async () => {
    vi.mocked(actions.deleteSubject).mockRejectedValue(new Error("알 수 없는 오류가 발생했습니다."));
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("이 과목 삭제"));
    expect(screen.getByText(/정말 "SAT Math" 과목을 삭제하시겠습니까/)).toBeInTheDocument();
    const deleteButtons = screen.getAllByText("삭제");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(screen.getByText("알 수 없는 오류가 발생했습니다.")).toBeInTheDocument());
  });

  it("2026-09-09(UAT 지적): 사용 이력이 있는 과목은 삭제 대신 보관 처리되고, 사유가 구체적으로 표시된다", async () => {
    vi.mocked(actions.deleteSubject).mockResolvedValue({
      archived: true,
      reason: "학생 수강 이력 3건이(가) 있어 보관 처리되었습니다.",
    });
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("이 과목 삭제"));
    const deleteButtons = screen.getAllByText("삭제");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() =>
      expect(screen.getByText(/학생 수강 이력 3건이\(가\) 있어 보관 처리되었습니다\./)).toBeInTheDocument()
    );
    // 삭제된 게 아니라 보관된 것이므로 편집 화면에 그대로 남아있어야 한다.
    expect(screen.getByDisplayValue("SAT Math")).toBeInTheDocument();
  });

  it("2026-09-09(UAT 지적): 참조가 전혀 없는 과목은 실제로 삭제되어 목록에서 사라진다", async () => {
    vi.mocked(actions.deleteSubject).mockResolvedValue({ archived: false, reason: null });
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("이 과목 삭제"));
    const deleteButtons = screen.getAllByText("삭제");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(screen.queryByDisplayValue("SAT Math")).not.toBeInTheDocument());
    expect(screen.queryByText("SAT Math")).not.toBeInTheDocument();
  });

  it("2026-09-09(UAT 지적): 보관된 과목은 목록에 '보관됨' 배지와 사유가 함께 표시된다", () => {
    const archivedSubject: AdminSubject = {
      ...satMath,
      archivedAt: "2026-09-09T00:00:00.000Z",
      archivedReason: "교재 문서 1건이(가) 있어 보관 처리되었습니다.",
    };
    render(<Wrapper initialSubjects={[archivedSubject]} />);
    expect(screen.getByText("보관됨")).toBeInTheDocument();
    expect(screen.getByText(/교재 문서 1건이\(가\) 있어 보관 처리되었습니다\./)).toBeInTheDocument();
  });

  it("2026-09-09(UAT 지적, 제품 오너 승인): 과목 키워드를 추가하면 사전에 반영되고, 회차에 태그·해제할 수 있다", async () => {
    vi.mocked(actions.createSubjectKeyword).mockResolvedValue({
      id: "kw1",
      label: "이차방정식",
      status: "active",
    });
    vi.mocked(actions.assignUnitKeyword).mockResolvedValue(undefined);
    vi.mocked(actions.removeUnitKeyword).mockResolvedValue(undefined);
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));

    fireEvent.change(screen.getByPlaceholderText("새 키워드 (예: 이차방정식)"), {
      target: { value: "이차방정식" },
    });
    fireEvent.click(screen.getByText("추가"));
    await waitFor(() => expect(actions.createSubjectKeyword).toHaveBeenCalledWith("sub1", "이차방정식"));

    // 사전에 등록된 뒤에는 회차별 태그 버튼으로도 나타난다(두 곳 모두 표시).
    await waitFor(() => expect(screen.getAllByText("이차방정식").length).toBeGreaterThanOrEqual(2));

    const tagButtons = screen.getAllByText("이차방정식").filter((el) => el.tagName === "BUTTON");
    fireEvent.click(tagButtons[0]);
    await waitFor(() => expect(actions.assignUnitKeyword).toHaveBeenCalledWith("u1", "kw1"));

    fireEvent.click(tagButtons[0]);
    await waitFor(() => expect(actions.removeUnitKeyword).toHaveBeenCalledWith("u1", "kw1"));
  });
});
