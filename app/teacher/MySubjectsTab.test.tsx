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
  units: [
    { id: "u1", position: 1, unitTitle: "함수의 기초", note: null, teacherComment: null },
    { id: "u7", position: 7, unitTitle: "이차방정식 응용", note: "실수 유형", teacherComment: null },
  ],
};

const withoutTemplate: MySubject = {
  subjectId: "sub2",
  subjectName: "AP Statistics",
  templateId: null,
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
