"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookableSubjectEnrollment, UpcomingBooking, PastSessionForReport } from "./lesson-booking-data";
import type { WeeklySeriesOccurrenceResult } from "@/lib/booking/create-booking";
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
  upcomingBookings: UpcomingBooking[];
  pastSessionsForReport: PastSessionForReport[];
  regularLessonTypeId: string | null;
  lessonDurationMinutes: number;
  timezone: string;
  onListSlots: (teacherId: string, durationMinutes: number) => Promise<Date[]>;
  onCreateBooking: (params: {
    subjectEnrollmentId: string;
    teacherId: string;
    lessonTypeId: string;
    startsAt: Date;
    durationMinutes: number;
  }) => Promise<{ reservationId: string; sessionId: string }>;
  onCreateWeeklySeries: (params: {
    subjectEnrollmentId: string;
    teacherId: string;
    lessonTypeId: string;
    firstStartsAt: Date;
    durationMinutes: number;
    occurrences: number;
    seriesTimezone: string;
  }) => Promise<WeeklySeriesOccurrenceResult[]>;
  onCancelBooking: (reservationId: string, reason: string) => Promise<void>;
  onUpdateTimezone?: (timezone: string) => Promise<void>;
  onReportTeacherIssue: (params: {
    sessionId: string;
    reportType: "teacher_late" | "teacher_no_show_reported";
    minutesLate?: number;
    notes?: string;
  }) => Promise<void>;
};

export default function LessonBookingTab({
  bookableEnrollments,
  upcomingBookings,
  pastSessionsForReport,
  regularLessonTypeId,
  lessonDurationMinutes,
  timezone,
  onListSlots,
  onCreateBooking,
  onCreateWeeklySeries,
  onCancelBooking,
  onUpdateTimezone,
  onReportTeacherIssue,
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

  const selectedEnrollment = bookableEnrollments.find((e) => e.subjectEnrollmentId === selectedEnrollmentId) ?? null;

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
    if (!selectedEnrollment || !regularLessonTypeId) return;
    setLoadingSlots(true);
    onListSlots(selectedEnrollment.teacherId, lessonDurationMinutes)
      .then(setSlots)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingSlots(false));
  }, [selectedEnrollment, regularLessonTypeId, lessonDurationMinutes, onListSlots]);

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
      setSlots(await onListSlots(selectedEnrollment.teacherId, lessonDurationMinutes));
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
    if (!selectedEnrollment || !regularLessonTypeId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "single") {
        await onCreateBooking({
          subjectEnrollmentId: selectedEnrollment.subjectEnrollmentId,
          teacherId: selectedEnrollment.teacherId,
          lessonTypeId: regularLessonTypeId,
          startsAt: slot,
          durationMinutes: lessonDurationMinutes,
        });
        setMessage("예약이 확정됐습니다.");
        router.refresh();
        await refetchSlots();
      } else {
        const results = await onCreateWeeklySeries({
          subjectEnrollmentId: selectedEnrollment.subjectEnrollmentId,
          teacherId: selectedEnrollment.teacherId,
          lessonTypeId: regularLessonTypeId,
          firstStartsAt: slot,
          durationMinutes: lessonDurationMinutes,
          occurrences: 8,
          seriesTimezone: timezone,
        });
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

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">정규수업 예약</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        최소 24시간 이후부터 최대 8주 이내로 예약할 수 있습니다. 수업은 120분, 앞뒤 15분 버퍼가 자동 적용됩니다.
      </p>

      {browserTimezone && browserTimezone !== timezone && !timezoneBannerDismissed && (
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

      {bookableEnrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">
          예약 가능한 과목이 없습니다(선생님 배정이 필요합니다).
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-[12px] font-bold text-grey-500 mb-1.5">과목·선생님 선택</label>
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

          <div className="mt-4">
            {loadingSlots && <div className="text-[13px] text-grey-500">예약 가능 시간을 불러오는 중…</div>}
            {!loadingSlots && slots && slots.length === 0 && (
              <div className="text-[13px] text-grey-500">현재 예약 가능한 시간이 없습니다.</div>
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
                      className="text-[12px] font-bold border-[1.5px] border-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
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
                    <div className="text-[13px] text-grey-500">이 날짜는 예약 가능한 시간이 없습니다.</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {slotsForSelectedDate.map((slot) => (
                      <button
                        key={slot.toISOString()}
                        disabled={submitting}
                        onClick={() => setPendingSlot(slot)}
                        className="text-[12px] font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:border-ink disabled:opacity-50"
                      >
                        {formatTime(slot, timezone)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {pendingSlot && (
            <div className="mt-4 border-[1.5px] border-ink rounded-xl px-5 py-4">
              <div className="text-[13px] font-bold text-ink mb-2">예약 확인</div>
              <div className="text-[13px] text-ink mb-1">
                {selectedEnrollment?.subjectName} · {selectedEnrollment?.teacherName} 선생님
              </div>
              <div className="text-[13px] text-grey-500 mb-3">
                {mode === "single"
                  ? formatDateTime(pendingSlot.toISOString(), timezone)
                  : `첫 회차 ${formatDateTime(pendingSlot.toISOString(), timezone)}부터 매주 같은 시간, 최대 8회`}
              </div>
              {mode === "weekly" && (
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
      )}

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

      {upcomingView === "calendar" && (
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

      {(() => {
        const visibleBookings =
          upcomingView === "calendar" && upcomingCalendarDateKey
            ? upcomingBookings.filter((b) => dateKeyInTimezone(b.startsAt, timezone) === upcomingCalendarDateKey)
            : upcomingBookings;
        if (visibleBookings.length === 0) {
          return (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
              {upcomingView === "calendar" && upcomingCalendarDateKey ? "이 날짜에 예정된 수업이 없습니다." : "예정된 수업이 없습니다."}
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
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-grey-100 text-grey-500">
                {SYNC_STATUS_LABEL[b.googleSyncStatus] ?? b.googleSyncStatus}
              </span>
              {b.googleMeetLink && (
                <a href={b.googleMeetLink} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-ink underline">
                  Meet 링크
                </a>
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

      <h2 className="text-[15px] font-bold text-ink mb-2.5 mt-8">지난 수업 지각·노쇼 신고</h2>
      {pastSessionsForReport.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          최근 14일 이내 신고할 수 있는 수업이 없습니다.
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
    </div>
  );
}
