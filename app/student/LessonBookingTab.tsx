"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BookableSubjectEnrollment,
  PendingActivationSubject,
  UpcomingBooking,
  PastSessionForReport,
} from "./lesson-booking-data";
import type { WeeklySeriesOccurrenceResult, BookingActionOutcome } from "@/lib/booking/create-booking";
import MonthCalendar from "@/app/components/MonthCalendar";
import { dateKeyInTimezone, todayKeyInTimezone } from "@/lib/calendar-date-utils";

const TEACHER_ISSUE_TYPE_LABEL: Record<"teacher_late" | "teacher_no_show_reported", string> = {
  teacher_late: "선생님 지각",
  teacher_no_show_reported: "선생님 노쇼",
};

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
}

function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// 2026-09-03 정책 전환(요구사항 1) — Calendar 네이티브 초대가 학생 본인에게 발송되므로
// 그 발송 상태를 보여준다. 내부 Google 오류 원문은 절대 노출하지 않는다(관리자 화면에만).
const SYNC_STATUS_LABEL: Record<string, string> = {
  pending: "Calendar 초대 발송 준비 중",
  synced: "Calendar 초대 발송 완료",
  failed: "Calendar 초대 발송 재시도 중",
  reconciliation_needed: "Calendar 초대 발송 실패 — 관리자 조치 중",
};

export type LessonBookingTabProps = {
  bookableEnrollments: BookableSubjectEnrollment[];
  // v3 재매칭 후 예약 결함 수정(2026-09-11) — 계약/수업권이 아직 활성화되지
  // 않은 재매칭 건. 캘린더를 띄우는 대신 "정규 계약 대기" 안내만 보여준다.
  pendingActivationSubjects?: PendingActivationSubject[];
  upcomingBookings: UpcomingBooking[];
  pastSessionsForReport: PastSessionForReport[];
  timezone: string;
  onListSlots: (teacherId: string, durationMinutes: number) => Promise<Date[]>;
  onCreateBooking: (params: {
    subjectEnrollmentId: string;
    teacherId: string;
    lessonTypeId: string;
    startsAt: Date;
    durationMinutes: number;
  }) => Promise<BookingActionOutcome<{ reservationId: string; sessionId: string }>>;
  onCreateWeeklySeries: (params: {
    subjectEnrollmentId: string;
    teacherId: string;
    lessonTypeId: string;
    firstStartsAt: Date;
    durationMinutes: number;
    occurrences: number;
    seriesTimezone: string;
  }) => Promise<BookingActionOutcome<WeeklySeriesOccurrenceResult[]>>;
  onCancelBooking: (reservationId: string, reason: string) => Promise<void>;
  onUpdateTimezone?: (timezone: string) => Promise<void>;
  onReportTeacherIssue: (params: {
    sessionId: string;
    reportType: "teacher_late" | "teacher_no_show_reported";
    minutesLate?: number;
    notes?: string;
  }) => Promise<void>;
  // "수업" 탭 정리(A안) — "레슨"/"예약"을 하나의 "수업" 탭(ClassesTab)으로 합치면서
  // mode를 지정하면 예정/지난 중 하나의 블록만 보여준다(미지정 시 기존처럼 모두 표시 —
  // 다른 호출부·테스트 호환).
  mode?: "upcoming" | "past";
  hideHeader?: boolean;
};

