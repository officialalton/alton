import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MySubjectsTab from "./MySubjectsTab";
import * as actions from "./mysubjects-actions";
import type { MySubject } from "./mysubjects-data";

vi.mock("./mysubjects-actions", () => ({
  createMyTemplate: vi.fn(),
  addTemplateUnit: vi.fn(),
  updateTemplateUnit: vi.fn(),
  removeTemplateUnit: vi.fn(),
  moveTemplateUnit: vi.fn(),
}));

const withTemplate: MySubject = {
  subjectId: "sub1",
  subjectName: "SAT Math",
  templateId: "tpl1",
  archived: false,
  units: [
    { id: "u1", position: 1, unitTitle: "함수의 기초", note: null, teacherComment: null },
    { id: "u7", position: 7, unitTitle: "이차방정식 응용", note: "실수 유형", teacherComment: null },
  ],
};

const withoutTemplate: MySubject = {
  subjectId: "sub2",
  subjectName: "AP Statistics",
  templateId: null,
  archived: false,
  units: [],
};

describe("MySubjectsTab", () => {
  it("템플릿 유무에 따라 편집/만들기 버튼을 다르게 보여준다", () => {
    render(<MySubjectsTab initialSubjects={[withTemplate, withoutTemplate]} />);
    expect(screen.getByText("2개 회차 구성")).toBeInTheDocument();
    expect(screen.getByText("아직 템플릿이 없습니다")).toBeInTheDocument();
    expect(screen.getByText("편집")).toBeInTheDocument();
    expect(screen.getByText("템플릿 만들기")).toBeInTheDocument();
  });

  it("템플릿 만들기를 누르면 생성 후 바로 편집 화면으로 이동한다", async () => {
    vi.mocked(actions.createMyTemplate).mockResolvedValue({
      templateId: "tpl2",
      units: [{ id: "u1", position: 1, unitTitle: "기초 통계", note: null, teacherComment: null }],
    });
    render(<MySubjectsTab initialSubjects={[withoutTemplate]} />);
    fireEvent.click(screen.getByText("템플릿 만들기"));
    await waitFor(() =>
      expect(screen.getByText("AP Statistics 커리큘럼 편집")).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue("기초 통계")).toBeInTheDocument();
  });

  it("편집 화면에서 회차를 추가/삭제할 수 있다", async () => {
    vi.mocked(actions.addTemplateUnit).mockResolvedValue({
      id: "u8",
      position: 8,
      unitTitle: "새 회차",
      note: null,
      teacherComment: null,
    });
    vi.mocked(actions.removeTemplateUnit).mockResolvedValue(undefined);
    render(<MySubjectsTab initialSubjects={[withTemplate]} />);
    fireEvent.click(screen.getByText("편집"));

    fireEvent.click(screen.getByText("+ 회차 추가"));
    await waitFor(() => expect(actions.addTemplateUnit).toHaveBeenCalledWith("tpl1", 8));
    await waitFor(() => expect(screen.getByDisplayValue("새 회차")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("삭제")[0]);
    await waitFor(() => expect(actions.removeTemplateUnit).toHaveBeenCalledWith("u1"));
  });

  it("맨 위 회차는 위로 이동 버튼이 비활성화된다", () => {
    render(<MySubjectsTab initialSubjects={[withTemplate]} />);
    fireEvent.click(screen.getByText("편집"));
    const upButtons = screen.getAllByText("↑ 위로");
    expect(upButtons[0]).toBeDisabled();
  });
});

// 보관 과목은 새 배정 대상이 아니지만, 쌓아 둔 커리큘럼에는 들어갈 수 있어야
// 한다 — 보관은 숨김이지 접근 차단이 아니다(2026-09-12 확정).
describe("MySubjectsTab — 보관된 과목", () => {
  const archivedSubject = {
    subjectId: "sub9",
    subjectName: "테스트 과목 1",
    templateId: "tpl9",
    archived: true,
    units: [{ id: "u9", position: 1, unitTitle: "회차", note: null, teacherComment: null }],
  };

  it("현재 목록에는 보관 과목이 섞이지 않는다", () => {
    render(<MySubjectsTab initialSubjects={[archivedSubject]} />);
    expect(screen.queryByText("테스트 과목 1")).not.toBeInTheDocument();
    expect(screen.getByText("담당 중인 과목이 없습니다.")).toBeInTheDocument();
  });

  it("보관됨에서 열어 커리큘럼을 계속 볼 수 있다", () => {
    render(<MySubjectsTab initialSubjects={[archivedSubject]} />);
    fireEvent.click(screen.getByText(/^보관됨/));

    expect(screen.getByText("테스트 과목 1")).toBeInTheDocument();
    // 탭 라벨과 배지가 같은 글자다 — 개수로 확인한다.
    expect(screen.getAllByText("보관됨").length).toBeGreaterThan(1);
    // 편집 진입이 살아 있어야 한다 — 접근 자체를 막으면 안 된다.
    fireEvent.click(screen.getByText("편집"));
    expect(screen.getByDisplayValue("회차")).toBeInTheDocument();
  });
});
