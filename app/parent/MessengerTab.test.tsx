import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { listGuardianHouseholdMessagesMock, sendGuardianHouseholdMessageMock, markMessengerReadMock } = vi.hoisted(() => ({
  listGuardianHouseholdMessagesMock: vi.fn(),
  sendGuardianHouseholdMessageMock: vi.fn(),
  markMessengerReadMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  listGuardianHouseholdMessages: listGuardianHouseholdMessagesMock,
  sendGuardianHouseholdMessage: sendGuardianHouseholdMessageMock,
  markMessengerRead: markMessengerReadMock,
}));

import MessengerTab from "./MessengerTab";

describe("MessengerTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGuardianHouseholdMessagesMock.mockResolvedValue([]);
    markMessengerReadMock.mockResolvedValue(undefined);
  });

  it("메시지 목록을 불러오고 열자마자 읽음 처리한다", async () => {
    listGuardianHouseholdMessagesMock.mockResolvedValue([
      { id: "m1", senderId: "admin1", senderRole: "admin", body: "안녕하세요", status: "open", createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    render(<MessengerTab />);
    await waitFor(() => expect(screen.getByText("안녕하세요")).toBeInTheDocument());
    await waitFor(() => expect(markMessengerReadMock).toHaveBeenCalledTimes(1));
  });

  it("메시지를 작성해 전송하면 sendGuardianHouseholdMessage가 호출되고 목록을 다시 불러온다", async () => {
    render(<MessengerTab />);
    await waitFor(() => expect(listGuardianHouseholdMessagesMock).toHaveBeenCalledTimes(1));
    sendGuardianHouseholdMessageMock.mockResolvedValue(undefined);

    fireEvent.change(screen.getByLabelText("메시지 내용"), { target: { value: "새 메시지입니다" } });
    fireEvent.click(screen.getByText("전송"));

    await waitFor(() => expect(sendGuardianHouseholdMessageMock).toHaveBeenCalledWith("새 메시지입니다"));
    await waitFor(() => expect(listGuardianHouseholdMessagesMock).toHaveBeenCalledTimes(2));
  });
});
