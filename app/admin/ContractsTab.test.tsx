import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContractsTab from "./ContractsTab";
import { sendFamilyContract } from "./contracts-actions";

vi.mock("./contracts-actions", () => ({
  sendFamilyContract: vi.fn(),
}));

describe("ContractsTab", () => {
  it("발송 대기 상담과 발송된 계약을 보여준다", () => {
    render(
      <ContractsTab
        pendingConsults={[
          { id: "c1", personName: "김민지", email: "minji@example.com", studentGrade: "10학년", submittedAt: "2026-08-01" },
        ]}
        contracts={[
          { id: "ct1", parentName: "최유진", studentName: "최하은", status: "signed", signedAt: "2026-08-02" },
        ]}
      />
    );

    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("최유진")).toBeInTheDocument();
    expect(screen.getByText("서명완료")).toBeInTheDocument();
  });

  it("계약서 발송을 누르고 학생 정보를 입력한 뒤 발송 확정을 누르면 sendFamilyContract가 호출된다", async () => {
    vi.mocked(sendFamilyContract).mockResolvedValue(undefined);
    render(
      <ContractsTab
        pendingConsults={[
          { id: "c1", personName: "김민지", email: "minji@example.com", studentGrade: "10학년", submittedAt: "2026-08-01" },
        ]}
        contracts={[]}
      />
    );

    fireEvent.click(screen.getByText("계약서 발송"));
    fireEvent.change(screen.getByLabelText("학생 이름"), { target: { value: "지훈" } });
    fireEvent.change(screen.getByLabelText("학생 이메일"), { target: { value: "jihoon@example.com" } });
    fireEvent.click(screen.getByText("발송 확정"));

    await waitFor(() => {
      expect(sendFamilyContract).toHaveBeenCalledWith({
        consultRequestId: "c1",
        studentName: "지훈",
        studentEmail: "jihoon@example.com",
      });
    });
  });

  it("발송 대기 상담이 없으면 안내 문구를 보여준다", () => {
    render(<ContractsTab pendingConsults={[]} contracts={[]} />);
    expect(screen.getByText("발송 대기 중인 상담 신청이 없습니다.")).toBeInTheDocument();
  });
});
