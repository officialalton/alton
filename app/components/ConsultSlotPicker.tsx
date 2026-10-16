"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import MonthCalendar from "./MonthCalendar";
import { dateKeyInTimezone } from "@/lib/calendar-date-utils";
import { TIMEZONE_OPTIONS, timezoneLabel } from "@/lib/timezone";
import { useViewerTimezone } from "./ViewerTimezoneProvider";

// 2026-09-06 — 랜딩 상담 신청과(향후) 보호자 포털 "자녀 추가 상담" 화면이 공유하는
// 상담 전용 일정 선택 UI. 드롭다운 대신 "월간 캘린더 → 날짜 선택 → 그 날짜의 60분
// 시간 버튼 목록 → 선택 확인" 흐름을 강제한다(요구사항: 월간 캘린더+버튼, 드롭다운 금지).
//
// 데이터·가용시간은 이 컴포넌트 자체가 알지 못한다 — 호출부가 넘겨주는 fetchSlots만이
// 유일한 원본이다(2026-09-29 이후 공용 슬롯은 없다 — 스케줄링 링크·보호자·학생 화면 모두
// 배정된 컨설턴트 개인 가능시간 조회 함수를 넘긴다). 수업 예약(reservations)이나 R11
// 면담 가용시간과는 절대 섞지 않는다 — 그쪽은 별도의 fetchSlots 구현을 넘기면 되므로
// 이 컴포넌트는 UI/UX만 공유하고 데이터 원본은 강제하지 않는다.
//
// 제출 권한 구분(비로그인 prospect vs 인증된 guardian)은 이 컴포넌트의 책임이 아니다 —
// 호출부가 각자의 서버 액션을 fetchSlots/onSelect로 주입한다.

export type ConsultSlot = { startsAt: string };

export type ConsultSlotPickerHandle = {
  /** 제출 직전 슬롯 충돌(배타 제약 위반)이 감지됐을 때 호출부가 재조회를 유도한다. */
  refetch: () => void;
};

export type ConsultSlotPickerProps = {
  /** 상담 전용 가용시간 원본 조회 함수(단일 원본) — 예: 배정된 컨설턴트 슬롯 조회(listOpenSlotsForConsultantAction 등). */
  fetchSlots: (fromIso: string, toIso: string) => Promise<ConsultSlot[]>;
  selectedStartsAt: string | null;
  onSelect: (startsAtIso: string) => void;
  /** 오늘부터 며칠치 슬롯을 조회할지(기본 21일). */
  rangeDays?: number;
  /** 표시 timezone 초기값(기본: 뷰어 시간대 — 로그인 화면은 profiles.timezone). 서버는 항상 UTC 고정 슬롯을
   * 반환하고 여기서는 표시만 변환한다 — 슬롯을 중복 생성하지 않는다. prop 이 바뀌면 그 값을 따른다. */
  timezone?: string;
  /** 사용자가 위쪽 선택기에서 시간대를 바꿨을 때(저장 여부는 호출부 몫 — 기본은 화면 표시만 바뀐다). */
  onTimezoneChange?: (timezone: string) => void;
};

function displayTimezoneLabel(tz: string): string {
  const known = timezoneLabel(tz);
  return known === tz ? tz : known;
}

const ConsultSlotPicker = forwardRef<ConsultSlotPickerHandle, ConsultSlotPickerProps>(function ConsultSlotPicker(
  { fetchSlots, selectedStartsAt, onSelect, rangeDays = 21, timezone, onTimezoneChange },
  ref
) {
  const viewerTz = useViewerTimezone();
  const [tzState, setTzState] = useState(timezone ?? viewerTz);
  useEffect(() => {
    if (timezone) setTzState(timezone);
  }, [timezone]);
  const tz = tzState;
  function changeTimezone(next: string) {
    setTzState(next);
    onTimezoneChange?.(next);
  }
  const tzSelector = (
    <label className="block mb-3">
      <span className="block text-[12px] font-bold text-grey-500 mb-1">Display timezone: {displayTimezoneLabel(tz)}</span>
      <select
        aria-label="Display timezone"
        value={tz}
        onChange={(e) => changeTimezone(e.target.value)}
        className="w-full rounded-lg border-[1.5px] border-grey-200 bg-white px-3 py-2 text-[13px] text-ink"
      >
        {!TIMEZONE_OPTIONS.some((o) => o.value === tz) && <option value={tz}>{tz}</option>}
        {TIMEZONE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const [slots, setSlots] = useState<ConsultSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const from = new Date();
    const to = new Date(from.getTime() + rangeDays * 24 * 60 * 60 * 1000);
    fetchSlots(from.toISOString(), to.toISOString())
      .then((rows) => setSlots(rows))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load available times."))
      .finally(() => setLoading(false));
  }, [fetchSlots, rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

  // 시간대가 바뀌면 선택한 날짜 키(옛 시간대 기준)가 무효가 된다.
  useEffect(() => {
    setSelectedDateKey(null);
  }, [tz]);

  useImperativeHandle(ref, () => ({ refetch: load }), [load]);

  const badgesByDate = useMemo(() => {
    const acc: Record<string, { count: number }> = {};
    for (const s of slots) {
      const key = dateKeyInTimezone(s.startsAt, tz);
      acc[key] = { count: (acc[key]?.count ?? 0) + 1 };
    }
    return acc;
  }, [slots, tz]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return slots
      .filter((s) => dateKeyInTimezone(s.startsAt, tz) === selectedDateKey)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [slots, selectedDateKey, tz]);

  function handleSelectDate(dateKey: string) {
    setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey));
  }

  if (loading) {
    return (
      <div>
        {tzSelector}
        <p className="text-[13px] text-grey-500" role="status">Loading available times...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {tzSelector}
        <p className="text-[13px] text-red mb-2">{error}</p>
        <button
          type="button"
          onClick={load}
          className="text-[12.5px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {tzSelector}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="consult-slot-picker">
        <div data-testid="consult-slot-calendar">
          <MonthCalendar
            timezone={tz}
            selectedDateKey={selectedDateKey}
            onSelectDate={handleSelectDate}
            badgesByDate={badgesByDate}
          />
        </div>
        <div data-testid="consult-slot-times">
          {!selectedDateKey ? (
            <p className="text-[13px] text-grey-500">Select a date on the calendar first.</p>
          ) : slotsForSelectedDate.length === 0 ? (
            <p className="text-[13px] text-grey-500">No times are available on that date. Please pick another date.</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a consultation time">
              {slotsForSelectedDate.map((s) => {
                const isSelected = s.startsAt === selectedStartsAt;
                return (
                  <button
                    key={s.startsAt}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(s.startsAt)}
                    className={
                      "px-3.5 py-2 rounded-lg text-[13px] font-bold border-[1.5px] " +
                      (isSelected ? "bg-ink text-white border-ink" : "border-grey-200 text-ink hover:bg-grey-100")
                    }
                  >
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: tz,
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }).format(new Date(s.startsAt))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedStartsAt && (
        <p className="text-[13px] font-bold text-ink mt-3" data-testid="consult-slot-confirmation">
          Selected:{" "}
          {new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(selectedStartsAt))}{" "}
          ({displayTimezoneLabel(tz)})
        </p>
      )}
    </div>
  );
});

export default ConsultSlotPicker;
