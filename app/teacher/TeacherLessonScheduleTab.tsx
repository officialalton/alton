"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherLessonScheduleItem, ExternalBusyBlock } from "./lesson-schedule-actions";
import type { AvailabilityExceptionRow } from "./availability-actions";
import MonthCalendar, { type DayBadge } from "@/app/components/MonthCalendar";
import { dateKeyInTimezone, dateKeysCoveredByInterval, buildWeekGrid, todayKeyInTimezone } from "@/lib/calendar-date-utils";

const SYNC_STATUS_LABEL: Record<string, string> = {
  pending: "Calendar 연동 준비 중",
  synced: "Calendar 연동 완료",
  failed: "Calendar 연동 재시도 중",
  reconciliation_needed: "Calendar 연동 확인 필요(관리자 처리 중)",
};

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

export type TeacherLessonScheduleTabProps = {
  lessons: TeacherLessonScheduleItem[];
  exceptions: AvailabilityExceptionRow[];
  timezone: string;
  onCancel: (reservationId: string, reason: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onLoadExternalBusy: (params: { rangeStart: string; rangeEnd: string }) => Promise<ExternalBusyBlock[]>;
};

export default function TeacherLessonScheduleTab({
  lessons,
  exceptions,
  timezone,
  onCancel,
  onRefresh,
  onLoadExternalBusy,
}: TeacherLessonScheduleTabProps) {
  const router = useRouter();
  const [view, setView] = useState<"week-list" | "week" | "month">("week-list");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [externalBusyBlocks, setExternalBusyBlocks] = useState<ExternalBusyBlock[]>([]);

  const todayKey = todayKeyInTimezone(timezone);

  useEffect(() => {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 35);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 35);
    onLoadExternalBusy({ rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString() })
      .then(setExternalBusyBlocks)
      .catch(() => setExternalBusyBlocks([]));
  }, [onLoadExternalBusy]);

  const externalBusyDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const block of externalBusyBlocks) {
      for (const key of dateKeysCoveredByInterval(block.startsAt, block.endsAt, timezone)) keys.add(key);
    }
    return keys;
  }, [externalBusyBlocks, timezone]);

  const externalBusyForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return externalBusyBlocks.filter((b) => dateKeysCoveredByInterval(b.startsAt, b.endsAt, timezone).includes(selectedDateKey));
  }, [externalBusyBlocks, selectedDateKey, timezone]);

  const badgesByDate = useMemo(() => {
    const badges: Record<string, DayBadge> = {};
    for (const ex of exceptions) {
      badges[ex.exceptionDate] = { count: 1, tone: ex.kind === "blocked" ? "red" : "grey" };
    }
    for (const lesson of lessons) {
      const key = dateKeyInTimezone(lesson.startsAt, timezone);
      const existing = badges[key];
      badges[key] = { count: (existing?.count ?? 0) + 1, tone: "ink" };
    }
    return badges;
  }, [lessons, exceptions, timezone]);

  const weekGrid = useMemo(() => buildWeekGrid(todayKey), [todayKey]);
  const weekDateKeys = new Set(weekGrid.map((c) => c.dateKey));

  const visibleLessons = useMemo(() => {
    if (view === "week-list") {
      return lessons.filter((l) => weekDateKeys.has(dateKeyInTimezone(l.startsAt, timezone)));
    }
    if (selectedDateKey) {
      return lessons.filter((l) => dateKeyInTimezone(l.startsAt, timezone) === selectedDateKey);
    }
    return lessons;
  }, [lessons, view, selectedDateKey, timezone, weekDateKeys]);

  async function handleCancel(reservationId: string) {
    const reason = cancelReasonDraft.trim() || "선생님 취소";
    setSubmitting(true);
    setError(null);
    try {
      await onCancel(reservationId, reason);
      setCancellingReservationId(null);
      setCancelReasonDraft("");
      router.refresh();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">정규수업 일정</h1>
        <div className="flex gap-1.5">
          {(["week-list", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${view === v ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
            >
              {v === "week-list" ? "금주 목록" : v === "week" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">
        확정 수업(파란 점)과 등록해둔 휴무·임시 오픈(빨강·회색 점)을 함께 표시합니다. 밑줄이 있는 날짜는 Google
        캘린더의 다른 개인 일정이 있어 "외부 일정·예약 불가"입니다(제목·내용·참석자는 절대 표시하지 않습니다). 실제
        Google 조회는 Sandbox 승인 전까지 항상 빈 결과를 반환합니다.
      </p>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {view === "month" && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-3 mb-4">
          <MonthCalendar
            timezone={timezone}
            selectedDateKey={selectedDateKey}
            onSelectDate={(k) => setSelectedDateKey(k === selectedDateKey ? null : k)}
            badgesByDate={badgesByDate}
            externalBusyDates={externalBusyDateKeys}
            initialYearMonth={(lessons[0] ? dateKeyInTimezone(lessons[0].startsAt, timezone) : todayKey).slice(0, 7)}
          />
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekGrid.map((cell) => {
            const badge = badgesByDate[cell.dateKey];
            const isSelected = cell.dateKey === selectedDateKey;
            const hasExternalBusy = externalBusyDateKeys.has(cell.dateKey);
            return (
              <button
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey === selectedDateKey ? null : cell.dateKey)}
                title={hasExternalBusy ? "외부 일정 있음(예약 불가)" : undefined}
                className={
                  "rounded-lg py-2 text-[12px] flex flex-col items-center gap-0.5 border-[1.5px] " +
                  (isSelected ? "bg-ink text-white border-ink" : "border-grey-200 text-ink") +
                  (hasExternalBusy ? " underline decoration-grey-500 decoration-2 underline-offset-2" : "")
                }
              >
                <span>{cell.day}</span>
                {badge && badge.count > 0 && (
                  <span
                    className={
                      "w-1.5 h-1.5 rounded-full " +
                      (isSelected ? "bg-white" : badge.tone === "red" ? "bg-red" : badge.tone === "grey" ? "bg-grey-500" : "bg-ink")
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedDateKey && externalBusyForSelectedDate.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-grey-500 mb-1">외부 일정(예약 불가)</div>
          <div className="flex flex-wrap gap-1.5">
            {externalBusyForSelectedDate.map((b, i) => (
              <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                외부 일정 · {formatDateTime(b.startsAt, timezone).split(" ").slice(-2).join(" ")}~
                {formatDateTime(b.endsAt, timezone).split(" ").slice(-2).join(" ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {visibleLessons.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {view !== "week-list" && selectedDateKey ? "이 날짜에 예정된 수업이 없습니다." : "예정된 수업이 없습니다."}
        </div>
      ) : (
        visibleLessons.map((lesson) => (
          <div key={lesson.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">
                  {lesson.studentName} · {lesson.subjectName}
                </div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(lesson.startsAt, timezone)}</div>
              </div>
              {cancellingReservationId !== lesson.reservationId && (
                <button
                  disabled={submitting}
                  onClick={() => {
                    setCancellingReservationId(lesson.reservationId);
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
                {SYNC_STATUS_LABEL[lesson.googleSyncStatus] ?? lesson.googleSyncStatus}
              </span>
              {lesson.externalChangeStatus !== "none" && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">관리자 확인 필요(외부 변경 감지)</span>
              )}
              {lesson.googleMeetLink && (
                <a href={lesson.googleMeetLink} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-ink underline">
                  Meet 입장
                </a>
              )}
            </div>
            {cancellingReservationId === lesson.reservationId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">취소 사유</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={cancelReasonDraft}
                  onChange={(e) => setCancelReasonDraft(e.target.value)}
                  placeholder="예: 개인 사정"
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
                    onClick={() => handleCancel(lesson.reservationId)}
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
