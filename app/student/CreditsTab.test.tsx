import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreditsTab from "./CreditsTab";
import * as creditsActions from "./credits-actions";

vi.mock("./credits-actions", () => ({
  requestParentPayment: vi.fn(),
}));

describe("CreditsTab", () => {
  it("보유 수업권 수를 보여준다", () => {
    render(<CreditsTab data={{ balance: 14, guardianName: "김민지" }} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("장 보유")).toBeInTheDocument();
  });

  it("연결된 학부모가 없으면 요청 버튼 대신 안내문구를 보여준다", () => {
    render(<CreditsTab data={{ balance: 0, guardianName: null }} />);
    expect(screen.queryByText("부모님께 결제 요청")).not.toBeInTheDocument();
    expect(
      screen.getByText("연결된 학부모 계정이 없어 결제 요청을 보낼 수 없습니다.")
    ).toBeInTheDocument();
  });

  it("결제 요청 버튼을 누르면 실제 액션을 호출하고 확인 메시지를 보여준다", async () => {
    vi.mocked(creditsActions.requestParentPayment).mockResolvedValue({
      guardianName: "김민지",
    });
    render(<CreditsTab data={{ balance: 14, guardianName: "김민지" }} />);
    fireEvent.click(screen.getByText("부모님께 결제 요청"));
    await waitFor(() =>
      expect(creditsActions.requestParentPayment).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(
        screen.getByText("김민지 학부모님께 수업권 충전 요청 알림을 보냈습니다.")
      ).toBeInTheDocument()
    );
  });
});
