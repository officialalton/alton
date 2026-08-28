import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  it("renders the request form by default", async () => {
    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "비밀번호 재설정" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
  });

  it("shows a confirmation message once sent", async () => {
    render(
      await ResetPasswordPage({ searchParams: Promise.resolve({ sent: "1" }) })
    );
    expect(screen.getByText(/재설정 링크를 보냈어요/)).toBeInTheDocument();
  });
});
