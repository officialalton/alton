import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  load: vi.fn(),
  register: vi.fn(),
  cancel: vi.fn(),
  create: vi.fn(),
  resend: vi.fn(),
  revoke: vi.fn(),
  track: vi.fn(),
}));
vi.mock("../tutoring-actions", () => ({
  loadMyTutoringInterestStateAction: m.load,
  registerConsultInterestAction: m.register,
  cancelConsultInterestAction: m.cancel,
  createGuardianLinkInviteAction: m.create,
  resendGuardianLinkInviteAction: m.resend,
  revokeGuardianLinkInviteAction: m.revoke,
}));
vi.mock("@/lib/analytics/track", () => ({ trackEvent: m.track }));

import TutoringInterestPanel from "./TutoringInterestPanel";
import type { TutoringInterestState } from "../tutoring-state";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
});

describe("TutoringInterestPanel", () => {
  it("관심 없음 → 'I'm interested' → 등록 액션 + 이벤트, 이후 상태 재조회", async () => {
    m.register.mockResolvedValue({ ok: true });
    m.load.mockResolvedValue({ kind: "interest", status: "registered", invites: [] } satisfies TutoringInterestState);
    render(<TutoringInterestPanel initialState={{ kind: "none", invites: [] }} entryPoint="result_page" />);
    fireEvent.click(screen.getByRole("button", { name: "I'm interested" }));
    await waitFor(() => expect(m.register).toHaveBeenCalledWith("result_page"));
    expect(m.track).toHaveBeenCalledWith("consult_interest_registered", { entry_point: "result_page" });
    expect(await screen.findByLabelText("Parent or guardian email")).toBeInTheDocument();
  });

  it("이메일 폼: 클라이언트 검증 실패는 서버 호출 없이 안내, 성공이면 초대 액션 + 이벤트", async () => {
    m.create.mockResolvedValue({ ok: true, value: { outcome: "invite_sent" } });
    m.load.mockResolvedValue({
      kind: "interest",
      status: "invite_sent",
      invites: [{ id: "i1", email: "p@example.com", status: "pending", expiresAt: new Date(Date.now() + 86400000).toISOString(), lastSentAt: new Date().toISOString(), acceptedAt: null, manualReviewReason: null }],
    } satisfies TutoringInterestState);
    render(<TutoringInterestPanel initialState={{ kind: "interest", status: "registered", invites: [] }} entryPoint="home" />);
    const input = screen.getByLabelText("Parent or guardian email");
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/);
    expect(m.create).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "p@example.com" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(m.create).toHaveBeenCalledWith("p@example.com"));
    expect(m.track).toHaveBeenCalledWith("guardian_invite_sent", { entry_point: "home" });
    expect(await screen.findByRole("status")).toHaveTextContent(/Invitation sent/);
    // 상태 목록: 쿨다운 중이라 Resend 비활성 + 남은 분 표시, 취소/이메일 변경 가능
    const list = await screen.findByTestId("invite-list");
    expect(list).toHaveTextContent("p@example.com");
    expect(screen.getByRole("button", { name: /Resend in \d+ min/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel / change email" })).toBeEnabled();
  });

  it("이미 연결된 보호자면 초대 대신 안내 문구", async () => {
    m.create.mockResolvedValue({ ok: true, value: { outcome: "already_linked" } });
    m.load.mockResolvedValue({ kind: "interest", status: "parent_linked", invites: [] } satisfies TutoringInterestState);
    render(<TutoringInterestPanel initialState={{ kind: "interest", status: "registered", invites: [] }} entryPoint="home" />);
    const input = screen.getByLabelText("Parent or guardian email");
    fireEvent.change(input, { target: { value: "p@example.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("status")).toHaveTextContent(/already connected/);
    expect(await screen.findByText("Parent connected")).toBeInTheDocument();
  });

  it("쿨다운이 지난 초대는 Resend 활성, 만료 초대는 Remove, 수락된 초대는 Connected 표시", async () => {
    m.resend.mockResolvedValue({ ok: true });
    m.load.mockResolvedValue({ kind: "interest", status: "invite_sent", invites: [] });
    const past = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    render(
      <TutoringInterestPanel
        initialState={{
          kind: "interest",
          status: "invite_sent",
          invites: [
            { id: "ok", email: "ok@example.com", status: "pending", expiresAt: new Date(Date.now() + 86400000).toISOString(), lastSentAt: past, acceptedAt: null, manualReviewReason: null },
            { id: "old", email: "old@example.com", status: "pending", expiresAt: new Date(Date.now() - 1000).toISOString(), lastSentAt: past, acceptedAt: null, manualReviewReason: null },
          ],
        }}
        entryPoint="home"
      />,
    );
    expect(screen.getByTestId("invite-expired-list")).toHaveTextContent("old@example.com");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    const resend = screen.getByRole("button", { name: "Resend" });
    expect(resend).toBeEnabled();
    fireEvent.click(resend);
    await waitFor(() => expect(m.resend).toHaveBeenCalledWith("ok"));
    // 재발송 뒤 상태를 다시 읽는다(목록은 서버 상태 기준으로 갱신).
    await waitFor(() => expect(m.load).toHaveBeenCalled());
  });

  it("수락됨·검토중 상태 표시", () => {
    render(
      <TutoringInterestPanel
        initialState={{
          kind: "interest",
          status: "consultation_requested",
          invites: [{ id: "a", email: "p@example.com", status: "accepted", expiresAt: "", lastSentAt: "", acceptedAt: new Date().toISOString(), manualReviewReason: null }],
        }}
        entryPoint="home"
      />,
    );
    expect(screen.getByTestId("invite-accepted")).toHaveTextContent(/waiting for your parent to pick a consultation time/);
    expect(screen.queryByLabelText("Parent or guardian email")).not.toBeInTheDocument();
  });
});
