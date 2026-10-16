import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { listMock, sendMock, closeMock, readMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  sendMock: vi.fn(),
  closeMock: vi.fn(),
  readMock: vi.fn(),
}));

vi.mock("./inquiry-and-meeting-actions", () => ({
  listInquiryThreadsForAdmin: listMock,
  sendAdminInquiryMessage: sendMock,
  closeHouseholdInquiry: closeMock,
  markHouseholdMessengerReadByAdmin: readMock,
}));
vi.mock("./consultant-assignment-actions", () => ({ listConsultantsAction: vi.fn().mockResolvedValue([]) }));
vi.mock("./users-actions", () => ({ listTeachersForUsersTabAction: vi.fn().mockResolvedValue([]) }));
vi.mock("./staff-messenger-actions", () => ({
  listAllStaffInquiriesAction: vi.fn().mockResolvedValue([]),
  startStaffInquiryAction: vi.fn(),
  listStaffMessagesAction: vi.fn(),
  sendAdminStaffMessageAction: vi.fn(),
  closeStaffInquiryAction: vi.fn(),
}));
vi.mock("./teacher-staff-messenger-actions", () => ({
  listAllTeacherStaffInquiriesAction: vi.fn().mockResolvedValue([]),
  startTeacherStaffInquiryAction: vi.fn(),
  listTeacherStaffMessagesAction: vi.fn(),
  sendAdminTeacherStaffMessageAction: vi.fn(),
  closeTeacherStaffInquiryAction: vi.fn(),
}));

import MessengerTab from "./MessengerTab";
import { clearAdminTabCache } from "./tab-data-cache";

const threads = [
  {
    inquiryId: "i1",
    householdId: "h1",
    householdLabel: "김민지 가족",
    status: "open",
    lastMessageAt: "2027-01-01T00:00:00.000Z",
    unreadForAdmin: true,
    messages: [{ id: "m1", senderRole: "guardian", body: "문의합니다", createdAt: "2027-01-01T00:00:00.000Z" }],
  },
];

describe("Messenger > 가족 채널", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAdminTabCache();
    readMock.mockResolvedValue(undefined);
    listMock.mockResolvedValue(threads);
  });

  it("가족 서브탭이 Teachers/Consultants 옆에 있고 안읽음 배지를 보인다(SSR 시드면 추가 fetch 없음 확인은 시드 사용)", async () => {
    render(<MessengerTab initialInquiryThreads={threads as never} />);
    const familyTab = screen.getByRole("button", { name: /가족/ });
    expect(screen.getByRole("button", { name: "Teachers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Consultants/ })).toBeInTheDocument();
    expect(familyTab).toHaveTextContent("1");
  });

  it("진행 중 문의를 열어 읽음 처리하고 답장·종료할 수 있다", async () => {
    sendMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    render(<MessengerTab initialInquiryThreads={threads as never} initialSubtab="family" />);
    expect(screen.getByText(/김민지 가족/)).toBeInTheDocument();
    expect(screen.getByText("안읽음")).toBeInTheDocument();
    fireEvent.click(screen.getByText("열기"));
    await waitFor(() => expect(screen.getByText("문의합니다")).toBeInTheDocument());
    await waitFor(() => expect(readMock).toHaveBeenCalledWith("h1"));
    fireEvent.change(screen.getByLabelText("답장 내용"), { target: { value: "확인했습니다" } });
    fireEvent.click(screen.getByText("답장"));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith("i1", "h1", "확인했습니다"));
    fireEvent.click(screen.getByText("문의 종료"));
    await waitFor(() => expect(closeMock).toHaveBeenCalledWith("i1"));
  });
});
