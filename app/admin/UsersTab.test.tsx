import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UsersTab from "./UsersTab";
import * as actions from "./users-actions";
import type { ParentListItem, StudentListItem, TeacherListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  inviteParent: vi.fn(),
  inviteStudent: vi.fn(),
  inviteTeacher: vi.fn(),
  setStudentStatus: vi.fn(),
  setTeacherStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
  setTeacherCalendlyUrl: vi.fn(),
}));

const parents: ParentListItem[] = [
  {
    id: "p1",
    name: "김민지",
    email: "minji.kim@example.com",
    joinedAt: "2026-01-01T00:00:00.000Z",
    childrenNames: ["지훈"],
  },
];

const students: StudentListItem[] = [
  {
    id: "s1",
    name: "지훈",
    email: "jihoon@example.com",
    grade: "10학년",
    status: "active",
    creditBalance: 14,
    parentNames: ["김민지"],
    subjectNames: ["SAT Math"],
  },
];

const teachers: TeacherListItem[] = [
  {
    id: "t1",
    name: "박서연 선생님",
    email: "seoyeon@example.com",
    school: "서울대학교",
    status: "active",
    qcWarningCount: 2,
    subjectNames: ["SAT Math"],
    calendlySchedulingUrl: null,
  },
];

const baseProps = {
  initialParents: parents,
  initialStudents: students,
  initialTeachers: teachers,
  creditHistoryByStudent: {},
  qcWarningsByTeacher: {},
};

describe("UsersTab", () => {
  it("기본 서브탭은 학부모이고 목록을 보여준다", () => {
    render(<UsersTab {...baseProps} />);
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText(/자녀: 지훈/)).toBeInTheDocument();
  });

  it("학생 서브탭에서 학생을 클릭하면 상세로 이동한다", () => {
    render(<UsersTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생"));
    fireEvent.click(screen.getByText("지훈"));
    expect(screen.getByText("수업권")).toBeInTheDocument();
    expect(screen.getByText("14장")).toBeInTheDocument();
  });

  it("선생님 서브탭에서 QC 경고 횟수를 보여준다", () => {
    render(<UsersTab {...baseProps} />);
    fireEvent.click(screen.getByText("선생님"));
    expect(screen.getByText(/QC 경고 2회/)).toBeInTheDocument();
  });

  it("학부모 초대 폼을 제출하면 inviteParent가 호출되고 목록에 추가된다", async () => {
    vi.mocked(actions.inviteParent).mockResolvedValue(undefined);
    render(<UsersTab {...baseProps} />);
    fireEvent.click(screen.getByText("+ 초대"));
    fireEvent.change(screen.getByPlaceholderText("이름"), { target: { value: "최유진" } });
    fireEvent.change(screen.getByPlaceholderText("이메일"), {
      target: { value: "yujin@example.com" },
    });
    fireEvent.click(screen.getByText("초대 보내기"));
    await waitFor(() =>
      expect(actions.inviteParent).toHaveBeenCalledWith({
        name: "최유진",
        email: "yujin@example.com",
      })
    );
    await waitFor(() => expect(screen.getByText("최유진")).toBeInTheDocument());
  });
});
