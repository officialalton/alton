"use client";

import { useState } from "react";
import { buildMonthGrid, todayKeyInTimezone } from "@/lib/calendar-date-utils";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export type DayBadge = { count: number; tone?: "ink" | "grey" | "red" };

export type MonthCalendarProps = {
  timezone: string;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
  /** 날짜 셀에 표시할 배지(예: 그날 예약 건수) — 없으면 배지 없이 셀만 클릭 가능. */
  badgesByDate?: Record<string, DayBadge>;
  /** Google 외부 바쁨 블록이 있는 날짜 — 밑줄로만 표시(제목·내용 없음). */
  externalBusyDates?: Set<string>;
  /** 초기에 보여줄 연/월(YYYY-MM) — 없으면 오늘 기준. */
  initialYearMonth?: string;
};

export default function MonthCalendar({
  timezone,
  selectedDateKey,
  onSelectDate,
  badgesByDate,
  externalBusyDates,
  initialYearMonth,
}: MonthCalendarProps) {
  const todayKey = todayKeyInTimezone(timezone);
  const [y0, m0] = (initialYearMonth ?? todayKey.slice(0, 7)).split("-").map(Number);
  const [year, setYear] = useState(y0);
  const [month, setMonth] = useState(m0 - 1);

  const grid = buildMonthGrid(year, month);

  function goPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function goNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={goPrevMonth} className="text-[13px] font-bold text-grey-500 px-2 py-1" aria-label="이전 달">
          ‹
        </button>
        <div className="text-[13px] font-bold text-ink">
          {year}년 {month + 1}월
        </div>
        <button onClick={goNextMonth} className="text-[13px] font-bold text-grey-500 px-2 py-1" aria-label="다음 달">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-grey-500 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const badge = badgesByDate?.[cell.dateKey];
          const hasExternalBusy = externalBusyDates?.has(cell.dateKey) ?? false;
          const isSelected = cell.dateKey === selectedDateKey;
          const isToday = cell.dateKey === todayKey;
          return (
            <button
              key={cell.dateKey}
              onClick={() => onSelectDate(cell.dateKey)}
              title={hasExternalBusy ? "외부 일정 있음(예약 불가)" : undefined}
              className={
                "aspect-square rounded-lg text-[12px] flex flex-col items-center justify-center gap-0.5 " +
                (isSelected
                  ? "bg-ink text-white font-bold"
                  : isToday
                    ? "bg-grey-100 text-ink font-bold"
                    : cell.inCurrentMonth
                      ? "text-ink hover:bg-grey-100"
                      : "text-grey-200") +
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
    </div>
  );
}
