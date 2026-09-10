import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UsersTab from "./UsersTab";
import type { ParentListItem, StudentListItem, TeacherListItem } from "./users-data";
import { listStudentsForUsersTabAction, listTeachersForUsersTabAction } from "./users-actions";

vi.mock("./users-actions", () => ({
  inviteStudent: vi.fn(),
  inviteTeacher: vi.fn(),
  setStudentStatus: vi.fn(),
  setTeacherStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
  setTeacherHourlyRate: vi.fn(),
  verifyStudentDateOfBirth: vi.fn(),
  listStudentsForUsersTabAction: vi.fn(),
  listTeachersForUsersTabAction: vi.fn(),
}));

vi.mock("./teacher-subjects-actions", () => ({
  assignTeacherSubject: vi.fn(),
  unassignTeacherSubject: vi.fn(),
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
    dateOfBirth: null,
    dateOfBirthVerifiedAt: null,
    schoolName: null,
    satScore: 0,
    gpa: null,
    gpaScale: null,
    targetColleges: [],
    intendedMajors: [],
    profileCompletedAt: null,
    apCourseCount: 0,
    extracurricularCount: 0,
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
    assignedSubjectIds: [],
    hourlyRateKrw: null,
  },
];

const baseProps = {
  initialParents: parents,
  subjects: [],
};

describe("UsersTab", () => {
  beforeEach(() => {
    vi.mocked(listStudentsForUsersTabAction).mockResolvedValue({
      students,
      creditHistoryByStudent: {},
    });
    vi.mocked(listTeachersForUsersTabAction).mockResolvedValue({
      teachers,
      qcWarningsByTeacher: { t1: [{}, {}] as never },
    });
  });

  it("기본 서브탭은 학부모이고 목록을 보여준다", () => {
    render(<UsersTab {...baseProps} />);
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText(/자녀: 지훈/)).toBeInTheDocument();
  });

  it("학생 서브탭에서 학생을 클릭하면 상세로 이동한다", async () => {
    render(<UsersTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생"));
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    fireEvent.click(screen.getByText("지훈"));
    expect(screen.getByText("수업권")).toBeInTheDocument();
    expect(screen.getByText("14장")).toBeInTheDocument();
  });

  it("선생님 서브탭에서 QC 경고 횟수를 보여준다", async () => {
    render(<UsersTab {...baseProps} />);
    fireEvent.click(screen.getByText("선생님"));
    await waitFor(() => expect(screen.getByText(/QC 경고 2회/)).toBeInTheDocument());
  });

  // (2026-09-07) 레거시 "학부모 초대" 폼은 제거됐다(DirectAccountCreationForm의
  // "지인/추천"이 완전히 상위 호환) — 관련 테스트도 함께 제거했다.
});
