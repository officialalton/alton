"use client";

// 2026-09-06 — 관리자 상담 가용시간 화면에 월간 뷰 추가. "반복 주간 가능시간"과
// "날짜별 예외"를 각각 따로 보는 대신, 그 둘(+제외 기간)이 실제로 어떤 날짜에
// 어떤 슬롯을 여는지 한 번에 보고 싶다는 요구사항. 관리자가 직접 반복 규칙 +
// 예외를 머릿속으로 계산할 필요 없이, 이미 그 계산을 전부 해주는 기존
// list_open_consult_slots() RPC(랜딩·보호자 포털과 동일한 단일 원본,
// listOpenHomepageConsultSlots() 서버 액션 재사용)를 월 단위로 그대로 조회한다.
// 수업 예약(reservations)/R11 면담 가용시간과는 절대 섞지 않는다(같은 이유로
// 별도 RPC를 새로 만들지 않고 기존 것만 재사용).
//
// 2026-09-07 — 제품 오너 지적 2가지 반영: (1) 월캘린더가 너무 커서 보기 불편함 —
// 선생님 가능시간 화면(TeacherAvailabilityTab)과 동일하게 좁은 컬럼(max-w)에 담아
// 컴팩트하게 줄였다. (2) 하루 단위 통 휴무만 가능했던 문제 — 날짜를 클릭하면
// 그 날짜의 실제 오픈 시간대(computeOpenWindowsForDate, lib/booking/slot-search.ts,
// 선생님 쪽과 동일한 순수 함수 재사용)를 보여주고, 그 아래 부분 시간대만 휴무/임시
// 오픈으로 등록하는 폼을 추가했다(teacher_availability_exceptions와 동일 패턴을
// consult_availability_exceptions.start_time/end_time에 반영 — 20261217000000
// 마이그레이션으로 list_open_consult_slots()가 부분 시간 예외를 실제로 존중하도록
// 고쳤다).

import { useEffect, useState } from "react";
import MonthCalendar from "@/app/components/MonthCalendar";
import { listOpenHomepageConsultSlots } from "@/app/consult-actions";
import { dateKeyInTimezone, dayOfWeekForDateKey } from "@/lib/calendar-date-utils";
import { computeOpenWindowsForDate, type AvailabilityException } from "@/lib/booking/slot-search";
import type { ConsultAvailabilityRule, ConsultAvailabilityException } from "./consultation-scheduling-actions";

function formatTimeLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
}

