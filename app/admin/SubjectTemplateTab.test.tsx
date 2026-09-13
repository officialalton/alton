import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  renameSubjectKeyword: vi.fn(),
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
      ok: true,
      value: { id: "kw1", label: "이차방정식", status: "active" },
    });
    vi.mocked(actions.assignUnitKeyword).mockResolvedValue({ ok: true });
    vi.mocked(actions.removeUnitKeyword).mockResolvedValue({ ok: true });
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));

    fireEvent.change(screen.getByPlaceholderText("새 키워드 (예: 이차방정식)"), {
      target: { value: "이차방정식" },
    });
    fireEvent.click(screen.getByText("추가"));
    await waitFor(() => expect(actions.createSubjectKeyword).toHaveBeenCalledWith("sub1", "이차방정식"));

    // 사전에 등록된 뒤에는 회차별 태그 버튼으로도 나타난다(두 곳 모두 표시).
    await waitFor(() => expect(screen.getAllByText("이차방정식").length).toBeGreaterThanOrEqual(2));

    fireEvent.click(screen.getByLabelText("함수의 기초 회차에 이차방정식 태그"));
    await waitFor(() => expect(actions.assignUnitKeyword).toHaveBeenCalledWith("u1", "kw1"));

    fireEvent.click(screen.getByLabelText("함수의 기초 회차에 이차방정식 해제"));
    await waitFor(() => expect(actions.removeUnitKeyword).toHaveBeenCalledWith("u1", "kw1"));
  });

  it("2026-09-10(P0-2) — 키워드 추가 실패는 { ok:false, error } 문구만 안내하고 던지지 않는다(Minified React error #441 마스킹 버그 재발 방지)", async () => {
    vi.mocked(actions.createSubjectKeyword).mockResolvedValue({
      ok: false,
      error: "이미 존재하는 키워드입니다.",
    });
    render(<Wrapper initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));

    fireEvent.change(screen.getByPlaceholderText("새 키워드 (예: 이차방정식)"), {
      target: { value: "중복키워드" },
    });
    fireEvent.click(screen.getByText("추가"));

    await waitFor(() => expect(screen.getByText("이미 존재하는 키워드입니다.")).toBeInTheDocument());
    // 새로 만든 값이 화면 상태(사전)에는 반영되지 않아야 한다 — DB/화면 불일치 방지.
    expect(screen.queryByText("중복키워드")).not.toBeInTheDocument();
  });
});

// P2/P3 2차 — 키워드 이름 수정.
// 키워드는 교재·문제·회차가 전부 id로 참조한다. 그래서 이름을 고치는 것이
// "새로 만들어 옮기기"보다 안전하다 — 붙어 있던 연결이 그대로 유지된다.
describe("과목 키워드 이름 수정", () => {
  beforeEach(() => vi.clearAllMocks());

  // 단원 제목과 겹치지 않는 키워드를 쓴다 — 겹치면 무엇을 눌렀는지 알 수 없다.
  const withKeyword: AdminSubject = {
    ...satMath,
    keywords: [{ id: "kw1", label: "포물선", status: "active" }],
  };

  function openKeywordEditor() {
    render(<Wrapper initialSubjects={[withKeyword]} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByTitle("이름 고치기"));
    return screen.getByLabelText("포물선 이름 고치기");
  }

  it("이름을 고치면 목록에 새 이름이 보인다", async () => {
    vi.mocked(actions.renameSubjectKeyword).mockResolvedValue({
      ok: true,
      value: { id: "kw1", label: "포물선의 축", status: "active" },
    });
    const input = openKeywordEditor();
    fireEvent.change(input, { target: { value: "포물선의 축" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(actions.renameSubjectKeyword).toHaveBeenCalledWith("kw1", "포물선의 축"));
    await waitFor(() => expect(screen.getByTitle("이름 고치기")).toHaveTextContent("포물선의 축"));
  });

  it("이름이 겹치면 사유를 보여주고 편집 상태를 유지한다", async () => {
    vi.mocked(actions.renameSubjectKeyword).mockResolvedValue({
      ok: false,
      error: "같은 과목에 이미 있는 키워드 이름입니다.",
    });
    const input = openKeywordEditor();
    fireEvent.change(input, { target: { value: "삼각함수" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByText("같은 과목에 이미 있는 키워드 이름입니다.")).toBeInTheDocument()
    );
    // 고치던 값을 잃지 않아야 한다 — 다시 입력하게 만들면 안 된다.
    expect(screen.getByLabelText("포물선 이름 고치기")).toHaveValue("삼각함수");
  });

  it("바꾸지 않고 빠져나오면 아무것도 부르지 않는다", async () => {
    const input = openKeywordEditor();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(actions.renameSubjectKeyword).not.toHaveBeenCalled();
    expect(screen.getByTitle("이름 고치기")).toHaveTextContent("포물선");
  });
});
