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
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: pushMock }) }));

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

  it("예정 수업 목록에 수업이 표시된다", () => {
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

  it("2026-09-09(UAT 지적): '수업 준비'는 각 수업 카드의 정확한 sessionId로만 세션뷰에 진입하고, 다른 수업으로 이동하지 않는다", () => {
    const otherLesson: TeacherLessonScheduleItem = {
      ...lesson,
      reservationId: "r2",
      sessionId: "s2",
      studentName: "민지",
      subjectName: "AP Calculus AB",
    };
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson, otherLesson]}
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

    const prepButtons = screen.getAllByText("수업 준비");
    expect(prepButtons).toHaveLength(2);

    fireEvent.click(prepButtons[1]);
    expect(pushMock).toHaveBeenCalledWith(`/session/${otherLesson.sessionId}`);
    expect(pushMock).not.toHaveBeenCalledWith(`/session/${lesson.sessionId}`);

    pushMock.mockClear();
    fireEvent.click(prepButtons[0]);
    expect(pushMock).toHaveBeenCalledWith(`/session/${lesson.sessionId}`);
    expect(pushMock).not.toHaveBeenCalledWith(`/session/${otherLesson.sessionId}`);
  });

  it("M5-a: scheduled 상태 수업에는 수업 시작 버튼만 보이고 클릭 시 호출된다(2026-09-06: 완료/노쇼는 시작 전에는 노출되지 않음)", async () => {
    const onStartSession = vi.fn().mockResolvedValue({ ok: true });
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
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );

    expect(screen.queryByText("수업 종료(완료)")).not.toBeInTheDocument();
    expect(screen.queryByText(/학생 노쇼 확정/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("수업 시작"));
    await waitFor(() => expect(onStartSession).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("2026-09-09(제품 오너 지시): 수업 시작 클릭 시 Meet URL이 window.open()에 직접 전달되고, 시작 성공 시 세션뷰로 이동한다", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const onStartSession = vi.fn().mockResolvedValue({ ok: true });
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
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 시작"));

    // 빈 탭을 연 뒤 location.href를 나중에 설정하는 패턴은 완전히 제거됐다
    // ("noopener"가 있으면 window.open()이 null을 반환해 location.href 대입이
    // 항상 스킵되는 버그가 있었다) — 실제 Meet URL이 window.open()에 직접
    // 전달되는지 검증한다. 팝업 차단을 피하려면 클릭 핸들러 안에서 동기적으로
    // 열려야 하므로 onStartSession 응답을 기다리기 전에 이미 호출돼 있어야 한다.
    expect(openSpy).toHaveBeenCalledWith(lesson.googleMeetLink, "_blank", "noopener,noreferrer");
    await waitFor(() => expect(onStartSession).toHaveBeenCalledWith("s1"));
    // 2026-09-09(UAT 지적): Meet 새 탭뿐 아니라 현재 탭도 세션뷰로 이동해야 한다.
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/session/s1"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    openSpy.mockRestore();
  });

  it("2026-09-06(#441 마스킹 버그): 수업 시작이 실패(ok:false)해도 에러 메시지를 그대로 보여준다(마스킹 없음)", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const onStartSession = vi.fn().mockResolvedValue({
      ok: false,
      error: "본인 수업만 시작할 수 있습니다.",
    });
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={onStartSession}
        onFinalizeSession={vi.fn()}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 시작"));
    await waitFor(() => expect(screen.getByText("본인 수업만 시작할 수 있습니다.")).toBeInTheDocument());
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
    // 2026-09-09(제품 오너 지시): 더는 핸들을 붙잡고 있다가 닫는 방식이 아니라
    // Meet URL을 window.open()에 직접 전달하므로, 시작 실패와 무관하게 클릭
    // 시점에 이미 열려있다 — 세션뷰로는 이동하지 않아야 한다.
    expect(pushMock).not.toHaveBeenCalledWith("/session/s1");
    openSpy.mockRestore();
  });

  it("2026-09-06(#441 마스킹 버그): 조기 종료 사유 필요 에러(ok:false)를 받으면 확인 다이얼로그를 띄우고, 확인 시 재시도한다", async () => {
    const liveLesson: TeacherLessonScheduleItem = { ...lesson, finalStatus: "live" };
    const onFinalizeSession = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "예약 종료 시각 전에 정상 완료를 확정하려면 조기 종료 사유가 필요합니다 — ..." })
      .mockResolvedValueOnce({ ok: true });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <TeacherLessonScheduleTab
        lessons={[liveLesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={onRefresh}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={onFinalizeSession}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 종료(완료)"));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(onFinalizeSession).toHaveBeenLastCalledWith({
        sessionId: "s1",
        outcome: "completed",
        reason: "학생 사유 조기 종료",
        earlyEndReason: "student_reason",
      })
    );
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("2026-09-06: live 상태 수업에는 종료/노쇼 확정 버튼이 보이고 클릭 시 각각 호출된다", async () => {
    const liveLesson: TeacherLessonScheduleItem = { ...lesson, finalStatus: "live" };
    const onFinalizeSession = vi.fn().mockResolvedValue({ ok: true });
    render(
      <TeacherLessonScheduleTab
        lessons={[liveLesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
        onStartSession={vi.fn()}
        onFinalizeSession={onFinalizeSession}
        onResolveLateness={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("수업 종료(완료)"));
    await waitFor(() =>
      expect(onFinalizeSession).toHaveBeenCalledWith({ sessionId: "s1", outcome: "completed", reason: "선생님 수업 종료" })
    );

    fireEvent.click(screen.getByText(/학생 노쇼 확정/));
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

  it("M4 골든패스 실사용 버그 #3/#4 — '예정 수업 목록'은 이번 주로 제한하지 않고 다음 주 이후 예정 수업도 그대로 보여준다", () => {
    // 실사용 버그 리포트: 선생님 포털 "수업 일정" 탭의 "금주 목록"(이번 주로 필터링)에
    // 표시된 날짜 범위(예: 9/6~9/12) 밖의 9/16 수업이 목록에 나타난다는 지적이 있었다.
    // 제품 오너 결정: "금주" 제한 자체를 없애고 "예정 수업 목록"으로 개명해 오늘 이후
    // 예정된 모든 수업을 보여주기로 했다 — 그러면 이 시나리오는 애초에 "버그"가 아니라
    // 기대 동작이 된다. 이 테스트는 이번 주 범위를 벗어난 다음 주 수업도 목록에 그대로
    // 나타나는지 고정 검증한다.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    const nextWeekLesson: TeacherLessonScheduleItem = {
      ...lesson,
      reservationId: "r-next-week",
      sessionId: "s-next-week",
      startsAt: "2026-09-16T10:00:00Z",
      endsAt: "2026-09-16T11:00:00Z",
    };
    render(
      <TeacherLessonScheduleTab
        lessons={[nextWeekLesson]}
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
    expect(screen.getByText("예정 수업 목록")).toBeInTheDocument();
    expect(screen.getByText(/지훈 · SAT Math/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("M4 UAT #5 — 시간이 지난 정규 수업은 지난 수업으로, 리뷰 미확정 체험 수업은 예정된 수업에 남는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
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
    vi.useRealTimers();
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
