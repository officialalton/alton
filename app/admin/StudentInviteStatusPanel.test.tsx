import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StudentInviteStatusPanel from "./StudentInviteStatusPanel";
import { getStudentInviteStatusAction, resendStudentInviteAction } from "./student-invite-actions";

vi.mock("./student-invite-actions", () => ({
  getStudentInviteStatusAction: vi.fn(),
  resendStudentInviteAction: vi.fn(),
}));

const mockedGetStatus = vi.mocked(getStudentInviteStatusAction);
const mockedResend = vi.mocked(resendStudentInviteAction);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudentInviteStatusPanel", () => {
  it("링크가 아직 없으면(온보딩 전) 아무것도 보여주지 않는다", async () => {
    mockedGetStatus.mockResolvedValue({
      linkStudentId: null,
      studentEmail: null,
      inviteStatus: null,
      sentAt: null,
      error: null,
      retryCount: 0,
      completed: false,
    });

    const { container } = render(<StudentInviteStatusPanel consultationId="c1" />);
    await waitFor(() => expect(mockedGetStatus).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("발송 실패 상태와 오류를 보여주고 재발송 버튼을 제공한다", async () => {
    mockedGetStatus.mockResolvedValue({
      linkStudentId: "ls1",
      studentEmail: "student@example.com",
      inviteStatus: "failed",
      sentAt: null,
      error: "SMTP down",
      retryCount: 0,
      completed: false,
    });

    render(<StudentInviteStatusPanel consultationId="c1" />);

    expect(await screen.findByText(/발송 실패/)).toBeInTheDocument();
    expect(screen.getByText(/SMTP down/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "재발송" })).toBeInTheDocument();
  });

  it("이미 완료된 학생은 완료 안내만 보여주고 재발송 버튼을 숨긴다", async () => {
    mockedGetStatus.mockResolvedValue({
      linkStudentId: "ls1",
      studentEmail: "student@example.com",
      inviteStatus: "sent",
      sentAt: "2026-09-05T00:00:00Z",
      error: null,
      retryCount: 0,
      completed: true,
    });

    render(<StudentInviteStatusPanel consultationId="c1" />);

    expect(await screen.findByText(/완료 — 학생이 이미 비밀번호 설정을 마쳤습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("재발송 버튼을 누르면 resendStudentInviteAction을 호출하고 상태를 갱신한다", async () => {
    mockedGetStatus
      .mockResolvedValueOnce({
        linkStudentId: "ls1",
        studentEmail: "student@example.com",
        inviteStatus: "failed",
        sentAt: null,
        error: "SMTP down",
      retryCount: 0,
        completed: false,
      })
      .mockResolvedValueOnce({
        linkStudentId: "ls1",
        studentEmail: "student@example.com",
        inviteStatus: "sent",
        sentAt: "2026-09-05T00:00:00Z",
        error: null,
      retryCount: 0,
        completed: false,
      });
    mockedResend.mockResolvedValue(undefined);

    render(<StudentInviteStatusPanel consultationId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "재발송" }));

    await waitFor(() => expect(mockedResend).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText(/발송 완료/)).toBeInTheDocument();
  });
});