export default function LessonBookingTab({
  bookableEnrollments,
  pendingActivationSubjects = [],
  upcomingBookings,
  pastSessionsForReport,
  timezone,
  onListSlots,
  onCreateBooking,
  onCreateWeeklySeries,
  onCancelBooking,
  onUpdateTimezone,
  onReportTeacherIssue,
  mode: tabMode,
  hideHeader = false,
}: LessonBookingTabProps) {
  const router = useRouter();
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(bookableEnrollments[0]?.subjectEnrollmentId ?? "");
  const [mode, setMode] = useState<"single" | "weekly">("single");
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserTimezone, setBrowserTimezone] = useState<string | null>(null);
  const [timezoneBannerDismissed, setTimezoneBannerDismissed] = useState(false);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [reportingSessionId, setReportingSessionId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"teacher_late" | "teacher_no_show_reported">("teacher_late");
  const [reportMinutesLate, setReportMinutesLate] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedSessionIds, setReportedSessionIds] = useState<Set<string>>(new Set());
  const [pendingSlot, setPendingSlot] = useState<Date | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [upcomingView, setUpcomingView] = useState<"list" | "calendar">("list");
  const [upcomingCalendarDateKey, setUpcomingCalendarDateKey] = useState<string | null>(null);
  // 레이아웃 정리(2026-09-06) — "예정된 수업"이 이미 있는 학생에게 매번 예약 폼(과목
  // 선택·슬롯 로딩)부터 크게 보여주면 위쪽에 불필요한 여백/로딩 문구만 계속 남는다는
  // 지적(제품 오너 실사용 확인)에 따라, 예정 수업이 이미 있으면 폼을 기본 접어두고
  // 목록을 먼저 보여준다. 예정 수업이 하나도 없는 신규 학생은 바로 예약할 수 있도록
  // 기본으로 펼쳐둔다.
  const [showBookingForm, setShowBookingForm] = useState(() => upcomingBookings.length === 0);

  const selectedEnrollment = bookableEnrollments.find((e) => e.subjectEnrollmentId === selectedEnrollmentId) ?? null;

  // 체험 수업은 1회만 예약 가능 — 선택된 과목이 체험이고 "이 수강 건" 자체로
  // 이미 예정된 수업이 있다면 더 예약할 수 없는 상태이므로, 폼 대신 안내만
  // 보여주고 슬롯 조회도 생략한다("예약 가능 시간을 불러오는 중…"이 의미
  // 없이 계속 떠 있던 버그의 원인). v3 재매칭 후 예약 결함 수정(2026-09-11)
  // — 과목명·선생님명 문자열 일치로 판정하면, 매칭 종료된 옛 수강 건의
  // 예약(같은 과목·같은 선생님으로 재매칭한 경우)까지 걸려 "이미 예약함"으로
  // 잘못 막았다 — subjectEnrollmentId로만 비교한다.
  const hasExistingTrialBooking =
    !!selectedEnrollment?.isTrial &&
    upcomingBookings.some((b) => b.subjectEnrollmentId === selectedEnrollment.subjectEnrollmentId);

  // onListSlots는 부모(ParentShell/StudentShell)가 매 렌더마다 새로 만드는
  // 인라인 함수라 참조가 계속 바뀐다 — 이걸 그대로 useEffect 의존성에 넣으면
  // 이 화면과 무관한 부모 리렌더(다른 탭 상태 변경 등)만으로도 슬롯이 원인
  // 모르게 재조회되는 것처럼 보였다(실사용 확인). ref로 최신 값만 따라가고,
  // 실제로 다시 조회해야 하는 조건(선생님·수업시간이 바뀔 때)만 의존성으로 둔다.
  const onListSlotsRef = useRef(onListSlots);
  useEffect(() => {
    onListSlotsRef.current = onListSlots;
  }, [onListSlots]);

  useEffect(() => {
    try {
      setBrowserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setBrowserTimezone(null);
    }
  }, []);

  useEffect(() => {
    setSlots(null);
    setError(null);
    setMessage(null);
    setSelectedDateKey(null);
    if (!selectedEnrollment) return;
    if (selectedEnrollment.isTrial) setMode("single");
    if (hasExistingTrialBooking) return;
    setLoadingSlots(true);
    onListSlotsRef
      .current(selectedEnrollment.teacherId, selectedEnrollment.lessonDurationMinutes)
      .then(setSlots)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingSlots(false));
  }, [selectedEnrollment?.teacherId, selectedEnrollment?.lessonDurationMinutes, selectedEnrollment?.isTrial, hasExistingTrialBooking]);

  const slotDateBadges = useMemo(() => {
    const badges: Record<string, { count: number; tone?: "ink" | "grey" | "red" }> = {};
    for (const slot of slots ?? []) {
      const key = dateKeyInTimezone(slot.toISOString(), timezone);
      badges[key] = { count: (badges[key]?.count ?? 0) + 1, tone: "ink" };
    }
    return badges;
  }, [slots, timezone]);

  useEffect(() => {
    if (selectedDateKey || !slots || slots.length === 0) return;
    setSelectedDateKey(dateKeyInTimezone(slots[0].toISOString(), timezone));
  }, [slots, timezone, selectedDateKey]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return (slots ?? []).filter((slot) => dateKeyInTimezone(slot.toISOString(), timezone) === selectedDateKey);
  }, [slots, selectedDateKey, timezone]);

  async function refetchSlots() {
    if (!selectedEnrollment) return;
    try {
      setSlots(await onListSlots(selectedEnrollment.teacherId, selectedEnrollment.lessonDurationMinutes));
    } catch {
      // 슬롯 재조회 실패는 조용히 무시 — 다음 선택 변경 시 useEffect가 다시 시도한다.
    }
  }

  const weeklyPreviewDates = useMemo(() => {
    if (!pendingSlot) return [];
    return Array.from({ length: 8 }, (_, i) => new Date(pendingSlot.getTime() + i * 7 * 24 * 60 * 60_000));
  }, [pendingSlot]);

  async function handleConfirmPendingSlot() {
    if (!pendingSlot) return;
    const slot = pendingSlot;
    setPendingSlot(null);
    await handlePickSlot(slot);
  }

  async function handlePickSlot(slot: Date) {
    if (!selectedEnrollment) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "single" || selectedEnrollment.isTrial) {
        const result = await onCreateBooking({
          subjectEnrollmentId: selectedEnrollment.subjectEnrollmentId,
          teacherId: selectedEnrollment.teacherId,
          lessonTypeId: selectedEnrollment.lessonTypeId,
          startsAt: slot,
          durationMinutes: selectedEnrollment.lessonDurationMinutes,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setMessage("예약이 확정됐습니다.");
        router.refresh();
        await refetchSlots();
      } else {
        const result = await onCreateWeeklySeries({
          subjectEnrollmentId: selectedEnrollment.subjectEnrollmentId,
          teacherId: selectedEnrollment.teacherId,
          lessonTypeId: selectedEnrollment.lessonTypeId,
          firstStartsAt: slot,
          durationMinutes: selectedEnrollment.lessonDurationMinutes,
          occurrences: 8,
          seriesTimezone: timezone,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        const results = result.data;
        const succeeded = results.filter((r) => r.reservationId).length;
        const firstFailure = results.find((r) => r.failureReason);
        setMessage(
          firstFailure
            ? `${succeeded}회 예약 완료 — ${succeeded + 1}회차부터는 "${firstFailure.failureReason}"로 생성되지 않았습니다.`
            : `${succeeded}회 전부 예약 완료됐습니다.`
        );
        router.refresh();
        await refetchSlots();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(reservationId: string) {
    const reason = cancelReasonDraft.trim() || "사용자 취소";
    setSubmitting(true);
    setError(null);
    try {
      await onCancelBooking(reservationId, reason);
      setMessage("예약이 취소됐습니다.");
      setCancellingReservationId(null);
      setCancelReasonDraft("");
      router.refresh();
      await refetchSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // "수업" 탭 정리(A안) — 선생님 포털의 "수업 시작" Meet 자동 입장 패턴을 재사용한다.
  // 2026-09-09(제품 오너 지시 — about:blank 버그 수정): 빈 탭을 먼저 연 뒤
  // location.href를 나중에 설정하는 패턴을 완전히 제거한다("noopener"가 있으면
  // window.open()이 null을 반환해 location.href 대입이 항상 스킵되던 버그가
  // 있었다). Meet URL을 window.open()에 직접 전달한다.
  function handleStartClass(sessionId: string, meetLink: string | null) {
    if (!meetLink) return;
    window.open(meetLink, "_blank", "noopener,noreferrer");
    // 2026-09-09(UAT 지적): Meet 입장뿐 아니라 이 화면(현재 탭)도 바로
    // 세션뷰(교재·화이트보드)로 이동해야 한다.
    router.push(`/session/${sessionId}`);
  }

  function openReportForm(sessionId: string) {
    setReportingSessionId(sessionId);
    setReportType("teacher_late");
    setReportMinutesLate("");
    setReportNotes("");
    setError(null);
  }

  async function handleSubmitReport(sessionId: string) {
    setReportSubmitting(true);
    setError(null);
    try {
      await onReportTeacherIssue({
        sessionId,
        reportType,
        minutesLate: reportType === "teacher_late" ? Number(reportMinutesLate) || undefined : undefined,
        notes: reportNotes.trim() || undefined,
      });
      setReportedSessionIds((prev) => new Set(prev).add(sessionId));
      setReportingSessionId(null);
      setMessage("신고가 접수됐습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReportSubmitting(false);
    }
  }

  const showUpcoming = tabMode !== "past";
  const showPast = tabMode !== "upcoming";

  return (
    <div className={hideHeader ? "max-w-[640px] px-8 pt-4" : "max-w-[640px] px-8 py-8"}>
      {showUpcoming && !hideHeader && (
        <>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">수업 예약</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        최소 24시간 이후부터 최대 8주 이내로 예약할 수 있습니다.
        {selectedEnrollment
          ? ` 수업은 ${selectedEnrollment.lessonDurationMinutes}분, 앞뒤 15분 버퍼가 자동 적용됩니다.`
          : " 수업은 120분(체험은 60분), 앞뒤 15분 버퍼가 자동 적용됩니다."}
      </p>
        </>
      )}

      {showUpcoming && browserTimezone && browserTimezone !== timezone && !timezoneBannerDismissed && (
        <div className="mb-5 text-[12px] bg-grey-100 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span>
            현재 브라우저 시간대는 <span className="font-semibold">{browserTimezone}</span>이지만 계정 설정은{" "}
            <span className="font-semibold">{timezone}</span>입니다. 아래 예약 시간은 계정 설정 시간대 기준으로 표시됩니다.
          </span>
          <div className="flex gap-2 shrink-0">
            {onUpdateTimezone && (
              <button
                className="text-[12px] font-bold text-ink underline"
                onClick={() => onUpdateTimezone(browserTimezone).then(() => setTimezoneBannerDismissed(true))}
              >
                브라우저 시간대로 변경
              </button>
            )}
            <button className="text-[12px] text-grey-500" onClick={() => setTimezoneBannerDismissed(true)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {message && <div className="mb-4 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{message}</div>}
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {showUpcoming && pendingActivationSubjects.length > 0 && (
        <div className="mb-4 text-[12.5px] text-grey-600 bg-grey-100 rounded-lg px-4 py-3">
          {pendingActivationSubjects.map((s) => (
            <div key={s.subjectEnrollmentId}>
              {s.subjectName} · {s.teacherName} 선생님 — 정규 계약 대기 상태입니다. 계약과 수업권이
              확인되면 예약할 수 있습니다.
            </div>
          ))}
        </div>
      )}

      {showUpcoming && (bookableEnrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">
          아직 선생님 배정이 완료되지 않았어요. 배정이 끝나면 이 화면에서
          바로 예약할 수 있어요.
        </div>
      ) : !showBookingForm ? (
        <div className="mb-6">
          <button
            onClick={() => setShowBookingForm(true)}
            className="text-[12px] font-bold text-ink bg-grey-100 rounded-lg px-3 py-2"
          >
            + 새 수업 예약하기
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[12px] font-bold text-grey-500">과목·선생님 선택</label>
            <button onClick={() => setShowBookingForm(false)} className="text-[11px] font-semibold text-grey-500">
              접기
            </button>
          </div>
          <select
            className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px]"
            value={selectedEnrollmentId}
            onChange={(e) => setSelectedEnrollmentId(e.target.value)}
          >
            {bookableEnrollments.map((e) => (
              <option key={e.subjectEnrollmentId} value={e.subjectEnrollmentId}>
                {e.subjectName} · {e.teacherName} 선생님
              </option>
            ))}
          </select>

          {hasExistingTrialBooking ? (
            <div className="mt-3 text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
              이미 체험 수업을 예약하셨습니다. 체험 수업은 1회만 예약할 수 있습니다.
            </div>
          ) : selectedEnrollment?.isTrial ? (
            <div className="mt-3 text-[12px] text-grey-500">체험 수업은 1회만 예약할 수 있습니다.</div>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${mode === "single" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
                onClick={() => setMode("single")}
              >
                1회 예약
              </button>
              <button
                className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${mode === "weekly" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
                onClick={() => setMode("weekly")}
              >
                주 1회 반복(최대 8회)
              </button>
            </div>
          )}

          {!hasExistingTrialBooking && (
          <div className="mt-4">
            {loadingSlots && <div className="text-[13px] text-grey-500">예약 가능 시간을 불러오는 중…</div>}
            {!loadingSlots && slots && slots.length === 0 && (
              <div className="text-[13px] text-grey-500">
                지금은 열린 시간이 없어요. 다른 날짜를 확인해보시거나 선생님께
                시간 조율을 요청해보세요.
              </div>
            )}
            {!loadingSlots && slots && slots.length > 0 && (
              <div className="mb-4">
                <div className="text-[12px] font-bold text-grey-500 mb-1.5">빠른 추천 시간</div>
                <div className="flex flex-wrap gap-1.5">
                  {slots.slice(0, 3).map((slot) => (
                    <button
                      key={`quick-${slot.toISOString()}`}
                      disabled={submitting}
                      onClick={() => setPendingSlot(slot)}
                      className={
                        "text-[12px] font-bold border-[1.5px] rounded-lg px-3 py-1.5 disabled:opacity-50 " +
                        (pendingSlot?.toISOString() === slot.toISOString()
                          ? "bg-ink text-white border-ink"
                          : "border-ink")
                      }
                    >
                      {formatDateTime(slot.toISOString(), timezone)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loadingSlots && slots && slots.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,260px)_1fr] gap-4">
                <div className="border-[1.5px] border-grey-200 rounded-xl p-3">
                  <MonthCalendar
                    timezone={timezone}
                    selectedDateKey={selectedDateKey}
                    onSelectDate={setSelectedDateKey}
                    badgesByDate={slotDateBadges}
                    initialYearMonth={(selectedDateKey ?? dateKeyInTimezone(slots[0].toISOString(), timezone)).slice(0, 7)}
                  />
                </div>
                <div>
                  <div data-testid="selected-date-label" className="text-[12px] font-bold text-grey-500 mb-1.5">
                    {selectedDateKey
                      ? new Intl.DateTimeFormat("ko-KR", { timeZone: timezone, month: "long", day: "numeric", weekday: "short" }).format(
                          new Date(`${selectedDateKey}T12:00:00Z`)
                        )
                      : "날짜를 선택하세요"}
                  </div>
                  {selectedDateKey && slotsForSelectedDate.length === 0 && (
                    <div className="text-[13px] text-grey-500">
                      이 날짜는 열린 시간이 없어요. 다른 날짜를 선택해보세요.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {slotsForSelectedDate.map((slot) => (
                      <button
                        key={slot.toISOString()}
                        disabled={submitting}
                        onClick={() => setPendingSlot(slot)}
                        className={
                          "text-[12px] font-semibold border-[1.5px] rounded-lg px-3 py-1.5 disabled:opacity-50 " +
                          (pendingSlot?.toISOString() === slot.toISOString()
                            ? "bg-ink text-white border-ink"
                            : "border-grey-200 hover:border-ink")
                        }
                      >
                        {formatTime(slot, timezone)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {pendingSlot && (
            <div className="mt-4 border-[1.5px] border-ink rounded-xl px-5 py-4">
              <div className="text-[13px] font-bold text-ink mb-2">예약 확인</div>
              <div className="text-[13px] text-ink mb-1">
                {selectedEnrollment?.subjectName} · {selectedEnrollment?.teacherName} 선생님
              </div>
              <div className="text-[13px] text-grey-500 mb-3">
                {mode === "single" || selectedEnrollment?.isTrial
                  ? formatDateTime(pendingSlot.toISOString(), timezone)
                  : `첫 회차 ${formatDateTime(pendingSlot.toISOString(), timezone)}부터 매주 같은 시간, 최대 8회`}
              </div>
              {mode === "weekly" && !selectedEnrollment?.isTrial && (
                <div className="mb-3">
                  <div className="text-[11px] font-bold text-grey-500 mb-1">
                    생성 시도할 날짜(최대 8회 — 선생님 가용시간·수업권 잔여량에 따라 일부만 생성될 수 있습니다)
                  </div>
                  <ul className="text-[12px] text-grey-500 list-disc list-inside">
                    {weeklyPreviewDates.map((d) => (
                      <li key={d.toISOString()}>{formatDateTime(d.toISOString(), timezone)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  disabled={submitting}
                  onClick={() => setPendingSlot(null)}
                  className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                >
                  다시 선택
                </button>
                <button
                  disabled={submitting}
                  onClick={handleConfirmPendingSlot}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  최종 확정
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showUpcoming && (
      <div className="flex items-center justify-between mt-8 mb-2.5">
        <h2 className="text-[15px] font-bold text-ink">예정된 수업</h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => setUpcomingView("list")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${upcomingView === "list" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
          >
            목록
          </button>
          <button
            onClick={() => setUpcomingView("calendar")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${upcomingView === "calendar" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
          >
            월간
          </button>
        </div>
      </div>
      )}

      {showUpcoming && upcomingView === "calendar" && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-3 mb-4">
          <MonthCalendar
            timezone={timezone}
            selectedDateKey={upcomingCalendarDateKey}
            onSelectDate={(k) => setUpcomingCalendarDateKey(k === upcomingCalendarDateKey ? null : k)}
            badgesByDate={upcomingBookings.reduce<Record<string, { count: number }>>((acc, b) => {
              const key = dateKeyInTimezone(b.startsAt, timezone);
              acc[key] = { count: (acc[key]?.count ?? 0) + 1 };
              return acc;
            }, {})}
            initialYearMonth={(upcomingBookings[0] ? dateKeyInTimezone(upcomingBookings[0].startsAt, timezone) : todayKeyInTimezone(timezone)).slice(0, 7)}
          />
        </div>
      )}

      {showUpcoming && (() => {
        const visibleBookings =
          upcomingView === "calendar" && upcomingCalendarDateKey
            ? upcomingBookings.filter((b) => dateKeyInTimezone(b.startsAt, timezone) === upcomingCalendarDateKey)
            : upcomingBookings;
        if (visibleBookings.length === 0) {
          return (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
              {upcomingView === "calendar" && upcomingCalendarDateKey
                ? "이 날짜에 예정된 수업이 없습니다."
                : "예정된 수업이 없어요. 위에서 새 수업을 예약해보세요."}
            </div>
          );
        }
        return visibleBookings.map((b) => (
          <div key={b.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">
                  {b.subjectName} · {b.teacherName} 선생님
                </div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(b.startsAt, timezone)}</div>
              </div>
              {cancellingReservationId !== b.reservationId && (
                <button
                  disabled={submitting}
                  onClick={() => {
                    setCancellingReservationId(b.reservationId);
                    setCancelReasonDraft("");
                  }}
                  className="text-[12px] font-bold text-red disabled:opacity-50"
                >
                  취소
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-grey-100 text-grey-500">
                {SYNC_STATUS_LABEL[b.googleSyncStatus] ?? b.googleSyncStatus}
              </span>
              <button
                onClick={() => router.push(`/session/${b.sessionId}`)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-ink"
              >
                수업 준비
              </button>
              {b.googleMeetLink && (
                <button
                  onClick={() => handleStartClass(b.sessionId, b.googleMeetLink)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink text-white"
                >
                  수업 시작
                </button>
              )}
            </div>
            {cancellingReservationId === b.reservationId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">취소 사유</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={cancelReasonDraft}
                  onChange={(e) => setCancelReasonDraft(e.target.value)}
                  placeholder="예: 일정이 바뀌었어요"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={submitting}
                    onClick={() => setCancellingReservationId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    닫기
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleCancel(b.reservationId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    취소 확정
                  </button>
                </div>
              </div>
            )}
          </div>
        ));
      })()}

      {showPast && (
      <>
      <h2 className="text-[15px] font-bold text-ink mb-2.5 mt-8">지난 수업</h2>
      {pastSessionsForReport.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          최근 14일 이내 지난 수업이 없습니다.
        </div>
      ) : (
        pastSessionsForReport.map((s) => (
          <div key={s.sessionId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">
                  {s.subjectName} · {s.teacherName} 선생님
                </div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(s.startsAt, timezone)}</div>
                <button
                  onClick={() => router.push(`/session/${s.sessionId}`)}
                  className="text-[12px] font-semibold text-blue mt-1"
                >
                  수업 준비 내역
                </button>
              </div>
              {reportingSessionId !== s.sessionId &&
                (reportedSessionIds.has(s.sessionId) ? (
                  <span className="text-[12px] font-semibold text-grey-500">신고 접수됨</span>
                ) : (
                  <button
                    disabled={reportSubmitting}
                    onClick={() => openReportForm(s.sessionId)}
                    className="text-[12px] font-bold text-red disabled:opacity-50"
                  >
                    지각·노쇼 신고
                  </button>
                ))}
            </div>
            {reportingSessionId === s.sessionId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">신고 유형</label>
                <select
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as "teacher_late" | "teacher_no_show_reported")}
                >
                  {(Object.keys(TEACHER_ISSUE_TYPE_LABEL) as Array<keyof typeof TEACHER_ISSUE_TYPE_LABEL>).map((k) => (
                    <option key={k} value={k}>
                      {TEACHER_ISSUE_TYPE_LABEL[k]}
                    </option>
                  ))}
                </select>
                {reportType === "teacher_late" && (
                  <>
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">지각 시간(분)</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                      value={reportMinutesLate}
                      onChange={(e) => setReportMinutesLate(e.target.value)}
                      placeholder="예: 10"
                    />
                  </>
                )}
                <label className="block text-[11px] font-bold text-grey-500 mb-1">상세 내용(선택)</label>
                <input
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="상황을 알려주세요"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={reportSubmitting}
                    onClick={() => setReportingSessionId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    닫기
                  </button>
                  <button
                    disabled={reportSubmitting || (reportType === "teacher_late" && !reportMinutesLate)}
                    onClick={() => handleSubmitReport(s.sessionId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    신고 제출
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
      </>
      )}
    </div>
  );
}
