import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the login form", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("shows the error message from searchParams", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "로그인 실패" }),
      })
    );
    expect(screen.getByText("로그인 실패")).toBeInTheDocument();
  });
});
