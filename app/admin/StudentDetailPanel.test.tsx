import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentDetailPanel from "./StudentDetailPanel";
import * as actions from "./users-actions";
import type { StudentListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  setStudentStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
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
    fireEvent.change(screen.getByDisplayValue("활성"), { target: { value: "inactive" } });
    await waitFor(() => expect(actions.setStudentStatus).toHaveBeenCalledWith("s1", "inactive"));
    expect(onUpdated).toHaveBeenCalledWith({ status: "inactive" });
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
