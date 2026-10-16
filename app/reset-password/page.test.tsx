import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  it("renders the request form by default", async () => {
    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "Reset your password" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows a confirmation message once sent", async () => {
    render(
      await ResetPasswordPage({ searchParams: Promise.resolve({ sent: "1" }) })
    );
    expect(screen.getByText(/We sent a reset link/)).toBeInTheDocument();
  });
});
