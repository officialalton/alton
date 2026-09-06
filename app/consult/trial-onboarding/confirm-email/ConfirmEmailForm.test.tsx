import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfirmEmailForm from "./ConfirmEmailForm";

describe("ConfirmEmailForm — 온보딩 로그인 이메일 확인", () => {
  it("2026-09-06: '다른 이메일 사용하기' 없이 확인용 읽기 전용 이메일과 계속 버튼만 보인다", () => {
    render(<ConfirmEmailForm token="tok1" linkId="l1" defaultEmail="prospect@example.com" />);

    const input = screen.getByLabelText("로그인 이메일") as HTMLInputElement;
    expect(input.value).toBe("prospect@example.com");
    expect(input).toHaveAttribute("readonly");

    const link = screen.getByRole("link", { name: "이 이메일로 계속" });
    expect(link).toHaveAttribute("href", "/api/trial-onboarding/confirm-email?token=tok1");

    expect(screen.queryByText(/다른 이메일/)).not.toBeInTheDocument();
  });
});
