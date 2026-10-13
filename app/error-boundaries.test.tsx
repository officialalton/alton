import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentError from "./student/error";
import ParentError from "./parent/error";
import TeacherError from "./teacher/error";
import ConsultantError from "./consultant/error";
import RootError from "./error";
import SessionError from "./session/[id]/error";
import AdminError from "./admin/error";
import GlobalError from "./global-error";

const err = Object.assign(new Error("x"), { digest: "d1" });
const KOREAN = /[가-힣]/;

describe("error boundaries", () => {
  it.each([
    ["student", StudentError],
    ["parent", ParentError],
    ["teacher", TeacherError],
    ["consultant", ConsultantError],
    ["root", RootError],
    ["session", SessionError],
  ])("%s is English with Try again + Back to sign in", (_n, C) => {
    const reset = vi.fn();
    const { container } = render(<C error={err} reset={reset} />);
    expect(container.textContent).not.toMatch(KOREAN);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("global-error renders Try again + Back to sign in", () => {
    const reset = vi.fn();
    render(<GlobalError error={err} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("admin (Korean allowed by policy) still offers retry and a sign-in link", () => {
    render(<AdminError error={err} reset={vi.fn()} />);
    expect(screen.getByRole("link", { name: "로그인으로 돌아가기" })).toHaveAttribute("href", "/login");
  });
});
