"use client";

import { TEACHER_TIMEZONE_REQUIRED_MESSAGE } from "@/lib/teacher-timezone";
import { useEffect, useMemo, useState } from "react";
import type { TeacherAvailabilityRuleRow, AvailabilityExceptionRow } from "./availability-actions";
import type { ExternalBusyBlock } from "./lesson-schedule-actions";
import MonthCalendar, { type DayBadge } from "@/app/components/MonthCalendar";
import WeeklyAvailabilityGrid from "@/app/components/WeeklyAvailabilityGrid";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { todayKeyInTimezone, dateKeysCoveredByInterval, dayOfWeekForDateKey, buildMonthGrid } from "@/lib/calendar-date-utils";
import { computeOpenWindowsForDate, type AvailabilityException } from "@/lib/booking/slot-search";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type TeacherAvailabilityTabProps = {
  initialRules: TeacherAvailabilityRuleRow[];
  initialExceptions: AvailabilityExceptionRow[];
  timezone: string;
  /** false 면(저장된 시간대 없음) 규칙·휴무 저장을 막고 안내한다. 기본 true. */
  timezoneSaved?: boolean;
  onOpenTimezoneSettings?: () => void;
  onAddRule: (input: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string; timezone: string; effectiveFrom: string }) => Promise<string>;
  onRemoveRule: (ruleId: string) => Promise<void>;
  onAddException: (input: {
    exceptionDate: string;
    kind: "blocked" | "available";
    timezone: string;
    reason?: string;
    startTimeLocal?: string | null;
    endTimeLocal?: string | null;
  }) => Promise<string>;
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
  timezoneSaved = true,
  onOpenTimezoneSettings,
  onAddRule: onAddRuleProp,
  onRemoveRule,
  onAddException: onAddExceptionProp,
  onRemoveException,
  onLoadExternalBusy,
}: TeacherAvailabilityTabProps) {
  // 시간대가 저장돼 있지 않으면 서버 호출 전에 막는다(서버 액션도 같은 검사를 다시 한다).
  const onAddRule: typeof onAddRuleProp = async (input) => {
    if (!timezoneSaved) throw new Error(TEACHER_TIMEZONE_REQUIRED_MESSAGE);
    return onAddRuleProp(input);
  };
  const onAddException: typeof onAddExceptionProp = async (input) => {
    if (!timezoneSaved) throw new Error(TEACHER_TIMEZONE_REQUIRED_MESSAGE);
    return onAddExceptionProp(input);
  };
  const [rules, setRules] = useState(initialRules);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTimeLocal, setStartTimeLocal] = useState("09:00");
  const [endTimeLocal, setEndTimeLocal] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rulesView, setRulesView] = useState<"grid" | "list">("grid");
  // 2026-09-22(사용자 지시) — 설명 문단을 없애고, "반복 일정 등록"/"휴무 일정
  // 등록" 서브탭 두 개로 나눈다.
  const [subtab, setSubtab] = useState<"recurring" | "exception">("recurring");
  const [partialStartTimeLocal, setPartialStartTimeLocal] = useState("13:00");
  const [partialEndTimeLocal, setPartialEndTimeLocal] = useState("14:00");
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

  // 2026-09-06 — 이제 한 날짜에 예외가 여러 개(종일 1개 + 부분 시간 여러 개) 있을 수
  // 있으므로 date -> 배열로 그룹핑한다.
  const exceptionsByDate = useMemo(() => {
    const map = new Map<string, AvailabilityExceptionRow[]>();
    for (const ex of exceptions) {
      const list = map.get(ex.exceptionDate) ?? [];
      list.push(ex);
      map.set(ex.exceptionDate, list);
    }
    return map;
  }, [exceptions]);

  const exceptionsForSelectedDate = useMemo(
    () => exceptionsByDate.get(selectedDateKey) ?? [],
    [exceptionsByDate, selectedDateKey]
  );
  const selectedException = exceptionsForSelectedDate.find((e) => !e.startTimeLocal) ?? null;
  const partialExceptionsForSelectedDate = exceptionsForSelectedDate.filter((e) => e.startTimeLocal);
  const hasExternalBusyOnSelectedDate = externalBusyDateKeys.has(selectedDateKey);

  // 반복 규칙 + 예외를 실제로 반영한 "이 날짜의 최종 오픈 시간" — 순수 클라이언트
  // 계산(computeOpenWindowsForDate, lib/booking/slot-search.ts)이라 서버 재조회가
  // 필요 없다. 학생 예약 화면이 쓰는 계산(computeAvailableSlots)과 같은 예외 규칙을
  // 공유하되, 이 화면은 예약 후보 슬롯이 아니라 "몇시~몇시가 열려 있는지" 구간만 본다.
  const openWindowsForSelectedDate = useMemo(() => {
    const dow = dayOfWeekForDateKey(selectedDateKey);
    const exForDate: AvailabilityException[] = exceptionsForSelectedDate.map((e) => ({
      date: selectedDateKey,
      kind: e.kind,
      startTimeLocal: e.startTimeLocal ?? null,
      endTimeLocal: e.endTimeLocal ?? null,
      timezone,
    }));
    return computeOpenWindowsForDate(
      selectedDateKey,
      dow,
      rules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTimeLocal: r.startTimeLocal,
        endTimeLocal: r.endTimeLocal,
        timezone: r.timezone,
        effectiveFrom: r.effectiveFrom,
        effectiveUntil: r.effectiveUntil,
      })),
      exForDate
    );
     
  }, [selectedDateKey, exceptionsForSelectedDate, rules, timezone]);

  // 월간 캘린더 배지 — 예외가 있는 날짜는 기존처럼 빨강(휴무)/회색(조정됨) 배지를,
  // 예외가 없지만 반복 규칙으로 열려 있는 날짜는 초록 배지를 보여준다(제품 오너
  // 요구사항: "반복으로 오픈된 특정 일자도 캘린더에 표현되어야 한다").
  const badgesByDate = useMemo(() => {
    const badges: Record<string, DayBadge> = {};
    const [y, m] = calendarMonthKey.split("-").map(Number);
    const grid = buildMonthGrid(y, m - 1);
    for (const cell of grid) {
      const dateExceptions = exceptionsByDate.get(cell.dateKey) ?? [];
      const dow = dayOfWeekForDateKey(cell.dateKey);
      const exForDate: AvailabilityException[] = dateExceptions.map((e) => ({
        date: cell.dateKey,
        kind: e.kind,
        startTimeLocal: e.startTimeLocal ?? null,
        endTimeLocal: e.endTimeLocal ?? null,
        timezone,
      }));
      const windows = computeOpenWindowsForDate(
        cell.dateKey,
        dow,
        rules.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startTimeLocal: r.startTimeLocal,
          endTimeLocal: r.endTimeLocal,
          timezone: r.timezone,
          effectiveFrom: r.effectiveFrom,
          effectiveUntil: r.effectiveUntil,
        })),
        exForDate
      );
      if (dateExceptions.length > 0) {
        badges[cell.dateKey] = { count: dateExceptions.length, tone: windows.length === 0 ? "red" : "grey" };
      } else if (windows.length > 0) {
        badges[cell.dateKey] = { count: windows.length, tone: "green" };
      }
    }
    return badges;
  }, [exceptionsByDate, calendarMonthKey, rules, timezone]);

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

  // 종일 예외(startTimeLocal 없음)를 등록할 땐 같은 날짜의 기존 종일 예외만 대체하고,
  // 부분 시간 예외들은 그대로 둔다. 부분 시간 예외는 항상 추가(같은 날짜에 여러 개 가능).
  async function addExceptionForDate(
    dateKey: string,
    kind: "blocked" | "available",
    partial?: { startTimeLocal: string; endTimeLocal: string }
  ): Promise<void> {
    const id = await onAddException({
      exceptionDate: dateKey,
      kind,
      timezone,
      startTimeLocal: partial?.startTimeLocal ?? null,
      endTimeLocal: partial?.endTimeLocal ?? null,
    });
    setExceptions((prev) => {
      const filtered = partial ? prev : prev.filter((e) => !(e.exceptionDate === dateKey && !e.startTimeLocal));
      return [
        ...filtered,
        {
          id,
          exceptionDate: dateKey,
          kind,
          reason: null,
          startTimeLocal: partial?.startTimeLocal ?? null,
          endTimeLocal: partial?.endTimeLocal ?? null,
        },
      ];
    });
  }

  async function handleAddPartialException(kind: "blocked" | "available") {
    if (partialEndTimeLocal <= partialStartTimeLocal) {
      setError("End time must be after start time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await addExceptionForDate(selectedDateKey, kind, {
        startTimeLocal: partialStartTimeLocal,
        endTimeLocal: partialEndTimeLocal,
      });
      setMessage(
        `${selectedDateKey} ${partialStartTimeLocal}–${partialEndTimeLocal} ${kind === "blocked" ? "time off" : "extra availability"} (partial) saved.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemovePartialException(exceptionId: string) {
    setSubmitting(true);
    setError(null);
    try {
      await onRemoveException(exceptionId);
      setExceptions((prev) => prev.filter((e) => e.id !== exceptionId));
      setMessage("Partial-time exception deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddExceptionForSelectedDate(kind: "blocked" | "available") {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await addExceptionForDate(selectedDateKey, kind);
      setMessage(`${selectedDateKey} ${kind === "blocked" ? "time off" : "extra availability"} saved.`);
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
      setMessage(`Exception on ${selectedDateKey} deleted.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddRangeBlocked() {
    if (rangeEndDateKey < selectedDateKey) {
      setError("End date must be on or after the start date.");
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
      setMessage(`Time off saved for ${count} day(s), ${selectedDateKey} to ${rangeEndDateKey}.`);
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
      setMessage(count > 0 ? `Copied ${count} exception(s) from last month.` : "No exceptions from last month to copy.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px]">
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "recurring", label: "Recurring Hours" },
          { id: "exception", label: "Time Off" },
        ]}
        activeId={subtab}
        onSelect={setSubtab}
      />

      {!timezoneSaved && (
        <div role="alert" data-testid="availability-timezone-required" className="mb-4 rounded-lg bg-red/5 px-4 py-3 text-[13px] font-semibold text-red">
          {TEACHER_TIMEZONE_REQUIRED_MESSAGE}
          {onOpenTimezoneSettings && (
            <button type="button" onClick={onOpenTimezoneSettings} className="ml-2 underline">
              Set time zone
            </button>
          )}
        </div>
      )}
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      {message && <div className="mb-4 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{message}</div>}

      {subtab === "recurring" && (
      <>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[15px] font-bold text-ink">Recurring availability (weekly template)</h2>
        <div className="flex gap-1">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setRulesView(v)}
              className={
                "text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " +
                (rulesView === v ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
              }
            >
              {v === "grid" ? "Week grid" : "List"}
            </button>
          ))}
        </div>
      </div>
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">Day</label>
            <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">Start</label>
            <input type="time" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={startTimeLocal} onChange={(e) => setStartTimeLocal(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">End</label>
            <input type="time" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={endTimeLocal} onChange={(e) => setEndTimeLocal(e.target.value)} />
          </div>
          <button disabled={submitting} onClick={handleAddRule} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
            Add
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">No recurring availability yet.</div>
      ) : rulesView === "grid" ? (
        <div className="mb-8">
          <WeeklyAvailabilityGrid
            rules={rules.map((r) => ({ id: r.id, weekday: r.dayOfWeek, startTime: r.startTimeLocal, endTime: r.endTimeLocal }))}
            onDeleteRule={(ruleId) => handleRemoveRule(ruleId)}
          />
          <p className="text-[11px] text-grey-500 mt-1">Click a block to delete that time slot.</p>
        </div>
      ) : (
        <div className="mb-8">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-grey-200 py-2.5 text-[13px]">
              <span>
                {DAY_LABELS[r.dayOfWeek]} {r.startTimeLocal}–{r.endTimeLocal}
              </span>
              <button disabled={submitting} onClick={() => handleRemoveRule(r.id)} className="text-[12px] font-bold text-red disabled:opacity-50">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {subtab === "exception" && (
      <>
      <h2 className="text-[15px] font-bold text-ink mb-2.5">Date exceptions (monthly calendar)</h2>
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
              External event (unavailable)
            </div>
          )}
          {selectedException ? (
            <div className="mb-3">
              <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-grey-100 text-grey-500 mr-2">
                {selectedException.kind === "blocked" ? "Time off (all day)" : "Extra availability (all day)"}
              </span>
              <button disabled={submitting} onClick={handleRemoveExceptionForSelectedDate} className="text-[12px] font-bold text-red disabled:opacity-50">
                Delete this exception
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-3">
              <button
                disabled={submitting}
                onClick={() => handleAddExceptionForSelectedDate("blocked")}
                className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Mark this date as time off
              </button>
              <button
                disabled={submitting}
                onClick={() => handleAddExceptionForSelectedDate("available")}
                className="text-[12px] font-bold border-[1.5px] border-ink text-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Open this date (extra availability)
              </button>
            </div>
          )}

          <div className="border-t border-grey-200 pt-3 mb-3" data-testid="teacher-day-timeline">
            <div className="text-[11px] font-bold text-grey-500 mb-1">
              Open hours on this date (recurring rules + exceptions)
            </div>
            {openWindowsForSelectedDate.length === 0 ? (
              <div className="text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2 mb-2">
                No open hours on this date (time off or no recurring availability).
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {openWindowsForSelectedDate.map((w) => (
                  <span key={`${w.startTimeLocal}-${w.endTimeLocal}`} className="text-[11.5px] text-ink border border-grey-200 rounded px-2 py-1">
                    {w.startTimeLocal}–{w.endTimeLocal}
                  </span>
                ))}
              </div>
            )}

            {partialExceptionsForSelectedDate.length > 0 && (
              <div className="mb-2">
                {partialExceptionsForSelectedDate.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between text-[12px] py-1">
                    <span className="text-grey-500">
                      {ex.kind === "blocked" ? "Partial time off" : "Partial extra availability"}: {ex.startTimeLocal}–{ex.endTimeLocal}
                    </span>
                    <button
                      disabled={submitting}
                      onClick={() => handleRemovePartialException(ex.id)}
                      className="text-[12px] font-bold text-red disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] font-bold text-grey-500 mb-1">Adjust a partial time range</div>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[10px] text-grey-500 mb-1">Start</label>
                <input
                  type="time"
                  className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
                  value={partialStartTimeLocal}
                  onChange={(e) => setPartialStartTimeLocal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-grey-500 mb-1">End</label>
                <input
                  type="time"
                  className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
                  value={partialEndTimeLocal}
                  onChange={(e) => setPartialEndTimeLocal(e.target.value)}
                />
              </div>
              <button
                disabled={submitting}
                onClick={() => handleAddPartialException("blocked")}
                className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Block this time range
              </button>
              <button
                disabled={submitting}
                onClick={() => handleAddPartialException("available")}
                className="text-[12px] font-bold border-[1.5px] border-ink text-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Open this time range
              </button>
            </div>
          </div>

          <div className="border-t border-grey-200 pt-3 mb-3">
            <div className="text-[11px] font-bold text-grey-500 mb-1">Time off for a date range</div>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[10px] text-grey-500 mb-1">End date</label>
                <input
                  type="date"
                  className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
                  value={rangeEndDateKey}
                  min={selectedDateKey}
                  onChange={(e) => setRangeEndDateKey(e.target.value)}
                />
              </div>
              <button disabled={submitting} onClick={handleAddRangeBlocked} className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                Block {selectedDateKey} to {rangeEndDateKey}
              </button>
            </div>
          </div>

          <button disabled={submitting} onClick={handleCopyPreviousMonth} className="text-[12px] font-bold text-ink underline disabled:opacity-50">
            Copy last month&apos;s exceptions to this month
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
