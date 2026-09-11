import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmEmailForm from "./ConfirmEmailForm";

vi.mock("../../trial-onboarding-finalize-actions", () => ({
  confirmTrialOnboardingLinkAction: vi.fn(),
}));

describe("ConfirmEmailForm — 온보딩 로그인 이메일 확인", () => {
  it("2026-09-06: '다른 이메일 사용하기' 없이 확인용 읽기 전용 이메일과 계속 버튼만 보인다", () => {
    render(<ConfirmEmailForm token="tok1" linkId="l1" defaultEmail="prospect@example.com" />);

    const input = screen.getByLabelText("로그인 이메일") as HTMLInputElement;
    expect(input.value).toBe("prospect@example.com");
    expect(input).toHaveAttribute("readonly");

    // 2026-09-11(제품 오너 재검토 — GET 부작용 제거) — 이 버튼은 더 이상 GET
    // URL로의 <a href> 링크가 아니다. 실제 계정 생성은 Server Action을
    // 제출하는 폼 버튼이어야 하고, 이 페이지를 그냥 열거나 새로고침해도
    // (=GET) 아무 일도 일어나지 않아야 한다.
    expect(screen.queryByRole("link", { name: "이 이메일로 계속" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "이 이메일로 계속" });
    expect(button).toHaveAttribute("type", "submit");

    expect(screen.queryByText(/다른 이메일/)).not.toBeInTheDocument();
  });
});
