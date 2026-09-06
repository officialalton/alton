"use client";

// 2026-09-06 — 관리자 상담 가용시간 화면에 월간 뷰 추가. "반복 주간 가능시간"과
// "날짜별 예외"를 각각 따로 보는 대신, 그 둘(+제외 기간)이 실제로 어떤 날짜에
// 어떤 슬롯을 여는지 한 번에 보고 싶다는 요구사항. 관리자가 직접 반복 규칙 +
// 예외를 머릿속으로 계산할 필요 없이, 이미 그 계산을 전부 해주는 기존
// list_open_consult_slots() RPC(랜딩·보호자 포털과 동일한 단일 원본,
// listOpenHomepageConsultSlots() 서버 액션 재사용)를 월 단위로 그대로 조회한다.
// 수업 예약(reservations)/R11 면담 가용시간과는 절대 섞지 않는다(같은 이유로
// 별도 RPC를 새로 만들지 않고 기존 것만 재사용).

import { useEffect, useState } from "react";
import MonthCalendar from "@/app/components/MonthCalendar";
import { listOpenHomepageConsultSlots } from "@/app/consult-actions";
import { dateKeyInTimezone } from "@/lib/calendar-date-utils";

function formatTimeLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
}

function monthRangeIso(yearMonth: string): { fromIso: string; toIso: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export default function ConsultAvailabilityMonthView({
  timezone,
  initialYearMonth,
}: {
  timezone: string;
  /** 테스트/딥링크용 — 없으면 오늘 기준 달. */
  initialYearMonth?: string;
}) {
  const [slots, setSlots] = useState<{ startsAt: string }[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const badgesByDate = slots.reduce<Record<string, { count: number }>>((acc, s) => {
    const key = dateKeyInTimezone(s.startsAt, timezone);
    acc[key] = { count: (acc[key]?.count ?? 0) + 1 };
    return acc;
  }, {});

  const selectedDaySlots = selectedDateKey
    ? slots.filter((s) => dateKeyInTimezone(s.startsAt, timezone) === selectedDateKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    : [];

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="consult-availability-month-view">
      <p className="text-[12.5px] font-bold text-ink mb-1">월간 실제 오픈 슬롯</p>
      <p className="text-[11px] text-grey-500 mb-2">
        반복 가능시간 + 날짜별 예외가 실제로 계산된 결과입니다(아래 두 목록과 데이터 원본 동일).
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      <MonthCalendar
        timezone={timezone}
        selectedDateKey={selectedDateKey}
        onSelectDate={(dateKey) => setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))}
        badgesByDate={badgesByDate}
        initialYearMonth={initialYearMonth}
        onMonthChange={(yearMonth) => { loadMonth(yearMonth); }}
      />
      {loading && <p className="text-[12px] text-grey-500 mt-2">불러오는 중...</p>}
      {!loading && selectedDateKey && (
        <div className="mt-3 border-t border-grey-200 pt-2">
          <p className="text-[12px] font-bold text-ink mb-1">{selectedDateKey}</p>
          {selectedDaySlots.length === 0 ? (
            <p className="text-[12px] text-grey-500">이 날짜는 열린 슬롯이 없습니다(휴무 또는 반복 가능시간 없음).</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedDaySlots.map((s) => (
                <span key={s.startsAt} className="text-[11.5px] text-ink border border-grey-200 rounded px-2 py-1">
                  {formatTimeLabel(s.startsAt, timezone)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
