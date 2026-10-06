// POLICY-DECISIONS: 동의는 4개만 — 비밀번호 설정 화면 약관/개인정보 체크
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SetPasswordPage from "./page";

const updateUser = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ auth: { setSession: vi.fn(), updateUser, verifyOtp: vi.fn() } }),
}));
vi.mock("./actions", () => ({ confirmOwnEmailAfterPasswordSet: vi.fn() }));

describe("set-password terms/privacy consent guard", () => {
  it("label links to /terms and /privacy and submission is blocked without the checkbox", () => {
    render(<SetPasswordPage />);
    const label = screen.getByLabelText(/Terms of Service/).closest("label")!;
    expect(label.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(label.querySelector('a[href="/privacy"]')).not.toBeNull();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByText("Set password and continue"));
    expect(screen.getByText(/agree to the Terms of Service and Privacy Policy/)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
