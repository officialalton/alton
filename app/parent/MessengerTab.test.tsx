import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listGuardianInquiriesMock,
  listGuardianInquiryMessagesMock,
  startGuardianInquiryMock,
  sendGuardianInquiryMessageMock,
  markMessengerReadMock,
  getAssignedConsultantNameActionMock,
} = vi.hoisted(() => ({
  listGuardianInquiriesMock: vi.fn(),
  listGuardianInquiryMessagesMock: vi.fn(),
  startGuardianInquiryMock: vi.fn(),
  sendGuardianInquiryMessageMock: vi.fn(),
  markMessengerReadMock: vi.fn(),
  getAssignedConsultantNameActionMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  listGuardianInquiries: listGuardianInquiriesMock,
  listGuardianInquiryMessages: listGuardianInquiryMessagesMock,
  startGuardianInquiry: startGuardianInquiryMock,
  sendGuardianInquiryMessage: sendGuardianInquiryMessageMock,
  markMessengerRead: markMessengerReadMock,
  getAssignedConsultantNameAction: getAssignedConsultantNameActionMock,
}));

import MessengerTab from "./MessengerTab";

describe("MessengerTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGuardianInquiriesMock.mockResolvedValue([]);
    markMessengerReadMock.mockResolvedValue(undefined);
    getAssignedConsultantNameActionMock.mockResolvedValue(null);
  });

  it("문의 목록을 불러오고 열자마자 읽음 처리한다", async () => {
    render(<MessengerTab />);
    await waitFor(() => expect(listGuardianInquiriesMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(markMessengerReadMock).toHaveBeenCalledTimes(1));
  });

  it("새 문의를 시작하면 startGuardianInquiry가 호출되고 그 문의 대화창이 바로 열린다", async () => {
    render(<MessengerTab />);
    await waitFor(() => expect(listGuardianInquiriesMock).toHaveBeenCalledTimes(1));
    startGuardianInquiryMock.mockResolvedValue({ inquiryId: "inquiry1" });
    listGuardianInquiryMessagesMock.mockResolvedValue([
      { id: "m1", senderId: "guardian1", senderRole: "guardian", body: "새 문의입니다", createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    listGuardianInquiriesMock.mockResolvedValue([
      { id: "inquiry1", status: "open", createdAt: "2027-01-01T00:00:00.000Z", lastMessageAt: "2027-01-01T00:00:00.000Z", closedAt: null, firstMessage: "새 문의입니다" },
    ]);

    fireEvent.change(screen.getByLabelText("새 문의 내용"), { target: { value: "새 문의입니다" } });
    fireEvent.click(screen.getByText("문의하기"));

    await waitFor(() => expect(startGuardianInquiryMock).toHaveBeenCalledWith("새 문의입니다", ""));
    await waitFor(() => expect(screen.getByText("새 문의입니다")).toBeInTheDocument());
  });

  it("진행 중 문의를 열어 재문의하면 sendGuardianInquiryMessage가 호출된다", async () => {
    listGuardianInquiriesMock.mockResolvedValue([
      { id: "inquiry1", status: "open", createdAt: "2027-01-01T00:00:00.000Z", lastMessageAt: "2027-01-01T00:00:00.000Z", closedAt: null, firstMessage: "기존 문의" },
    ]);
    listGuardianInquiryMessagesMock.mockResolvedValue([
      { id: "m1", senderId: "admin1", senderRole: "admin", body: "답변입니다", createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    render(<MessengerTab />);
    await waitFor(() => expect(screen.getByText("기존 문의")).toBeInTheDocument());

    fireEvent.click(screen.getByText("기존 문의"));
    await waitFor(() => expect(screen.getByText("답변입니다")).toBeInTheDocument());

    sendGuardianInquiryMessageMock.mockResolvedValue(undefined);
    fireEvent.change(screen.getByLabelText("메시지 내용"), { target: { value: "재문의합니다" } });
    fireEvent.click(screen.getByText("전송"));

    await waitFor(() => expect(sendGuardianInquiryMessageMock).toHaveBeenCalledWith("inquiry1", "재문의합니다"));
  });

  it("종료된 문의는 읽기 전용이라 메시지 입력창이 없다", async () => {
    listGuardianInquiriesMock.mockResolvedValue([
      { id: "inquiry1", status: "closed", createdAt: "2027-01-01T00:00:00.000Z", lastMessageAt: "2027-01-01T00:00:00.000Z", closedAt: "2027-01-02T00:00:00.000Z", firstMessage: "종료된 옛날 문의 내용" },
    ]);
    listGuardianInquiryMessagesMock.mockResolvedValue([
      { id: "m1", senderId: "guardian1", senderRole: "guardian", body: "종료된 옛날 문의 내용", createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    render(<MessengerTab />);
    fireEvent.click(screen.getByText("지난 문의"));
    await waitFor(() => expect(screen.getByText("종료된 옛날 문의 내용")).toBeInTheDocument());

    fireEvent.click(screen.getByText("종료된 옛날 문의 내용"));
    await waitFor(() => expect(screen.queryByLabelText("메시지 내용")).toBeNull());
  });
});
