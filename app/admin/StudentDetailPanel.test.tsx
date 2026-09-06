import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentDetailPanel from "./StudentDetailPanel";
import * as actions from "./users-actions";
import type { StudentListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  setStudentStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
  verifyStudentDateOfBirth: vi.fn(),
}));

const student: StudentListItem = {
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
};

describe("StudentDetailPanel", () => {
  it("학생 정보와 수업권 잔액을 보여준다", () => {
    render(<StudentDetailPanel student={student} history={[]} onBack={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.getByText("14장")).toBeInTheDocument();
  });

  it("상태를 변경하면 setStudentStatus가 호출되고 onUpdated가 호출된다", async () => {
    vi.mocked(actions.setStudentStatus).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <StudentDetailPanel student={student} history={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.change(screen.getByDisplayValue("활성"), { target: { value: "suspended" } });
    await waitFor(() => expect(actions.setStudentStatus).toHaveBeenCalledWith("s1", "suspended"));
    expect(onUpdated).toHaveBeenCalledWith({ status: "suspended" });
  });

  it("사유 없이는 조정 적용 버튼이 비활성화된다", () => {
    render(<StudentDetailPanel student={student} history={[]} onBack={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByText("조정 적용")).toBeDisabled();
  });

  it("수업권을 조정하면 onUpdated가 새 잔액과 거래내역으로 호출된다", async () => {
    vi.mocked(actions.adjustStudentCredit).mockResolvedValue({
      newBalance: 16,
      transactionId: "tx1",
    });
    const onUpdated = vi.fn();
    render(
      <StudentDetailPanel student={student} history={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.change(screen.getByPlaceholderText("+/- 장수"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("조정 사유 (필수)"), {
      target: { value: "굿윌 차원 지급" },
    });
    fireEvent.click(screen.getByText("조정 적용"));
    await waitFor(() =>
      expect(actions.adjustStudentCredit).toHaveBeenCalledWith({
        studentId: "s1",
        amount: 2,
        type: "adjustment",
        reason: "굿윌 차원 지급",
      })
    );
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        { creditBalance: 16 },
        expect.objectContaining({ id: "tx1", amount: 2 })
      )
    );
  });

  it("생년월일 확인 완료 버튼을 누르면 verifyStudentDateOfBirth가 호출되고 배지가 바뀐다", async () => {
    vi.mocked(actions.verifyStudentDateOfBirth).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    const studentWithDob = { ...student, dateOfBirth: "2010-05-01" };
    render(
      <StudentDetailPanel student={studentWithDob} history={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    expect(screen.getByText("생년월일 미확인")).toBeInTheDocument();
    fireEvent.click(screen.getByText("생년월일 확인 완료"));
    await waitFor(() => expect(actions.verifyStudentDateOfBirth).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.getByText("생년월일 확인 완료")).toBeInTheDocument());
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirthVerifiedAt: expect.any(String) })
    );
  });

  it("생년월일이 없으면 확인 완료 버튼이 비활성화된다", () => {
    render(<StudentDetailPanel student={student} history={[]} onBack={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByText("생년월일 확인 완료")).toBeDisabled();
  });

  it("기존 조정 내역을 보여준다", () => {
    render(
      <StudentDetailPanel
        student={student}
        history={[
          { id: "tx0", type: "refund", amount: -3, reason: "중복 결제", createdAt: "2026-08-01T00:00:00.000Z" },
        ]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    expect(screen.getByText(/환불 · 중복 결제/)).toBeInTheDocument();
    expect(screen.getByText("-3")).toBeInTheDocument();
  });
});
