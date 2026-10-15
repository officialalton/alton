import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ViewerTimezoneProvider } from "@/app/components/ViewerTimezoneProvider";
import ContractArchivePanel from "./ContractArchivePanel";
import UnifiedScheduleTab from "./UnifiedScheduleTab";
import { listContractArchiveAction } from "./contract-archive-actions";
import * as bookingActions from "./booking-actions";

vi.mock("./contract-archive-actions", () => ({ listContractArchiveAction: vi.fn() }));
vi.mock("./booking-actions", () => ({ listAllTeacherLessons: vi.fn() }));

const row = {
  contractId: "ct-1", studentName: "지훈", guardianName: "김민지", status: "active",
  createdAt: "2026-09-01T00:00:00Z", latestVersionId: "cv-1", latestVersionNumber: 2,
  envelopeStatus: "completed", envelopeStatusUpdatedAt: "2026-09-02T00:00:00Z", companySignedAt: "2026-09-02T00:00:00Z",
  signedArtifactId: "da-1", signedArtifactSyncStatus: "succeeded", signedArtifactDownloadable: true, amendmentRequired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  (listContractArchiveAction as ReturnType<typeof vi.fn>).mockResolvedValue([row]);
  vi.stubGlobal("fetch", vi.fn());
});

describe("관리자 화면은 뷰어(관리자 본인) 시간대로 날짜를 표시한다", () => {
  it("ContractArchivePanel: LA 뷰어는 전날(8월 31일), 미설정(Seoul 기본)은 9월 1일", async () => {
    const la = render(
      <ViewerTimezoneProvider timezone="America/Los_Angeles"><ContractArchivePanel /></ViewerTimezoneProvider>
    );
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    expect(la.container.textContent).toContain("2026년 8월 31일");
    la.unmount();
    const seoul = render(
      <ViewerTimezoneProvider timezone={null}><ContractArchivePanel /></ViewerTimezoneProvider>
    );
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    expect(seoul.container.textContent).toContain("2026년 9월 1일");
  });

  it("UnifiedScheduleTab: '오늘' 경계가 뷰어 시간대를 따른다(추가 시간대 요청 없음)", async () => {
    // 2026-09-01T10:00Z = LA 9/1 03:00, Seoul 9/1 19:00. 수업 00:30Z = LA 8/31 17:30(어제), Seoul 9/1 09:30(오늘).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    try {
      vi.mocked(bookingActions.listAllTeacherLessons).mockResolvedValue([
        {
          reservationId: "r1", sessionId: "s1", teacherId: "t1", teacherName: "김선생",
          studentName: "지훈", subjectName: "SAT Math", startsAt: "2026-09-01T00:30:00Z", endsAt: "2026-09-01T01:30:00Z",
          status: "confirmed", googleSyncStatus: "synced", externalChangeStatus: "none",
        },
      ]);
      const la = render(
        <ViewerTimezoneProvider timezone="America/Los_Angeles"><UnifiedScheduleTab initialMonthAnchor="2026-09" /></ViewerTimezoneProvider>
      );
      await waitFor(() => expect(screen.getByText("해당 범위에 예약이 없습니다.")).toBeInTheDocument());
      la.unmount();
      render(<ViewerTimezoneProvider timezone={null}><UnifiedScheduleTab initialMonthAnchor="2026-09" /></ViewerTimezoneProvider>);
      await waitFor(() => expect(screen.getByText(/김선생 선생님/)).toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });
});
