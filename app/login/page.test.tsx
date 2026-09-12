import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-10(P0-3) — 유효한 세션으로 /login을 다시 방문하면(뒤로가기 포함)
// 로그인 폼이 아니라 그 계정의 목적지로 돌려보내야 한다. LoginPage가 서버에서
// cookies()/supabase를 직접 쓰므로, 다른 서버 액션 테스트와 동일한 패턴
// (app/login/teacher-google-actions.test.ts)으로 모킹한다.
const getUserMock = vi.fn();
const singleMock = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }),
  }),
}));

const resolveAccountDestinationMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  resolveAccountDestination: resolveAccountDestinationMock,
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: null } });
  });

  it("renders the login form", async () => {
    const { default: LoginPage } = await import("./page");
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("shows the error message from searchParams", async () => {
    const { default: LoginPage } = await import("./page");
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "로그인 실패" }),
      })
    );
    expect(screen.getByText("로그인 실패")).toBeInTheDocument();
  });

  it("2026-09-10(P0-3 재발 방지) — 유효한 세션으로 /login을 다시 열면(예: 뒤로가기) 로그인 폼 대신 그 계정의 목적지로 리다이렉트한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleMock.mockResolvedValue({ data: { role: "student" } });
    resolveAccountDestinationMock.mockResolvedValue("/student");

    const { default: LoginPage } = await import("./page");
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/student"
    );

    expect(resolveAccountDestinationMock).toHaveBeenCalledWith(expect.anything(), "student");
  });

  it("세션이 없으면(로그아웃·만료) 평소대로 로그인 폼을 그대로 보여준다 — 리다이렉트하지 않는다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { default: LoginPage } = await import("./page");
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
