"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import MonthCalendar from "./MonthCalendar";
import { dateKeyInTimezone } from "@/lib/calendar-date-utils";
import { timezoneLabel } from "@/lib/timezone";

// 2026-09-06 — 랜딩 상담 신청과(향후) 보호자 포털 "자녀 추가 상담" 화면이 공유하는
// 상담 전용 일정 선택 UI. 드롭다운 대신 "월간 캘린더 → 날짜 선택 → 그 날짜의 60분
// 시간 버튼 목록 → 선택 확인" 흐름을 강제한다(요구사항: 월간 캘린더+버튼, 드롭다운 금지).
//
// 데이터·가용시간은 이 컴포넌트 자체가 알지 못한다 — 호출부가 넘겨주는 fetchSlots만이
// 유일한 원본이다(랜딩은 listOpenHomepageConsultSlots를 그대로 넘긴다, 관리자 화면이
// 보는 것과 동일한 list_open_consult_slots() RPC). 수업 예약(reservations)이나 R11
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
  /** 상담 전용 가용시간 원본 조회 함수(단일 원본) — 예: listOpenHomepageConsultSlots. */
  fetchSlots: (fromIso: string, toIso: string) => Promise<ConsultSlot[]>;
  selectedStartsAt: string | null;
  onSelect: (startsAtIso: string) => void;
  /** 오늘부터 며칠치 슬롯을 조회할지(기본 21일). */
  rangeDays?: number;
  /** 표시 timezone(기본: 브라우저 감지). 서버는 항상 UTC 고정 슬롯을 반환하고
   * 여기서는 표시만 변환한다 — 슬롯을 중복 생성하지 않는다. */
  timezone?: string;
};

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function displayTimezoneLabel(tz: string): string {
  const known = timezoneLabel(tz);
  return known === tz ? tz : known;
}

const ConsultSlotPicker = forwardRef<ConsultSlotPickerHandle, ConsultSlotPickerProps>(function ConsultSlotPicker(
  { fetchSlots, selectedStartsAt, onSelect, rangeDays = 21, timezone },
  ref
) {
  const tz = timezone ?? detectBrowserTimezone();
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
      .catch((e) => setError(e instanceof Error ? e.message : "가능한 시간을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [fetchSlots, rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

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
    return <p className="text-[13px] text-grey-500" role="status">가능한 시간을 불러오는 중...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-[13px] text-red mb-2">{error}</p>
        <button
          type="button"
          onClick={load}
          className="text-[12.5px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11.5px] text-grey-500 mb-2">
        표시된 시간은 {displayTimezoneLabel(tz)} 기준입니다.
      </p>
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
            <p className="text-[13px] text-grey-500">캘린더에서 날짜를 먼저 선택해주세요.</p>
          ) : slotsForSelectedDate.length === 0 ? (
            <p className="text-[13px] text-grey-500">선택하신 날짜에는 신청 가능한 시간이 없습니다. 다른 날짜를 선택해주세요.</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="상담 희망 시간 선택">
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
                    {new Intl.DateTimeFormat("ko-KR", {
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
          선택됨:{" "}
          {new Intl.DateTimeFormat("ko-KR", {
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
