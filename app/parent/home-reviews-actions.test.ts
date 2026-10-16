import { describe, expect, it, vi } from "vitest";

// 2026-09-18 — getHomeConsultationReviews()는 홈 "상담 리뷰" 서브탭 전용 읽기
// wrapper다. inquiry-actions.ts(상담 담당자 소유)의 listGuardianMeetingRequests/
// getGuardianMeetingRequestReview를 그대로 재사용하므로, 여기서는 그 두 함수를
// 목으로 두고 조합 로직(완료된 것만·리뷰 없는 건 제외·최신순 정렬·미팅록 링크
// 조립)만 검증한다.

const listGuardianMeetingRequests = vi.fn();
const getGuardianMeetingRequestReview = vi.fn();
vi.mock("./inquiry-actions", () => ({
  listGuardianMeetingRequests: (...args: unknown[]) => listGuardianMeetingRequests(...args),
  getGuardianMeetingRequestReview: (...args: unknown[]) => getGuardianMeetingRequestReview(...args),
}));

vi.mock("./lesson-review-family-actions", () => ({
  getLessonReviewsForFamily: vi.fn().mockResolvedValue([]),
}));

import { getHomeConsultationReviews } from "./home-reviews-actions";

describe("getHomeConsultationReviews", () => {
  it("completed가 아닌 상담 신청은 리뷰를 조회하지 않고 제외한다", async () => {
    listGuardianMeetingRequests.mockResolvedValue([
      { id: "mr1", status: "scheduling", startsAt: null, endsAt: null },
    ]);
    const result = await getHomeConsultationReviews();
    expect(result).toEqual([]);
    expect(getGuardianMeetingRequestReview).not.toHaveBeenCalled();
  });

  it("completed여도 확정된 리뷰가 없으면(null) 제외한다", async () => {
    listGuardianMeetingRequests.mockResolvedValue([
      { id: "mr1", status: "completed", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-09-01T00:30:00Z" },
    ]);
    getGuardianMeetingRequestReview.mockResolvedValue(null);
    const result = await getHomeConsultationReviews();
    expect(result).toEqual([]);
  });

  it("미팅록 권한이 granted가 아니면(driveLink null) '없음'으로 취급하고 링크를 지어내지 않는다", async () => {
    listGuardianMeetingRequests.mockResolvedValue([
      { id: "mr1", status: "completed", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-09-01T00:30:00Z" },
    ]);
    getGuardianMeetingRequestReview.mockResolvedValue({
      finalText: "리뷰 내용",
      finalizedAt: "2026-09-02T00:00:00Z",
      driveLink: null,
    });
    const result = await getHomeConsultationReviews();
    expect(result).toEqual([
      {
        meetingRequestId: "mr1",
        startsAt: "2026-09-01T00:00:00Z",
        endsAt: "2026-09-01T00:30:00Z",
        finalText: "리뷰 내용",
        finalizedAt: "2026-09-02T00:00:00Z",
        meetingRecordLink: null,
      },
    ]);
  });

  it("미팅록 권한이 granted면 Drive 링크를 조립하고, 최신 확정순으로 정렬한다", async () => {
    listGuardianMeetingRequests.mockResolvedValue([
      { id: "mr-old", status: "completed", startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-08-01T00:30:00Z" },
      { id: "mr-new", status: "completed", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-09-01T00:30:00Z" },
    ]);
    getGuardianMeetingRequestReview.mockImplementation(async (id: string) => {
      if (id === "mr-old") {
        return { finalText: "옛 리뷰", finalizedAt: "2026-08-02T00:00:00Z", driveLink: { driveFileId: "file-old" } };
      }
      return { finalText: "새 리뷰", finalizedAt: "2026-09-02T00:00:00Z", driveLink: { driveFileId: "file-new" } };
    });
    const result = await getHomeConsultationReviews();
    expect(result.map((r) => r.meetingRequestId)).toEqual(["mr-new", "mr-old"]);
    expect(result[0].meetingRecordLink).toBe("https://drive.google.com/file/d/file-new/view");
  });
});
