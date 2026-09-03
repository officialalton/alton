"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeacherAvailabilityRuleRow, AvailabilityExceptionRow } from "./availability-actions";
import type { ExternalBusyBlock } from "./lesson-schedule-actions";
import MonthCalendar, { type DayBadge } from "@/app/components/MonthCalendar";
import { todayKeyInTimezone, dateKeysCoveredByInterval } from "@/lib/calendar-date-utils";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export type TeacherAvailabilityTabProps = {
  initialRules: TeacherAvailabilityRuleRow[];
  initialExceptions: AvailabilityExceptionRow[];
  timezone: string;
  onAddRule: (input: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string; timezone: string; effectiveFrom: string }) => Promise<string>;
  onRemoveRule: (ruleId: string) => Promise<void>;
  onAddException: (input: { exceptionDate: string; kind: "blocked" | "available"; timezone: string; reason?: string }) => Promise<string>;
  onRemoveException: (exceptionId: string) => Promise<void>;
  onLoadExternalBusy: (params: { rangeStart: string; rangeEnd: string }) => Promise<ExternalBusyBlock[]>;
};

function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function shiftMonthKey(dateKey: string, monthDelta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + monthDelta, d));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export default function TeacherAvailabilityTab({
  initialRules,
  initialExceptions,
  timezone,
  onAddRule,
  onRemoveRule,
  onAddException,
  onRemoveException,
  onLoadExternalBusy,
}: TeacherAvailabilityTabProps) {
  const [rules, setRules] = useState(initialRules);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTimeLocal, setStartTimeLocal] = useState("09:00");
  const [endTimeLocal, setEndTimeLocal] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [externalBusyBlocks, setExternalBusyBlocks] = useState<ExternalBusyBlock[]>([]);

  const todayKey = todayKeyInTimezone(timezone);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [rangeEndDateKey, setRangeEndDateKey] = useState<string>(todayKey);
  const [calendarMonthKey, setCalendarMonthKey] = useState<string>(todayKey);

  useEffect(() => {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 35);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 65);
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

  const exceptionsByDate = useMemo(() => {
    const map = new Map<string, AvailabilityExceptionRow>();
    for (const ex of exceptions) map.set(ex.exceptionDate, ex);
    return map;
  }, [exceptions]);

  const badgesByDate = useMemo(() => {
    const badges: Record<string, DayBadge> = {};
    for (const ex of exceptions) {
      badges[ex.exceptionDate] = { count: 1, tone: ex.kind === "blocked" ? "red" : "grey" };
    }
    return badges;
  }, [exceptions]);

  const selectedException = exceptionsByDate.get(selectedDateKey) ?? null;
  const hasExternalBusyOnSelectedDate = externalBusyDateKeys.has(selectedDateKey);

  async function handleAddRule() {
    setSubmitting(true);
    setError(null);
    try {
      const id = await onAddRule({
        dayOfWeek,
        startTimeLocal,
        endTimeLocal,
        timezone,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
      setRules((prev) => [...prev, { id, dayOfWeek, startTimeLocal, endTimeLocal, timezone, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveUntil: null }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveRule(ruleId: string) {
    setSubmitting(true);
    setError(null);
    try {
      await onRemoveRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function addExceptionForDate(dateKey: string, kind: "blocked" | "available"): Promise<void> {
    const id = await onAddException({ exceptionDate: dateKey, kind, timezone });
    setExceptions((prev) => [...prev.filter((e) => e.exceptionDate !== dateKey), { id, exceptionDate: dateKey, kind, reason: null }]);
  }

  async function handleAddExceptionForSelectedDate(kind: "blocked" | "available") {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await addExceptionForDate(selectedDateKey, kind);
      setMessage(`${selectedDateKey} ${kind === "blocked" ? "휴무" : "임시 오픈"} 등록됐습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveExceptionForSelectedDate() {
    if (!selectedException) return;
    setSubmitting(true);
    setError(null);
    try {
      await onRemoveException(selectedException.id);
      setExceptions((prev) => prev.filter((e) => e.id !== selectedException.id));
      setMessage(`${selectedDateKey} 예외가 삭제됐습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddRangeBlocked() {
    if (rangeEndDateKey < selectedDateKey) {
      setError("종료일은 시작일 이후여야 합니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      let cursor = selectedDateKey;
      let count = 0;
      while (cursor <= rangeEndDateKey && count < 60) {
        await addExceptionForDate(cursor, "blocked");
        cursor = addDaysToKey(cursor, 1);
        count += 1;
      }
      setMessage(`${selectedDateKey}~${rangeEndDateKey} 기간 휴무 ${count}일 등록됐습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPreviousMonth() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const prevMonthExceptions = exceptions.filter((e) => e.exceptionDate.slice(0, 7) === shiftMonthKey(calendarMonthKey, -1).slice(0, 7));
      let count = 0;
      for (const ex of prevMonthExceptions) {
        const shiftedKey = shiftMonthKey(ex.exceptionDate, 1);
        if (!exceptionsByDate.has(shiftedKey)) {
          await addExceptionForDate(shiftedKey, ex.kind);
          count += 1;
        }
      }
      setMessage(count > 0 ? `지난달 예외 ${count}건을 이번 달로 복사했습니다.` : "지난달에 복사할 예외가 없습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">가능시간 관리</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        반복 가능 시간(주간 템플릿)을 기본으로 두고, 달력에서 날짜를 선택해 특정 날짜만 휴무·임시 오픈으로 덮어쓸 수
        있습니다({timezone} 기준). 이미 확정된 수업이 있는 시간은 예외를 등록해도 취소되지 않습니다 — 취소는
        "정규수업" 탭에서 별도로 처리하세요.
      </p>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      {message && <div className="mb-4 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{message}</div>}

      <h2 className="text-[15px] font-bold text-ink mb-2.5">반복 가능 시간(주간 템플릿)</h2>
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">요일</label>
            <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>{label}요일</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">시작</label>
            <input type="time" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={startTimeLocal} onChange={(e) => setStartTimeLocal(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">종료</label>
            <input type="time" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={endTimeLocal} onChange={(e) => setEndTimeLocal(e.target.value)} />
          </div>
          <button disabled={submitting} onClick={handleAddRule} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
            추가
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">등록된 반복 가능 시간이 없습니다.</div>
      ) : (
        <div className="mb-8">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-grey-200 py-2.5 text-[13px]">
              <span>
                {DAY_LABELS[r.dayOfWeek]}요일 {r.startTimeLocal}~{r.endTimeLocal}
              </span>
              <button disabled={submitting} onClick={() => handleRemoveRule(r.id)} className="text-[12px] font-bold text-red disabled:opacity-50">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-[15px] font-bold text-ink mb-2.5">날짜별 예외(월간 달력)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,280px)_1fr] gap-4 mb-4">
        <div className="border-[1.5px] border-grey-200 rounded-xl p-3">
          <MonthCalendar
            timezone={timezone}
            selectedDateKey={selectedDateKey}
            onSelectDate={(k) => {
              setSelectedDateKey(k);
              setRangeEndDateKey(k);
              setCalendarMonthKey(k);
            }}
            badgesByDate={badgesByDate}
            externalBusyDates={externalBusyDateKeys}
            initialYearMonth={calendarMonthKey.slice(0, 7)}
          />
        </div>
        <div>
          <div className="text-[13px] font-bold text-ink mb-2">{selectedDateKey}</div>
          {hasExternalBusyOnSelectedDate && (
            <div className="mb-2 text-[12px] font-semibold px-2 py-1 rounded-full bg-grey-100 text-grey-500 inline-block">
              외부 일정 있음(예약 불가)
            </div>
          )}
          {selectedException ? (
            <div className="mb-3">
              <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-grey-100 text-grey-500 mr-2">
                {selectedException.kind === "blocked" ? "휴무(종일)" : "임시 오픈(종일)"}
              </span>
              <button disabled={submitting} onClick={handleRemoveExceptionForSelectedDate} className="text-[12px] font-bold text-red disabled:opacity-50">
                이 예외 삭제
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-3">
              <button
                disabled={submitting}
                onClick={() => handleAddExceptionForSelectedDate("blocked")}
                className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                이 날짜 휴무로
              </button>
              <button
                disabled={submitting}
                onClick={() => handleAddExceptionForSelectedDate("available")}
                className="text-[12px] font-bold border-[1.5px] border-ink text-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                이 날짜 임시 오픈으로
              </button>
            </div>
          )}

          <div className="border-t border-grey-200 pt-3 mb-3">
            <div className="text-[11px] font-bold text-grey-500 mb-1">기간 휴무(월 단위 일괄)</div>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[10px] text-grey-500 mb-1">종료일</label>
                <input
                  type="date"
                  className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
                  value={rangeEndDateKey}
                  min={selectedDateKey}
                  onChange={(e) => setRangeEndDateKey(e.target.value)}
                />
              </div>
              <button disabled={submitting} onClick={handleAddRangeBlocked} className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                {selectedDateKey}~{rangeEndDateKey} 전체 휴무 등록
              </button>
            </div>
          </div>

          <button disabled={submitting} onClick={handleCopyPreviousMonth} className="text-[12px] font-bold text-ink underline disabled:opacity-50">
            지난달 예외 이번 달로 복사
          </button>
        </div>
      </div>
    </div>
  );
}
