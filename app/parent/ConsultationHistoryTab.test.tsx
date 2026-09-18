import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { listGuardianMeetingRequestsMock, getGuardianMeetingRequestReviewMock } = vi.hoisted(() => ({
  listGuardianMeetingRequestsMock: vi.fn(),
  getGuardianMeetingRequestReviewMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  listGuardianMeetingRequests: listGuardianMeetingRequestsMock,
  getGuardianMeetingRequestReview: getGuardianMeetingRequestReviewMock,
}));

import ConsultationHistoryTab from "./ConsultationHistoryTab";

const baseMeeting = {
  id: "mr1",
  childId: null,
  childName: null,
  subject: null,
  content: "요즘 수학 성적이 걱정됩니다",
  contactPreference: null,
  preferredContactTime: null,
  status: "requested",
  startsAt: null,
  endsAt: null,
  googleMeetLink: null,
  createdAt: "2027-01-01T00:00:00.000Z",
};

describe("ConsultationHistoryTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("신청 내역을 불러와 상태와 사유를 보여준다", async () => {
    listGuardianMeetingRequestsMock.mockResolvedValue([baseMeeting]);
    render(<ConsultationHistoryTab />);
    await waitFor(() => expect(screen.getByText("신청됨")).toBeInTheDocument());
    expect(screen.getByText(/요즘 수학 성적이 걱정됩니다/)).toBeInTheDocument();
  });

  it("완료된 상담은 리뷰 보기를 눌러 확정 리뷰를 보여준다", async () => {
    listGuardianMeetingRequestsMock.mockResolvedValue([{ ...baseMeeting, status: "completed" }]);
    getGuardianMeetingRequestReviewMock.mockResolvedValue({
      finalText: "확정된 리뷰 내용입니다",
      finalizedAt: "2027-01-02T00:00:00.000Z",
      driveLink: null,
    });
    render(<ConsultationHistoryTab />);
    await waitFor(() => expect(screen.getByText("완료")).toBeInTheDocument());
    fireEvent.click(screen.getByText("리뷰 보기"));
    await waitFor(() => expect(screen.getByText("확정된 리뷰 내용입니다")).toBeInTheDocument());
    // 미팅록 접근 권한이 granted로 확인되지 않았으므로 링크를 노출하지 않는다.
    expect(screen.queryByText("미팅록 보기")).not.toBeInTheDocument();
  });

  it("driveLink가 있으면(granted 확인됨) 미팅록 링크를 보여준다", async () => {
    listGuardianMeetingRequestsMock.mockResolvedValue([{ ...baseMeeting, status: "completed" }]);
    getGuardianMeetingRequestReviewMock.mockResolvedValue({
      finalText: "확정된 리뷰 내용입니다",
      finalizedAt: "2027-01-02T00:00:00.000Z",
      driveLink: { driveFileId: "file123" },
    });
    render(<ConsultationHistoryTab />);
    await waitFor(() => expect(screen.getByText("완료")).toBeInTheDocument());
    fireEvent.click(screen.getByText("리뷰 보기"));
    await waitFor(() => expect(screen.getByText("미팅록 보기")).toBeInTheDocument());
  });
});
