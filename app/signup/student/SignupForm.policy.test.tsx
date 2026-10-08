// POLICY-DECISIONS: 동의는 4개만 — 가입 화면 약관/개인정보 체크
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SignupForm from "./SignupForm";

const signUp = vi.fn();
vi.mock("@/utils/supabase/client", () => ({ createSignupClient: () => ({ auth: { signUp } }) }));

describe("signup terms/privacy consent guard", () => {
  it("has an unchecked checkbox whose label links to /terms and /privacy", () => {
    render(<SignupForm />);
    const label = screen.getByText(/I agree to the/).closest("label")!;
    expect(label.querySelector('input[type="checkbox"]')).not.toBeChecked();
    expect(label.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(label.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it("opens Terms in a popup on click and keeps typed input", async () => {
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Keep Me" } });
    fireEvent.click(screen.getByText("Terms of Service"));
    expect(await screen.findByRole("dialog", { name: "Terms of Use" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Keep Me");
  });

  it("blocks submission without the checkbox", async () => {
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Test Student" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "s@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/^Date of birth/), { target: { value: "2000-01-01" } });
    fireEvent.change(screen.getByLabelText(/^Grade/), { target: { value: "10th grade" } });
    fireEvent.click(screen.getByText("Send confirmation email"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
});
