import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SubjectTemplateTab from "./SubjectTemplateTab";
import * as actions from "./subject-actions";
import type { AdminSubject } from "./subject-data";

vi.mock("./subject-actions", () => ({
  createSubject: vi.fn(),
  renameSubject: vi.fn(),
  deleteSubject: vi.fn(),
  addSubjectUnit: vi.fn(),
  updateSubjectUnit: vi.fn(),
  removeSubjectUnit: vi.fn(),
  moveSubjectUnit: vi.fn(),
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
    render(<SubjectTemplateTab initialSubjects={[satMath]} />);
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("2개 회차")).toBeInTheDocument();
  });

  it("새 과목을 추가할 수 있다", async () => {
    vi.mocked(actions.createSubject).mockResolvedValue({ id: "sub2", name: "AP Physics" });
    render(<SubjectTemplateTab initialSubjects={[satMath]} />);
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
    render(<SubjectTemplateTab initialSubjects={[satMath]} />);
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
    render(<SubjectTemplateTab initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));

    expect(screen.getByDisplayValue("SAT Math")).toBeInTheDocument();

    fireEvent.click(screen.getByText("+ 회차 추가"));
    await waitFor(() => expect(actions.addSubjectUnit).toHaveBeenCalledWith("sub1", 3));
    await waitFor(() => expect(screen.getByDisplayValue("새 회차")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("삭제")[0]);
    await waitFor(() => expect(actions.removeSubjectUnit).toHaveBeenCalledWith("u1"));
  });

  it("과목 삭제는 확인 단계를 거치고, 실패 시 에러 메시지를 보여준다", async () => {
    vi.mocked(actions.deleteSubject).mockRejectedValue(
      new Error("이 과목은 이미 선생님 커리큘럼/매칭/교재 등에서 사용 중이라 삭제할 수 없습니다.")
    );
    render(<SubjectTemplateTab initialSubjects={[satMath]} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("이 과목 삭제"));
    expect(screen.getByText(/정말 "SAT Math" 과목을 삭제하시겠습니까/)).toBeInTheDocument();
    const deleteButtons = screen.getAllByText("삭제");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() =>
      expect(
        screen.getByText("이 과목은 이미 선생님 커리큘럼/매칭/교재 등에서 사용 중이라 삭제할 수 없습니다.")
      ).toBeInTheDocument()
    );
  });
});
