"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookableSubjectEnrollment, UpcomingBooking } from "./lesson-booking-data";
import type { WeeklySeriesOccurrenceResult } from "@/lib/booking/create-booking";

type SlotGroup = { dateLabel: string; slots: Date[] };

function groupSlotsByDate(slots: Date[], timezone: string): SlotGroup[] {
  const groups = new Map<string, Date[]>();
  for (const slot of slots) {
    const dateLabel = new Intl.DateTimeFormat("ko-KR", {
      timeZone: timezone,
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(slot);
    const list = groups.get(dateLabel) ?? [];
    list.push(slot);
    groups.set(dateLabel, list);
  }
  return Array.from(groups.entries()).map(([dateLabel, slotList]) => ({ dateLabel, slots: slotList }));
}

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

const SYNC_STATUS_LABEL: Record<string, string> = {
  pending: "Calendar 연동 준비 중",
  synced: "Calendar 연동 완료",
  failed: "Calendar 연동 재시도 중",
  reconciliation_needed: "Calendar 연동 확인 필요(관리자 처리 중)",
};

export type LessonBookingTabProps = {
  bookableEnrollments: BookableSubjectEnrollment[];
  upcomingBookings: UpcomingBooking[];
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
};

export default function LessonBookingTab({
  bookableEnrollments,
  upcomingBookings,
  regularLessonTypeId,
  lessonDurationMinutes,
  timezone,
  onListSlots,
  onCreateBooking,
  onCreateWeeklySeries,
  onCancelBooking,
  onUpdateTimezone,
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
    if (!selectedEnrollment || !regularLessonTypeId) return;
    setLoadingSlots(true);
    onListSlots(selectedEnrollment.teacherId, lessonDurationMinutes)
      .then(setSlots)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingSlots(false));
  }, [selectedEnrollment, regularLessonTypeId, lessonDurationMinutes, onListSlots]);

  const slotGroups = useMemo(() => groupSlotsByDate(slots ?? [], timezone), [slots, timezone]);

  async function refetchSlots() {
    if (!selectedEnrollment) return;
    try {
      setSlots(await onListSlots(selectedEnrollment.teacherId, lessonDurationMinutes));
    } catch {
      // 슬롯 재조회 실패는 조용히 무시 — 다음 선택 변경 시 useEffect가 다시 시도한다.
    }
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
            {!loadingSlots &&
              slotGroups.map((group) => (
                <div key={group.dateLabel} className="mb-3">
                  <div className="text-[12px] font-bold text-grey-500 mb-1.5">{group.dateLabel}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.slots.map((slot) => (
                      <button
                        key={slot.toISOString()}
                        disabled={submitting}
                        onClick={() => handlePickSlot(slot)}
                        className="text-[12px] font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:border-ink disabled:opacity-50"
                      >
                        {formatTime(slot, timezone)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <h2 className="text-[15px] font-bold text-ink mb-2.5 mt-8">예정된 수업</h2>
      {upcomingBookings.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">예정된 수업이 없습니다.</div>
      ) : (
        upcomingBookings.map((b) => (
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
        ))
      )}
    </div>
  );
}
