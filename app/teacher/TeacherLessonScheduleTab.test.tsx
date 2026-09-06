import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TeacherLessonScheduleTab from "./TeacherLessonScheduleTab";
import type { TeacherLessonScheduleItem } from "./lesson-schedule-actions";
import {
  listMyTrialSessionsNeedingReview,
  listActiveReviewCategories,
  saveTrialLessonReviewDraft,
  finalizeTrialLessonReview,
} from "./trial-review-actions";

vi.mock("./trial-review-actions", () => ({
  listMyTrialSessionsNeedingReview: vi.fn(),
  listActiveReviewCategories: vi.fn(),
  saveTrialLessonReviewDraft: vi.fn(),
  finalizeTrialLessonReview: vi.fn(),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const lesson: TeacherLessonScheduleItem = {
  reservationId: "r1",
  sessionId: "s1",
  studentName: "지훈",
  subjectName: "SAT Math",
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 120 * 60_000).toISOString(),
  status: "confirmed",
  googleMeetLink: "https://meet.google.com/abc-defg-hij",
  googleSyncStatus: "synced",
  externalChangeStatus: "none",
  isTrial: false,
  smartNotesDriveFileId: null,
  finalStatus: "scheduled",
  subjectEnrollmentId: "se1",
  reviewStatus: "none",
};

describe("TeacherLessonScheduleTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listActiveReviewCategories as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: "overall", label: "종합 의견" },
    ]);
  });

  it("수업이 없으면 안내 문구를 보여준다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("금주 목록에 이번주 수업이 표시된다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.getByText(/지훈 · SAT Math/)).toBeInTheDocument();
    expect(screen.getByText("정규")).toBeInTheDocument();
    expect(screen.getByText(/120분/)).toBeInTheDocument();
  });

  it("M5-a: scheduled 상태 수업에는 수업 시작/종료/노쇼 확정 버튼이 보이고 클릭 시 각각 호출된다", async () => {
    const onStartSession = vi.fn().mockResolvedValue(undefined);
    const onFinalizeSession = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={onRefresh}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={onStartSession}
        onFinalizeSession={onFinalizeSession}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 시작"));
    await waitFor(() => expect(onStartSession).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());

    fireEvent.click(screen.getByText("수업 종료(완료)"));
    await waitFor(() =>
      expect(onFinalizeSession).toHaveBeenCalledWith({ sessionId: "s1", outcome: "completed", reason: "선생님 수업 종료" })
    );

    fireEvent.click(screen.getByText("학생 노쇼 확정(15분 미접속)"));
    fireEvent.click(screen.getByText("확정"));
    await waitFor(() =>
      expect(onFinalizeSession).toHaveBeenCalledWith({
        sessionId: "s1",
        outcome: "student_no_show",
        reason: "선생님 확인 — 학생 15분 이상 미접속",
      })
    );
  });

  it("M5-a: 이미 completed된 세션에는 시작/종료 버튼이 보이지 않는다", () => {
    const completedLesson: TeacherLessonScheduleItem = { ...lesson, finalStatus: "completed" };
    render(
      <TeacherLessonScheduleTab
        lessons={[completedLesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.queryByText("수업 시작")).not.toBeInTheDocument();
    expect(screen.queryByText("수업 종료(완료)")).not.toBeInTheDocument();
  });

  it("체험 수업은 '체험' 배지를 보여주고, Smart Notes가 연결됐으면 링크를 보여준다", () => {
    const trialLesson: TeacherLessonScheduleItem = {
      ...lesson,
      isTrial: true,
      endsAt: new Date(new Date(lesson.startsAt).getTime() + 60 * 60_000).toISOString(),
      smartNotesDriveFileId: "drive-file-1",
    };
    render(
      <TeacherLessonScheduleTab
        lessons={[trialLesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.getByText("체험")).toBeInTheDocument();
    expect(screen.getByText(/60분/)).toBeInTheDocument();
    const link = screen.getByText("Smart Notes 보기");
    expect(link.closest("a")).toHaveAttribute("href", "https://drive.google.com/file/d/drive-file-1/view");
  });

  it("Smart Notes가 아직 연결 안 됐으면 링크를 보여주지 않는다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.queryByText("Smart Notes 보기")).not.toBeInTheDocument();
  });

  it("취소하면 onCancel이 호출되고 onRefresh가 실행된다", async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <TeacherLessonScheduleTab lessons={[lesson]} exceptions={[]} timezone="America/Los_Angeles" onCancel={onCancel} onRefresh={onRefresh} onLoadExternalBusy={vi.fn().mockResolvedValue([])} onStartSession={vi.fn()} onFinalizeSession={vi.fn()} onResolveLateness={vi.fn()} />
    );
    fireEvent.click(screen.getByText("취소"));
    fireEvent.click(screen.getByText("취소 확정"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith("r1", "선생님 취소"));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("외부 변경이 감지되면 관리자 확인 필요 배지가 보인다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[{ ...lesson, externalChangeStatus: "time_changed" }]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.getByText("관리자 확인 필요(외부 변경 감지)")).toBeInTheDocument();
  });

  it("월간 뷰에서 외부 바쁨 블록이 있는 날짜에 표시가 붙고, 선택 시 목록에 노출된다(제목·내용 없음)", async () => {
    const today = new Date();
    const busyDay = new Date(today.getFullYear(), today.getMonth(), 10, 19, 0, 0);
    const busyStart = busyDay.toISOString();
    const busyEnd = new Date(busyDay.getTime() + 60 * 60_000).toISOString();
    const onLoadExternalBusy = vi.fn().mockResolvedValue([{ startsAt: busyStart, endsAt: busyEnd }]);
    render(
      <TeacherLessonScheduleTab
        lessons={[]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={onLoadExternalBusy}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    await waitFor(() => expect(onLoadExternalBusy).toHaveBeenCalled());
    fireEvent.click(screen.getByText("월간"));
    await waitFor(() => expect(screen.getByLabelText("다음 달")).toBeInTheDocument());

    const day10 = screen.getAllByText("10").find((el) => el.closest("button"));
    fireEvent.click(day10!.closest("button")!);

    await waitFor(() => expect(screen.getByText("외부 일정(예약 불가)")).toBeInTheDocument());
    expect(screen.getByText(/^외부 일정 ·/)).toBeInTheDocument();
  });

  it("외부 바쁨 블록 조회가 실패해도(미승인 등) 화면은 정상 렌더링된다", async () => {
    const onLoadExternalBusy = vi.fn().mockRejectedValue(new Error("not implemented"));
    render(
      <TeacherLessonScheduleTab
        lessons={[]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={onLoadExternalBusy}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("M4 UAT #5 — 시간이 지난 정규 수업은 지난 수업으로, 리뷰 미확정 체험 수업은 예정된 수업에 남는다", () => {
    const pastRegular: TeacherLessonScheduleItem = {
      ...lesson,
      reservationId: "r-past-regular",
      sessionId: "s-past-regular",
      startsAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
      endsAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      finalStatus: "completed",
    };
    const pastTrialUnreviewed: TeacherLessonScheduleItem = {
      ...lesson,
      reservationId: "r-past-trial",
      sessionId: "s-past-trial",
      isTrial: true,
      startsAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
      endsAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      finalStatus: "completed",
      reviewStatus: "none",
    };
    render(
      <TeacherLessonScheduleTab
        lessons={[pastRegular, pastTrialUnreviewed]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    // 체험(리뷰 미확정)은 예정된 수업 목록에 바로 보인다.
    expect(screen.getByText(/체험/)).toBeInTheDocument();
    expect(screen.getByText("수업 리뷰 작성")).toBeInTheDocument();
    // 정규는 지난 수업으로 넘어가 접혀 있다 — "지난 수업 (1)" 토글이 보이고
    // 펼치기 전까지는 정규 카드 자체가 렌더링되지 않는다.
    expect(screen.getByText(/지난 수업 \(1\)/)).toBeInTheDocument();
    expect(screen.queryByText("정규")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/지난 수업 \(1\)/));
    expect(screen.getByText("정규")).toBeInTheDocument();
  });

  it("완료된 체험 수업의 '수업 리뷰 작성'을 누르면 팝업이 뜨고, 공개 확정하면 팝업이 닫히고 목록이 갱신된다", async () => {
    const trialNeedingReview: TeacherLessonScheduleItem = {
      ...lesson,
      isTrial: true,
      finalStatus: "completed",
      reviewStatus: "none",
    };
    (listMyTrialSessionsNeedingReview as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: trialNeedingReview.sessionId,
        subjectEnrollmentId: trialNeedingReview.subjectEnrollmentId,
        startsAt: trialNeedingReview.startsAt,
        finalStatus: "completed",
        reviewStatus: "none",
        aiSummary: null,
        draftText: null,
        categoryNotes: {},
      },
    ]);
    (saveTrialLessonReviewDraft as ReturnType<typeof vi.fn>).mockResolvedValue({ reviewId: "rev1" });
    (finalizeTrialLessonReview as ReturnType<typeof vi.fn>).mockResolvedValue({ reviewId: "rev1" });
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <TeacherLessonScheduleTab
        lessons={[trialNeedingReview]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={onRefresh}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 리뷰 작성"));
    await waitFor(() => expect(listMyTrialSessionsNeedingReview).toHaveBeenCalled());
    expect(await screen.findByText("수업 리뷰 작성", { selector: "h2" })).toBeInTheDocument();

    const textarea = await screen.findByLabelText("고객에게 보여줄 종합 의견");
    fireEvent.change(textarea, { target: { value: "체험 수업 리뷰 내용" } });
    fireEvent.click(screen.getByRole("button", { name: "공개 확정" }));
    fireEvent.click(screen.getByRole("button", { name: "네, 공개합니다" }));

    await waitFor(() =>
      expect(finalizeTrialLessonReview).toHaveBeenCalledWith({
        sessionId: trialNeedingReview.sessionId,
        finalText: "체험 수업 리뷰 내용",
      })
    );
    await waitFor(() => expect(screen.queryByText("수업 리뷰 작성", { selector: "h2" })).not.toBeInTheDocument());
    expect(onRefresh).toHaveBeenCalled();
  });

  it("닫기를 누르면 리뷰 팝업이 저장 없이 닫힌다", async () => {
    const trialNeedingReview: TeacherLessonScheduleItem = {
      ...lesson,
      isTrial: true,
      finalStatus: "completed",
      reviewStatus: "none",
    };
    (listMyTrialSessionsNeedingReview as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: trialNeedingReview.sessionId,
        subjectEnrollmentId: trialNeedingReview.subjectEnrollmentId,
        startsAt: trialNeedingReview.startsAt,
        finalStatus: "completed",
        reviewStatus: "none",
        aiSummary: null,
        draftText: null,
        categoryNotes: {},
      },
    ]);

    render(
      <TeacherLessonScheduleTab
        lessons={[trialNeedingReview]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 리뷰 작성"));
    await screen.findByText("수업 리뷰 작성", { selector: "h2" });
    fireEvent.click(screen.getByText("닫기"));
    expect(screen.queryByText("수업 리뷰 작성", { selector: "h2" })).not.toBeInTheDocument();
    expect(finalizeTrialLessonReview).not.toHaveBeenCalled();
  });

  it("이미 리뷰가 확정된 체험 수업은 리뷰 작성 버튼을 보여주지 않는다", () => {
    const trialReviewed: TeacherLessonScheduleItem = {
      ...lesson,
      isTrial: true,
      finalStatus: "completed",
      reviewStatus: "final",
    };
    render(
      <TeacherLessonScheduleTab
        lessons={[trialReviewed]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );
    expect(screen.queryByText("수업 리뷰 작성")).not.toBeInTheDocument();
  });
});
