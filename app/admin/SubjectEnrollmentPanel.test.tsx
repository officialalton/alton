import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SubjectEnrollmentPanel from "./SubjectEnrollmentPanel";
import * as actions from "./subject-enrollment-actions";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

vi.mock("./subject-enrollment-actions", () => ({
  listSubjectEnrollmentsForChild: vi.fn(),
  planSubjectEnrollment: vi.fn(),
  checkSubjectEnrollmentActivationReadiness: vi.fn(),
  activateSubjectEnrollment: vi.fn(),
  checkTrialTeacherSuccession: vi.fn(),
  assignTeacherToSubjectEnrollment: vi.fn(),
  listFutureBookingImpact: vi.fn(),
  changeTeacherAssignment: vi.fn(),
  listTeacherAssignmentHistory: vi.fn(),
  listDocumentPermissionRetries: vi.fn(),
  getContractIdForChild: vi.fn(),
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
};

const subjects: AdminSubject[] = [{ subjectId: "sub1", subjectName: "SAT Math", units: [] }];

describe("SubjectEnrollmentPanel", () => {
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
});
