import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SubjectEnrollmentPanel from "./SubjectEnrollmentPanel";
import * as actions from "./subject-enrollment-actions";
import * as matchingActions from "./matching-actions";
import * as terminationActions from "./teacher-assignment-termination-actions";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

vi.mock("./subject-enrollment-actions", () => ({
  listSubjectEnrollmentsForChild: vi.fn(),
  checkSubjectEnrollmentActivationReadiness: vi.fn(),
  activateSubjectEnrollment: vi.fn(),
  listFutureBookingImpact: vi.fn(),
  changeTeacherAssignment: vi.fn(),
  listTeacherAssignmentHistory: vi.fn(),
  listDocumentPermissionRetries: vi.fn(),
}));

vi.mock("./matching-actions", () => ({
  confirmMatch: vi.fn(),
}));

vi.mock("./teacher-assignment-termination-actions", () => ({
  adminTerminateAssignmentNow: vi.fn(),
  previewTerminationImpactAction: vi.fn(),
}));

const student: StudentListItem = {
  id: "st1",
  name: "지훈",
  email: "jihoon@example.com",
  grade: "10학년",
  status: "active",
  creditBalance: 0,
  parentNames: [],
  subjectNames: [],
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
};

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
  { subjectId: "sub2", subjectName: "AP Bio", units: [] },
];

