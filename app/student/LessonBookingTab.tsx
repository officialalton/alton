"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BookableSubjectEnrollment,
  PendingActivationSubject,
  PendingActivationReason,
  UpcomingBooking,
  PastSessionForReport,
} from "./lesson-booking-data";

// v3 재매칭 후 예약 결함 수정(2026-09-11, 2차 보완) — 실제 계약·수업권 상태를
// 그대로 구분해 보여준다(추정 금지, 제품 오너 지시).
const PENDING_ACTIVATION_REASON_LABEL: Record<PendingActivationReason, string> = {
  contract_pending: "Waiting for the regular contract. You can book once the contract is confirmed.",
  no_entitlement: "No lesson credits available. You can book after purchasing credits.",
  activation_pending: "Your contract and lesson credits are confirmed. You can book as soon as enrollment activation is complete.",
};
import type { WeeklySeriesOccurrenceResult, BookingActionOutcome } from "@/lib/booking/create-booking";
import MonthCalendar from "@/app/components/MonthCalendar";
import { dateKeyInTimezone, todayKeyInTimezone } from "@/lib/calendar-date-utils";
import RescheduleRequestsBanner, { type PendingReschedule } from "./RescheduleRequestsBanner";

const TEACHER_ISSUE_TYPE_LABEL: Record<"teacher_late" | "teacher_no_show_reported", string> = {
  teacher_late: "Teacher was late",
  teacher_no_show_reported: "Teacher did not show up",
};

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
}

