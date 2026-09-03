import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ConfirmEmailForm from "./ConfirmEmailForm";
import { requestLoginEmailChangeAction } from "@/app/consult/trial-onboarding-email-actions";

vi.mock("@/app/consult/trial-onboarding-email-actions", () => ({
  requestLoginEmailChangeAction: vi.fn(),
}));

describe("ConfirmEmailForm — 온보딩 로그인 이메일 확인/변경", () => {
  beforeEach(() => vi.clearAllMocks());

  it("기본값(prospect 이메일)을 그대로 쓰면 redeem 링크로 바로 이동하는 버튼만 보인다", () => {
    render(<ConfirmEmailForm token="tok1" linkId="l1" defaultEmail="prospect@example.com" />);

    const input = screen.getByLabelText("로그인 이메일") as HTMLInputElement;
    expect(input.value).toBe("prospect@example.com");
    expect(input).toHaveAttribute("readonly");

    const link = screen.getByRole("link", { name: "이 이메일로 계속" });
    expect(link).toHaveAttribute("href", "/api/trial-onboarding/confirm-email?token=tok1");
  });

  it("다른 이메일 사용을 선택하면 입력 가능해지고, 요청 성공 시 확인 메일 발송 안내로 바뀐다", async () => {
    (requestLoginEmailChangeAction as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "sent" });

    render(<ConfirmEmailForm token="tok1" linkId="l1" defaultEmail="prospect@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "다른 이메일 사용하기" }));

    const input = screen.getByLabelText("로그인 이메일") as HTMLInputElement;
    expect(input).not.toHaveAttribute("readonly");
    fireEvent.change(input, { target: { value: "new-login@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "이 이메일로 확인 메일 받기" }));

    await waitFor(() => expect(requestLoginEmailChangeAction).toHaveBeenCalledWith("l1", "new-login@example.com"));
    await screen.findByText("확인 메일을 보냈습니다");
    expect(screen.getByText(/new-login@example.com로 확인 메일을 보냈습니다/)).toBeInTheDocument();
  });

  it("이미 사용 중인 이메일이면 자동 병합하지 않고 충돌 안내를 보여준다", async () => {
    (requestLoginEmailChangeAction as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "conflict" });

    render(<ConfirmEmailForm token="tok1" linkId="l1" defaultEmail="prospect@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "다른 이메일 사용하기" }));
    fireEvent.change(screen.getByLabelText("로그인 이메일"), { target: { value: "existing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "이 이메일로 확인 메일 받기" }));

    await screen.findByText("이미 사용 중인 이메일입니다");
    expect(screen.queryByRole("link", { name: "이 이메일로 계속" })).toBeNull();
  });
});
