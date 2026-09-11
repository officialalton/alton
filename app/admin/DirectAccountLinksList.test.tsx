import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DirectAccountLinksList from "./DirectAccountLinksList";
import { listDirectOnboardingLinksAction, type DirectOnboardingLinkSummary } from "./direct-account-actions";

// 2026-09-10(P1-B 신규 통합 보드 — 계정 생성 탭 이관) — 학부모 탭에서 신규 >
// 계정 생성 탭으로 옮기면서 TTL 캐시 + 스켈레톤 + 재시도로 바꿨다. 이
// 테스트는 그 세 가지가 실제로 동작하는지 확인한다.

vi.mock("./direct-account-actions", () => ({
  listDirectOnboardingLinksAction: vi.fn(),
}));

vi.mock("./TrialOnboardingLinkProgress", () => ({
  default: () => null,
}));

const link: DirectOnboardingLinkSummary = {
  linkId: "link1",
  guardianEmail: "parent@example.com",
  guardianName: "박보호자",
  status: "pending",
  noticeDeliveryStatus: "sent",
  noticeSentAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  studentCount: 1,
  studentsCreated: 0,
  studentsFailed: 0,
  studentsCancelled: 0,
};

describe("DirectAccountLinksList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("최초 진입 시 스켈레톤을 보여준 뒤 발송 내역으로 대체된다", async () => {
    vi.mocked(listDirectOnboardingLinksAction).mockResolvedValue([link]);
    render(<DirectAccountLinksList />);
    expect(screen.getAllByTestId("direct-onboarding-links-skeleton").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText("박보호자")).toBeInTheDocument());
    expect(screen.queryByTestId("direct-onboarding-links-skeleton")).not.toBeInTheDocument();
  });

  it("조회 실패 시 재시도 문구를 보여주고, 다시 시도를 누르면 재조회한다", async () => {
    vi.mocked(listDirectOnboardingLinksAction).mockRejectedValueOnce(new Error("네트워크 오류"));
    render(<DirectAccountLinksList />);
    await waitFor(() => expect(screen.getByTestId("direct-onboarding-links-error")).toBeInTheDocument());

    vi.mocked(listDirectOnboardingLinksAction).mockResolvedValueOnce([link]);
    fireEvent.click(screen.getByText("다시 시도"));
    await waitFor(() => expect(screen.getByText("박보호자")).toBeInTheDocument());
  });

  it("발송 내역이 없으면 안내 문구를 보여준다", async () => {
    vi.mocked(listDirectOnboardingLinksAction).mockResolvedValue([]);
    render(<DirectAccountLinksList />);
    await waitFor(() => expect(screen.getByText("아직 발송한 내역이 없습니다.")).toBeInTheDocument());
  });
});
