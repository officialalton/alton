import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TrialOnboardingLinkProgress from "./TrialOnboardingLinkProgress";
import {
  getTrialOnboardingLinkDetailAction,
  listTrialOnboardingLinkStudentsAction,
  retryFailedTrialOnboardingStudentAction,
} from "./trial-onboarding-actions";

vi.mock("./trial-onboarding-actions", () => ({
  getTrialOnboardingLinkDetailAction: vi.fn(),
  listTrialOnboardingLinkStudentsAction: vi.fn(),
  retryFailedTrialOnboardingStudentAction: vi.fn(),
}));

// 2026-09-06(발송 상태 조회 화면) — 제품 오너 지적: 온보딩 안내를 보낸 뒤
// 보호자가 계정을 만들기 전까지의 상태(누구에게 보냈는지, 학생별로 무엇을
// 입력했는지, 계정 생성이 어디까지 됐는지)를 확인할 방법이 없었다. 이 화면이
// 그 조회 창구다 — 렌더링과 데이터 정확성, 실패한 학생의 재시도 버튼 연결을 고정한다.
describe("TrialOnboardingLinkProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("발송 내역 보기를 누르면 링크·학생별 진행 상태를 정확히 보여준다", async () => {
    vi.mocked(getTrialOnboardingLinkDetailAction).mockResolvedValue({
      linkId: "link1",
      guardianEmail: "guardian@example.com",
      guardianName: "김보호자",
      status: "pending",
      noticeDeliveryStatus: "sent",
      noticeSentAt: "2026-09-06T01:00:00.000Z",
      noticeSendError: null,
      createdAt: "2026-09-06T00:00:00.000Z",
      expiresAt: "2026-09-09T00:00:00.000Z",
      redeemedAt: null,
    });
    vi.mocked(listTrialOnboardingLinkStudentsAction).mockResolvedValue([
      {
        id: "s1",
        studentName: "학생1",
        studentEmail: "s1@example.com",
        studentGrade: "9학년",
        studentSubject: "수학",
        status: "pending",
        childAuthUserId: null,
        error: null,
      },
      {
        id: "s2",
        studentName: "학생2",
        studentEmail: "s2@example.com",
        studentGrade: null,
        studentSubject: null,
        status: "failed",
        childAuthUserId: null,
        error: "이메일 형식이 올바르지 않습니다.",
      },
    ]);

    render(<TrialOnboardingLinkProgress linkId="link1" />);
    fireEvent.click(screen.getByTestId("trial-onboarding-link-progress-toggle"));

    await waitFor(() => expect(screen.getByTestId("trial-onboarding-link-progress")).toBeInTheDocument());

    expect(screen.getByText(/보호자 확인 대기/)).toBeInTheDocument();
    expect(screen.getByText(/김보호자/)).toBeInTheDocument();
    expect(screen.getByText(/guardian@example.com/)).toBeInTheDocument();
    expect(screen.getAllByTestId("trial-onboarding-link-progress-student")).toHaveLength(2);
    expect(screen.getByText(/학생1/)).toBeInTheDocument();
    expect(screen.getByText(/학생2/)).toBeInTheDocument();
    expect(screen.getByText(/이메일 형식이 올바르지 않습니다/)).toBeInTheDocument();
    // 실패한 학생에게만 재시도 버튼이 있어야 한다.
    expect(screen.getAllByRole("button", { name: "재시도" })).toHaveLength(1);
  });

  it("실패한 학생을 재시도해 성공하면 목록을 새로고침하고 재시도 버튼이 사라진다", async () => {
    vi.mocked(getTrialOnboardingLinkDetailAction).mockResolvedValue({
      linkId: "link1",
      guardianEmail: "guardian@example.com",
      guardianName: "김보호자",
      status: "redeemed",
      noticeDeliveryStatus: "sent",
      noticeSentAt: "2026-09-06T01:00:00.000Z",
      noticeSendError: null,
      createdAt: "2026-09-06T00:00:00.000Z",
      expiresAt: "2026-09-09T00:00:00.000Z",
      redeemedAt: "2026-09-06T02:00:00.000Z",
    });
    vi.mocked(listTrialOnboardingLinkStudentsAction)
      .mockResolvedValueOnce([
        {
          id: "s2",
          studentName: "학생2",
          studentEmail: "s2@example.com",
          studentGrade: null,
          studentSubject: null,
          status: "failed",
          childAuthUserId: null,
          error: "일시적 오류",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "s2",
          studentName: "학생2",
          studentEmail: "s2@example.com",
          studentGrade: null,
          studentSubject: null,
          status: "created",
          childAuthUserId: "child2",
          error: null,
        },
      ]);
    vi.mocked(retryFailedTrialOnboardingStudentAction).mockResolvedValue({ status: "created", childId: "child2" });

    render(<TrialOnboardingLinkProgress linkId="link1" />);
    fireEvent.click(screen.getByTestId("trial-onboarding-link-progress-toggle"));
    await waitFor(() => expect(screen.getByRole("button", { name: "재시도" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "재시도" }));

    await waitFor(() => expect(retryFailedTrialOnboardingStudentAction).toHaveBeenCalledWith("link1", "s2"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument());
    expect(screen.getAllByText(/계정 생성 완료/).length).toBeGreaterThan(0);
  });
});
