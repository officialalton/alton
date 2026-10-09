import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClosedAccountAccessGate from "./ClosedAccountAccessGate";
import * as actions from "./users-actions";

vi.mock("./users-actions", () => ({
  recordClosedAccountAccess: vi.fn(),
}));

describe("ClosedAccountAccessGate", () => {
  it("사유 없이는 열람 버튼이 비활성화된다", () => {
    render(
      <ClosedAccountAccessGate profileId="s1" name="지훈" onBack={vi.fn()}>
        <p>비밀 상세</p>
      </ClosedAccountAccessGate>
    );
    expect(screen.getByText("사유 확인 후 열람")).toBeDisabled();
    expect(screen.queryByText("비밀 상세")).not.toBeInTheDocument();
  });

  it("사유를 입력하고 확인하면 record_closed_account_access를 호출하고 children을 보여준다", async () => {
    vi.mocked(actions.recordClosedAccountAccess).mockResolvedValue(undefined);
    render(
      <ClosedAccountAccessGate profileId="s1" name="지훈" onBack={vi.fn()}>
        <p>비밀 상세</p>
      </ClosedAccountAccessGate>
    );
    fireEvent.change(screen.getByPlaceholderText(/조회 사유를 입력하세요/), { target: { value: "법무팀 요청" } });
    fireEvent.click(screen.getByText("사유 확인 후 열람"));

    await waitFor(() => expect(screen.getByText("비밀 상세")).toBeInTheDocument());
    expect(actions.recordClosedAccountAccess).toHaveBeenCalledWith("s1", "법무팀 요청");
  });

  it("RPC가 실패하면 오류를 보여주고 children은 열지 않는다", async () => {
    vi.mocked(actions.recordClosedAccountAccess).mockRejectedValue(new Error("폐쇄된 계정이 아닙니다."));
    render(
      <ClosedAccountAccessGate profileId="s1" name="지훈" onBack={vi.fn()}>
        <p>비밀 상세</p>
      </ClosedAccountAccessGate>
    );
    fireEvent.change(screen.getByPlaceholderText(/조회 사유를 입력하세요/), { target: { value: "사유" } });
    fireEvent.click(screen.getByText("사유 확인 후 열람"));

    await waitFor(() => expect(screen.getByText("폐쇄된 계정이 아닙니다.")).toBeInTheDocument());
    expect(screen.queryByText("비밀 상세")).not.toBeInTheDocument();
  });
});
