import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { submitMeetingRequestMock } = vi.hoisted(() => ({
  submitMeetingRequestMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  submitMeetingRequest: submitMeetingRequestMock,
}));

import ConsultationRequestTab from "./ConsultationRequestTab";

describe("ConsultationRequestTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("사유 없이 제출하면 에러를 보여주고 submitMeetingRequest는 호출되지 않는다", async () => {
    render(<ConsultationRequestTab />);
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(screen.getByText("상담 사유를 입력해주세요.")).toBeInTheDocument());
    expect(submitMeetingRequestMock).not.toHaveBeenCalled();
  });

  it("사유를 입력해 제출하면 submitMeetingRequest가 { reason }으로 호출된다(R12.1: 단일 입력)", async () => {
    submitMeetingRequestMock.mockResolvedValue({ ok: true });
    render(<ConsultationRequestTab />);
    fireEvent.change(screen.getByLabelText("상담 사유"), { target: { value: "상담 사유입니다" } });
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(submitMeetingRequestMock).toHaveBeenCalledWith({ reason: "상담 사유입니다" }));
    await waitFor(() => expect(screen.getByText("상담 신청이 접수되었습니다.")).toBeInTheDocument());
  });

  it("제출 실패 시 서버가 반환한 에러 메시지를 보여준다", async () => {
    submitMeetingRequestMock.mockResolvedValue({ ok: false, error: "이미 진행 중인 상담이 있습니다." });
    render(<ConsultationRequestTab />);
    fireEvent.change(screen.getByLabelText("상담 사유"), { target: { value: "상담 사유입니다" } });
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(screen.getByText("이미 진행 중인 상담이 있습니다.")).toBeInTheDocument());
  });
});
