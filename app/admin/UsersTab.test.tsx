import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UsersTab from "./UsersTab";
import type { ParentListItem, StudentListItem, TeacherListItem } from "./users-data";
import {
  listParentsForUsersTabAction,
  listStudentsForUsersTabAction,
  listTeachersForUsersTabAction,
} from "./users-actions";

vi.mock("./users-actions", () => ({
  inviteStudent: vi.fn(),
  inviteTeacher: vi.fn(),
  setStudentStatus: vi.fn(),
  setTeacherStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
  setTeacherHourlyRate: vi.fn(),
  verifyStudentDateOfBirth: vi.fn(),
  listParentsForUsersTabAction: vi.fn(),
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
    householdId: "h1",
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
  subjects: [],
};

describe("UsersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listParentsForUsersTabAction).mockResolvedValue({ ok: true, data: parents });
    vi.mocked(listStudentsForUsersTabAction).mockResolvedValue({
      students,
      creditHistoryByStudent: {},
    });
    vi.mocked(listTeachersForUsersTabAction).mockResolvedValue({
      teachers,
      qcWarningsByTeacher: { t1: [{}, {}] as never },
    });
  });

  it("최초 진입 시 스켈레톤을 먼저 보여준 뒤 학부모 목록으로 대체된다", async () => {
    render(<UsersTab {...baseProps} />);
    expect(screen.getByTestId("parents-skeleton")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("김민지")).toBeInTheDocument());
    expect(screen.getByText(/자녀: 지훈/)).toBeInTheDocument();
    expect(screen.queryByTestId("parents-skeleton")).not.toBeInTheDocument();
  });

  it("학부모 조회가 실패하면 목록 영역에만 오류·다시 시도를 보여주고, 페이지 전체는 깨지지 않는다", async () => {
    vi.mocked(listParentsForUsersTabAction).mockResolvedValue({ ok: false, errorCode: "email_rpc_failed:권한 없음" });
    render(<UsersTab {...baseProps} />);

    await waitFor(() => expect(screen.getByTestId("parents-error")).toBeInTheDocument());
    expect(screen.getByText("불러오지 못했습니다")).toBeInTheDocument();

    // 다른 서브탭(관리자 셸의 나머지 부분에 해당)은 정상 동작 — 페이지가
    // 통째로 깨지지 않았음을 확인.
    fireEvent.click(screen.getByText("학생"));
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
  });

  it("다시 시도를 누르면 학부모 조회를 다시 호출하고 성공하면 목록을 보여준다", async () => {
    vi.mocked(listParentsForUsersTabAction).mockResolvedValueOnce({ ok: false, errorCode: "parents_query_failed:unknown" });
    render(<UsersTab {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("parents-error")).toBeInTheDocument());

    vi.mocked(listParentsForUsersTabAction).mockResolvedValueOnce({ ok: true, data: parents });
    fireEvent.click(screen.getByText("다시 시도"));

    await waitFor(() => expect(screen.getByText("김민지")).toBeInTheDocument());
    expect(listParentsForUsersTabAction).toHaveBeenCalledTimes(2);
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