function monthRangeIso(yearMonth: string): { fromIso: string; toIso: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export type ConsultAvailabilityMonthViewProps = {
  timezone: string;
  /** 테스트/딥링크용 — 없으면 오늘 기준 달. */
  initialYearMonth?: string;
  rules: ConsultAvailabilityRule[];
  exceptions: ConsultAvailabilityException[];
  onAddPartialException: (params: { date: string; isClosed: boolean; startTime: string; endTime: string }) => Promise<void>;
  onAddFullDayException: (params: { date: string; isClosed: boolean }) => Promise<void>;
  onRemoveException: (exceptionId: string) => Promise<void>;
  busyId: string | null;
};

export default function ConsultAvailabilityMonthView({
  timezone,
  initialYearMonth,
  rules,
  exceptions,
  onAddPartialException,
  onAddFullDayException,
  onRemoveException,
  busyId,
}: ConsultAvailabilityMonthViewProps) {
  const [slots, setSlots] = useState<{ startsAt: string }[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialStart, setPartialStart] = useState("13:00");
  const [partialEnd, setPartialEnd] = useState("14:00");
  const [currentYearMonth, setCurrentYearMonth] = useState(initialYearMonth ?? new Date().toISOString().slice(0, 7));

  async function loadMonth(yearMonth: string) {
    setLoading(true);
    setError(null);
    try {
      const { fromIso, toIso } = monthRangeIso(yearMonth);
      const rows = await listOpenHomepageConsultSlots(fromIso, toIso);
      setSlots(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가용시간 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // 예외 목록이 바뀌면(등록/삭제) 현재 보고 있는 달의 실측 슬롯도 다시 불러온다.
  useEffect(() => {
    loadMonth(currentYearMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exceptions, currentYearMonth]);

  const badgesByDate = slots.reduce<Record<string, { count: number }>>((acc, s) => {
    const key = dateKeyInTimezone(s.startsAt, timezone);
    acc[key] = { count: (acc[key]?.count ?? 0) + 1 };
    return acc;
  }, {});

  const selectedDaySlots = selectedDateKey
    ? slots.filter((s) => dateKeyInTimezone(s.startsAt, timezone) === selectedDateKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    : [];

  const exceptionsForSelectedDate = selectedDateKey ? exceptions.filter((e) => e.exception_date === selectedDateKey) : [];
  const fullDayException = exceptionsForSelectedDate.find((e) => !e.start_time) ?? null;
  const partialExceptionsForSelectedDate = exceptionsForSelectedDate.filter((e) => e.start_time);

  // 이 날짜의 실제 오픈 시간대(반복 규칙 + 예외 반영) — 선생님 가능시간 화면과
  // 동일한 순수 함수(computeOpenWindowsForDate)를 그대로 재사용한다.
  const openWindowsForSelectedDate = selectedDateKey
    ? computeOpenWindowsForDate(
        selectedDateKey,
        dayOfWeekForDateKey(selectedDateKey),
        rules.map((r) => ({
          dayOfWeek: r.weekday,
          startTimeLocal: r.start_time,
          endTimeLocal: r.end_time,
          timezone,
          effectiveFrom: "1900-01-01",
          effectiveUntil: null,
        })),
        exceptionsForSelectedDate.map(
          (e): AvailabilityException => ({
            date: selectedDateKey,
            kind: e.is_closed ? "blocked" : "available",
            startTimeLocal: e.start_time,
            endTimeLocal: e.end_time,
            timezone,
          })
        )
      )
    : [];

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="consult-availability-month-view">
      <p className="text-[12.5px] font-bold text-ink mb-1">월간 실제 오픈 슬롯</p>
      <p className="text-[11px] text-grey-500 mb-2">
        반복 가능시간 + 날짜별 예외가 실제로 계산된 결과입니다. 날짜를 클릭하면 그 날짜만 부분 시간대로 휴무·임시오픈을 등록할 수 있습니다.
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      <div className="max-w-[280px]">
        <MonthCalendar
          timezone={timezone}
          selectedDateKey={selectedDateKey}
          onSelectDate={(dateKey) => setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))}
          badgesByDate={badgesByDate}
          initialYearMonth={initialYearMonth}
          onMonthChange={(yearMonth) => { setCurrentYearMonth(yearMonth); }}
        />
      </div>
      {loading && <p className="text-[12px] text-grey-500 mt-2">불러오는 중...</p>}
      {!loading && selectedDateKey && (
        <div className="mt-3 border-t border-grey-200 pt-3" data-testid="consult-day-timeline">
          <p className="text-[12px] font-bold text-ink mb-1">{selectedDateKey}</p>

          <div className="text-[11px] font-bold text-grey-500 mb-1">실제 예약 가능 슬롯</div>
          {selectedDaySlots.length === 0 ? (
            <p className="text-[12px] text-grey-500 mb-2">이 날짜는 열린 슬롯이 없습니다(휴무 또는 반복 가능시간 없음).</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedDaySlots.map((s) => (
                <span key={s.startsAt} className="text-[11.5px] text-ink border border-grey-200 rounded px-2 py-1">
                  {formatTimeLabel(s.startsAt, timezone)}
                </span>
              ))}
            </div>
          )}

          <div className="text-[11px] font-bold text-grey-500 mb-1 mt-2">이 날짜의 오픈 시간대(반복+예외 반영)</div>
          {openWindowsForSelectedDate.length === 0 ? (
            <p className="text-[12px] text-grey-500 mb-2">열린 시간대가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {openWindowsForSelectedDate.map((w) => (
                <span key={`${w.startTimeLocal}-${w.endTimeLocal}`} className="text-[11.5px] text-ink border border-grey-200 rounded px-2 py-1">
                  {w.startTimeLocal}~{w.endTimeLocal}
                </span>
              ))}
            </div>
          )}

          {partialExceptionsForSelectedDate.length > 0 && (
            <div className="mb-2">
              {partialExceptionsForSelectedDate.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between text-[12px] py-1">
                  <span className="text-grey-500">
                    {ex.is_closed ? "부분 휴무" : "부분 임시 오픈"}: {ex.start_time}~{ex.end_time}
                    {ex.reason && ` (${ex.reason})`}
                  </span>
                  <button
                    disabled={busyId === ex.id}
                    onClick={() => onRemoveException(ex.id)}
                    className="text-[12px] font-bold text-red disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}

          {fullDayException ? (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                {fullDayException.is_closed ? "휴무(종일)" : "임시 오픈(종일)"}
              </span>
              <button
                disabled={busyId === fullDayException.id}
                onClick={() => onRemoveException(fullDayException.id)}
                className="text-[12px] font-bold text-red disabled:opacity-50"
              >
                이 예외 삭제
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-2">
              <button
                disabled={busyId === "__consult_exception_full"}
                onClick={() => onAddFullDayException({ date: selectedDateKey, isClosed: true })}
                className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                이 날짜 전체 휴무로
              </button>
            </div>
          )}

          <div className="border-t border-grey-200 pt-2 mt-2">
            <div className="text-[10px] font-bold text-grey-500 mb-1">부분 시간대만 조정</div>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[10px] text-grey-500 mb-1">시작</label>
                <input
                  type="time"
                  className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
                  value={partialStart}
                  onChange={(e) => setPartialStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-grey-500 mb-1">종료</label>
                <input
                  type="time"
                  className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
                  value={partialEnd}
                  onChange={(e) => setPartialEnd(e.target.value)}
                />
              </div>
              <button
                disabled={busyId === "__consult_exception_partial" || partialEnd <= partialStart}
                onClick={() =>
                  onAddPartialException({ date: selectedDateKey, isClosed: true, startTime: partialStart, endTime: partialEnd })
                }
                className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                이 시간대만 휴무로
              </button>
              <button
                disabled={busyId === "__consult_exception_partial" || partialEnd <= partialStart}
                onClick={() =>
                  onAddPartialException({ date: selectedDateKey, isClosed: false, startTime: partialStart, endTime: partialEnd })
                }
                className="text-[12px] font-bold border-[1.5px] border-ink text-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                이 시간대만 임시 오픈으로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