function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

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
  // 2026-09-22(사용자 지시) — 선생님 재조정 요청 배너. 학생·보호자 포털이
  // 각자 자기 역할의 서버 액션을 주입한다(둘 다 없으면 배너 자체를 렌더링하지 않음).
  onListPendingReschedule?: () => Promise<PendingReschedule[]>;
  onRespondToReschedule?: (requestId: string, accept: boolean) => Promise<void>;
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
  onListPendingReschedule,
  onRespondToReschedule,
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
      setBrowserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setBrowserTimezone(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
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
        setMessage("Your booking is confirmed.");
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
            ? `${succeeded} ${succeeded === 1 ? "lesson" : "lessons"} booked — lessons from #${succeeded + 1} were not created: "${firstFailure.failureReason}".`
            : `All ${succeeded} lessons booked.`
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
    const reason = cancelReasonDraft.trim() || "Cancelled by user";
    setSubmitting(true);
    setError(null);
    try {
      await onCancelBooking(reservationId, reason);
      setMessage("Your booking was cancelled.");
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
      setMessage("Your report has been submitted.");
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
      {showUpcoming && onListPendingReschedule && onRespondToReschedule && (
        <RescheduleRequestsBanner timezone={timezone} listPending={onListPendingReschedule} onRespond={onRespondToReschedule} />
      )}
      {showUpcoming && !hideHeader && (
        <>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">Book a Lesson</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        You can book from 24 hours ahead up to 8 weeks out.
        {selectedEnrollment
          ? ` Lessons are ${selectedEnrollment.lessonDurationMinutes} minutes.`
          : " Lessons are 120 minutes (trial lessons are 60 minutes)."}
      </p>
        </>
      )}

      {showUpcoming && browserTimezone && browserTimezone !== timezone && !timezoneBannerDismissed && (
        <div className="mb-5 text-[12px] bg-grey-100 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span>
            Your browser time zone is <span className="font-semibold">{browserTimezone}</span>, but your account is set to{" "}
            <span className="font-semibold">{timezone}</span>. Booking times below are shown in your account time zone.
          </span>
          <div className="flex gap-2 shrink-0">
            {onUpdateTimezone && (
              <button
                className="text-[12px] font-bold text-ink underline"
                onClick={() => onUpdateTimezone(browserTimezone).then(() => setTimezoneBannerDismissed(true))}
              >
                Use browser time zone
              </button>
            )}
            <button className="text-[12px] text-grey-500" onClick={() => setTimezoneBannerDismissed(true)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {message && <div className="mb-4 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{message}</div>}
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {showUpcoming && pendingActivationSubjects.length > 0 && (
        <div className="mb-4 text-[12.5px] text-grey-600 bg-grey-100 rounded-lg px-4 py-3 space-y-1">
          {pendingActivationSubjects.map((s) => (
            <div key={s.subjectEnrollmentId}>
              {s.subjectName} · {s.teacherName} — {PENDING_ACTIVATION_REASON_LABEL[s.reason]}
            </div>
          ))}
        </div>
      )}

      {showUpcoming && (bookableEnrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">
          A teacher hasn&apos;t been assigned yet. Once assignment is complete, you can book
          right here.
        </div>
      ) : !showBookingForm ? (
        <div className="mb-6">
          <button
            onClick={() => setShowBookingForm(true)}
            className="text-[12px] font-bold text-ink bg-grey-100 rounded-lg px-3 py-2"
          >
            + Book a new lesson
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[12px] font-bold text-grey-500">Select subject & teacher</label>
            <button onClick={() => setShowBookingForm(false)} className="text-[11px] font-semibold text-grey-500">
              Collapse
            </button>
          </div>
          <select
            className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px]"
            value={selectedEnrollmentId}
            onChange={(e) => setSelectedEnrollmentId(e.target.value)}
          >
            {bookableEnrollments.map((e) => (
              <option key={e.subjectEnrollmentId} value={e.subjectEnrollmentId}>
                {e.subjectName} · {e.teacherName}
              </option>
            ))}
          </select>

          {hasExistingTrialBooking ? (
            <div className="mt-3 text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
              You&apos;ve already booked your trial lesson. Only one trial lesson can be booked.
            </div>
          ) : selectedEnrollment?.isTrial ? (
            <div className="mt-3 text-[12px] text-grey-500">Only one trial lesson can be booked.</div>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${mode === "single" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
                onClick={() => setMode("single")}
              >
                Single lesson
              </button>
              <button
                className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${mode === "weekly" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
                onClick={() => setMode("weekly")}
              >
                Weekly (up to 8 lessons)
              </button>
            </div>
          )}

          {!hasExistingTrialBooking && (
          <div className="mt-4">
            {loadingSlots && <div className="text-[13px] text-grey-500">Loading available times…</div>}
            {!loadingSlots && slots && slots.length === 0 && (
              <div className="text-[13px] text-grey-500">
                No open times right now. Try another date or ask your teacher
                to adjust their availability.
              </div>
            )}
            {!loadingSlots && slots && slots.length > 0 && (
              <div className="mb-4">
                <div className="text-[12px] font-bold text-grey-500 mb-1.5">Quick picks</div>
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
                      ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric", weekday: "short" }).format(
                          new Date(`${selectedDateKey}T12:00:00Z`)
                        )
                      : "Select a date"}
                  </div>
                  {selectedDateKey && slotsForSelectedDate.length === 0 && (
                    <div className="text-[13px] text-grey-500">
                      No open times on this date. Try another date.
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
              <div className="text-[13px] font-bold text-ink mb-2">Confirm booking</div>
              <div className="text-[13px] text-ink mb-1">
                {selectedEnrollment?.subjectName} · {selectedEnrollment?.teacherName}
              </div>
              <div className="text-[13px] text-grey-500 mb-3">
                {mode === "single" || selectedEnrollment?.isTrial
                  ? formatDateTime(pendingSlot.toISOString(), timezone)
                  : `Weekly at the same time starting ${formatDateTime(pendingSlot.toISOString(), timezone)}, up to 8 lessons`}
              </div>
              {mode === "weekly" && !selectedEnrollment?.isTrial && (
                <div className="mb-3">
                  <div className="text-[11px] font-bold text-grey-500 mb-1">
                    Dates to be booked (up to 8 — some may not be created depending on teacher availability and remaining credits)
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
                  Choose again
                </button>
                <button
                  disabled={submitting}
                  onClick={handleConfirmPendingSlot}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showUpcoming && (
      <div className="flex items-center justify-between mt-8 mb-2.5">
        <h2 className="text-[15px] font-bold text-ink">Upcoming Lessons</h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => setUpcomingView("list")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${upcomingView === "list" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
          >
            List
          </button>
          <button
            onClick={() => setUpcomingView("calendar")}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${upcomingView === "calendar" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
          >
            Month
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
                ? "No lessons scheduled on this date."
                : "No upcoming lessons. Book a new lesson above."}
            </div>
          );
        }
        return visibleBookings.map((b) => (
          <div key={b.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                {/* 2026-09-22(사용자 지시) — 과목명·선생님명을 한 줄에 붙이지 말고 분리, 과목명이 위. */}
                <div className="text-[14px] font-bold text-ink">{b.subjectName}</div>
                <div className="text-[13px] text-grey-600">{b.teacherName}</div>
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
                  Cancel
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {/* 2026-09-22(사용자 지시) — "Calendar 초대 발송" 상태는 학생이 볼 필요 없는
                  내부 동기화 정보라 배지를 없앤다. */}
              <button
                onClick={() => router.push(`/session/${b.sessionId}`)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-ink"
              >
                Prepare
              </button>
              {b.googleMeetLink && (
                <button
                  onClick={() => handleStartClass(b.sessionId, b.googleMeetLink)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink text-white"
                >
                  Start lesson
                </button>
              )}
            </div>
            {cancellingReservationId === b.reservationId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">Reason for cancelling</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={cancelReasonDraft}
                  onChange={(e) => setCancelReasonDraft(e.target.value)}
                  placeholder="e.g. My schedule changed"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={submitting}
                    onClick={() => setCancellingReservationId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleCancel(b.reservationId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    Confirm cancellation
                  </button>
                </div>
              </div>
            )}
          </div>
        ));
      })()}

      {showPast && (
      <>
      <h2 className="text-[15px] font-bold text-ink mb-2.5 mt-8">Past Lessons</h2>
      {pastSessionsForReport.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          No past lessons in the last 14 days.
        </div>
      ) : (
        pastSessionsForReport.map((s) => (
          <div key={s.sessionId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink flex items-center gap-1.5">
                  {s.subjectName} · {s.teacherName}
                  {s.needsReview && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-bg text-ink">
                      Review needed
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(s.startsAt, timezone)}</div>
                <button
                  onClick={() => router.push(`/session/${s.sessionId}`)}
                  className="text-[12px] font-semibold text-blue mt-1"
                >
                  Lesson prep details
                </button>
              </div>
              {reportingSessionId !== s.sessionId &&
                (reportedSessionIds.has(s.sessionId) ? (
                  <span className="text-[12px] font-semibold text-grey-500">Report submitted</span>
                ) : (
                  <button
                    disabled={reportSubmitting}
                    onClick={() => openReportForm(s.sessionId)}
                    className="text-[12px] font-bold text-red disabled:opacity-50"
                  >
                    Report late / no-show
                  </button>
                ))}
            </div>
            {reportingSessionId === s.sessionId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">Report type</label>
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
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">Minutes late</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                      value={reportMinutesLate}
                      onChange={(e) => setReportMinutesLate(e.target.value)}
                      placeholder="e.g. 10"
                    />
                  </>
                )}
                <label className="block text-[11px] font-bold text-grey-500 mb-1">Details (optional)</label>
                <input
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Tell us what happened"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={reportSubmitting}
                    onClick={() => setReportingSessionId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    disabled={reportSubmitting || (reportType === "teacher_late" && !reportMinutesLate)}
                    onClick={() => handleSubmitReport(s.sessionId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    Submit report
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
