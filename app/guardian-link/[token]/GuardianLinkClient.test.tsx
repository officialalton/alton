import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acceptMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const rememberMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ acceptGuardianLinkAction: acceptMock, createGuardianAccountFromLinkAction: createMock, rememberGuardianLinkReturnAction: rememberMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: vi.fn() }) }));
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackMock }));

import GuardianLinkClient from "./GuardianLinkClient";
import type { ClaimResult } from "./actions";

const base: ClaimResult = {
  status: "pending",
  inviteId: "inv",
  studentFirstName: "Min",
  studentGrade: "10",
  inviteEmail: "parent@example.com",
  accountExists: false,
  viewer: { loggedIn: false, emailMatches: false, isParent: false },
  consultationId: null,
  schedulingToken: null,
};

beforeEach(() => {
  acceptMock.mockReset();
  createMock.mockReset();
  rememberMock.mockReset();
  replaceMock.mockReset();
  trackMock.mockReset();
});

describe("GuardianLinkClient — 상태별 화면(영어)", () => {
  it.each([
    ["invalid", /This link isn't valid/],
    ["expired", /has expired/],
    ["revoked", /was cancelled/],
    ["superseded", /newer invitation/],
    ["manual_review", /review this connection/],
  ] as const)("%s", (status, re) => {
    render(<GuardianLinkClient token="t" claim={{ ...base, status }} />);
    expect(screen.getByText(re)).toBeInTheDocument();
  });

  it("계정 없음 → 이름 입력 + Create my account(명시적 버튼, GET 부작용 없음)", async () => {
    createMock.mockResolvedValue({ ok: false, error: "nope" });
    render(<GuardianLinkClient token="t" claim={base} />);
    expect(screen.getByText(/Min \(Grade 10\) invited you to connect/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jane Doe" } });
    fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
    await waitFor(() => expect(createMock).toHaveBeenCalledWith("t", "Jane Doe"));
    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
  });

  it("계정 있음·비로그인 → 로그인 유도(자동 연결 없음)", () => {
    render(<GuardianLinkClient token="t" claim={{ ...base, accountExists: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in to continue" }));
    expect(rememberMock).toHaveBeenCalledWith("t");
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it("로그인 이메일 불일치 → 거절 안내", () => {
    render(<GuardianLinkClient token="t" claim={{ ...base, accountExists: true, viewer: { loggedIn: true, emailMatches: false, isParent: true } }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/different email/);
    expect(screen.queryByRole("button", { name: /Connect and continue/ })).not.toBeInTheDocument();
  });

  it("수락 화면: 동의 절차 없이 버튼 한 번으로 수락하고 예약 화면으로 이동", async () => {
    acceptMock.mockResolvedValue({ ok: true, outcome: "accepted", schedulingToken: "sched-1", booked: false });
    render(<GuardianLinkClient token="t" claim={{ ...base, accountExists: true, viewer: { loggedIn: true, emailMatches: true, isParent: true } }} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const btn = screen.getByRole("button", { name: "Connect and continue" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith("t", true));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/schedule/sched-1"));
    expect(trackMock).toHaveBeenCalledWith("guardian_invite_accepted", { outcome: "accepted" });
  });

  it("배정 불가(토큰 없음) → 보호자 포털 상담 탭으로, manual_review → 검토 안내", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, outcome: "accepted", schedulingToken: null, booked: false });
    const claim = { ...base, accountExists: true, viewer: { loggedIn: true, emailMatches: true, isParent: true } };
    const { unmount } = render(<GuardianLinkClient token="t" claim={claim} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect and continue" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/parent?tab=consult"));
    unmount();

    acceptMock.mockResolvedValueOnce({ ok: true, outcome: "manual_review", reason: "student_in_other_household" });
    render(<GuardianLinkClient token="t" claim={claim} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect and continue" }));
    expect(await screen.findByText(/review this connection/)).toBeInTheDocument();
  });
});