describe("SubjectEnrollmentPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and shows a child's subject enrollments on selection", async () => {
    vi.mocked(actions.listSubjectEnrollmentsForChild).mockResolvedValue([
      {
        id: "en1",
        childId: "st1",
        childName: "지훈",
        subjectId: "sub1",
        subjectName: "SAT Math",
        status: "planned",
        contractId: "c1",
        currentTeacherId: null,
        currentTeacherName: null,
        currentTeacherAssignmentId: null,
        createdAt: "2026-01-01",
      },
    ]);

    render(
      <SubjectEnrollmentPanel students={[student]} subjects={subjects} teacherCandidatesBySubject={{}} />
    );

    fireEvent.click(screen.getByText("지훈"));

    await waitFor(() => expect(screen.getByText(/SAT Math/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "활성화" })).toBeInTheDocument();
  });

  it("shows blocked activation reason instead of a raw error", async () => {
    vi.mocked(actions.listSubjectEnrollmentsForChild).mockResolvedValue([
      {
        id: "en1",
        childId: "st1",
        childName: "지훈",
        subjectId: "sub1",
        subjectName: "SAT Math",
        status: "planned",
        contractId: "c1",
        currentTeacherId: null,
        currentTeacherName: null,
        currentTeacherAssignmentId: null,
        createdAt: "2026-01-01",
      },
    ]);
    vi.mocked(actions.checkSubjectEnrollmentActivationReadiness).mockResolvedValue({
      canActivate: false,
      blockedBy: "contract_not_active",
    });

    render(
      <SubjectEnrollmentPanel students={[student]} subjects={subjects} teacherCandidatesBySubject={{}} />
    );
    fireEvent.click(screen.getByText("지훈"));
    await waitFor(() => screen.getByRole("button", { name: "활성화" }));
    fireEvent.click(screen.getByRole("button", { name: "활성화" }));

    await waitFor(() =>
      expect(screen.getByText("기본계약이 아직 active 상태가 아닙니다.")).toBeInTheDocument()
    );
    expect(actions.activateSubjectEnrollment).not.toHaveBeenCalled();
  });

  // C-2(2차, 2026-09-11) — 종료(terminated)된 과목도 "새 배정" 과목 선택지에
  // 다시 나와서 같은/다른 교사로 재배정할 수 있어야 한다(재등록 정책). 활성
  // 배정이 있는 과목(sub1, 이미 지훈 선생님 배정됨)만 후보에서 빠진다.
  it("과목 선택→선생님 선택→배정 확인 한 흐름으로 배정하고, 종료된 과목도 다시 선택할 수 있다", async () => {
    vi.mocked(actions.listSubjectEnrollmentsForChild).mockResolvedValue([
      {
        id: "en1",
        childId: "st1",
        childName: "지훈",
        subjectId: "sub1",
        subjectName: "SAT Math",
        status: "active",
        contractId: "c1",
        currentTeacherId: "t1",
        currentTeacherName: "박서연",
        currentTeacherAssignmentId: "ta1",
        createdAt: "2026-01-01",
      },
      {
        id: "en2",
        childId: "st1",
        childName: "지훈",
        subjectId: "sub2",
        subjectName: "AP Bio",
        status: "terminated",
        contractId: "c1",
        currentTeacherId: null,
        currentTeacherName: null,
        currentTeacherAssignmentId: null,
        createdAt: "2026-01-01",
      },
    ]);
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue({
      ok: true,
      subjectEnrollmentId: "en2-new",
      teacherAssignmentId: "ta2",
      overlayId: null,
      activationWarning: null,
      curriculumWarning: null,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SubjectEnrollmentPanel
        students={[student]}
        subjects={subjects}
        teacherCandidatesBySubject={{ sub2: [{ id: "t3", name: "이도현" }] }}
      />
    );
    fireEvent.click(screen.getByText("지훈"));
    await waitFor(() => screen.getByText(/새 배정: 과목 선택/));

    // sub1(활성 배정 있음)은 후보로 없고, sub2(terminated)는 있어야 한다.
    const subjectSelect = screen.getByDisplayValue("+ 새 배정: 과목 선택...");
    expect(screen.queryByText("SAT Math", { selector: "option" })).toBeNull();
    fireEvent.change(subjectSelect, { target: { value: "sub2" } });

    const teacherSelect = await screen.findByDisplayValue("선생님 선택...");
    fireEvent.change(teacherSelect, { target: { value: "t3" } });
    fireEvent.click(screen.getByText("배정 확인"));

    await waitFor(() =>
      expect(matchingActions.confirmMatch).toHaveBeenCalledWith("st1", "t3", "sub2")
    );
  });

  // C-2(2차, 2026-09-11) — 관리자 직접 종료는 요청 생성→목록 재처리 두 단계가
  // 아니라 "배정 종료 → 영향 확인 → 실행" 한 흐름이어야 한다.
  it("배정 종료 버튼을 누르면 영향을 미리 보여주고, 확인하면 adminTerminateAssignmentNow를 한 번만 호출한다", async () => {
    vi.mocked(actions.listSubjectEnrollmentsForChild).mockResolvedValue([
      {
        id: "en1",
        childId: "st1",
        childName: "지훈",
        subjectId: "sub1",
        subjectName: "SAT Math",
        status: "active",
        contractId: "c1",
        currentTeacherId: "t1",
        currentTeacherName: "박서연",
        currentTeacherAssignmentId: "ta1",
        createdAt: "2026-01-01",
      },
    ]);
    vi.mocked(terminationActions.previewTerminationImpactAction).mockResolvedValue([
      { reservationId: "r1", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-01T01:00:00Z", hasActiveHold: true },
    ]);
    vi.mocked(terminationActions.adminTerminateAssignmentNow).mockResolvedValue({ status: "completed" });

    render(
      <SubjectEnrollmentPanel students={[student]} subjects={subjects} teacherCandidatesBySubject={{}} />
    );
    fireEvent.click(screen.getByText("지훈"));
    await waitFor(() => screen.getByText("배정 종료"));
    fireEvent.click(screen.getByText("배정 종료"));

    expect(await screen.findByText(/박서연.*정말 종료할까요/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/영향받는 미래 예약 1건/)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("종료 사유"), { target: { value: "학생 요청" } });
    fireEvent.click(screen.getByText("종료 실행"));

    await waitFor(() =>
      expect(terminationActions.adminTerminateAssignmentNow).toHaveBeenCalledWith({
        subjectEnrollmentId: "en1",
        teacherAssignmentId: "ta1",
        reason: "학생 요청",
      })
    );
    expect(terminationActions.adminTerminateAssignmentNow).toHaveBeenCalledTimes(1);
  });
});
