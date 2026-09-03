"use client";

// R6 11/N — 관리자 통합 일정. `official` 관리자 계정에 선생님 개인 Google Calendar를
// 직접 공유하지 않고, ALTON DB에 이미 있는 전체 선생님 확정 예약을 여기서 중앙 조회한다.
// 일정 변경·취소는 이 화면에서 직접 하지 않고(별도 재검증 체인이 필요), "예약 운영"
// 탭(BookingReconciliationPanel)의 기존 취소·재처리 기능으로 안내한다 — 조회·필터 전용.

import { useEffect, useMemo, useState } from "react";
import MonthCalendar, { type DayBadge } from "@/app/components/MonthCalendar";
import { dateKeyInTimezone, buildWeekGrid, todayKeyInTimezone } from "@/lib/calendar-date-utils";
import { listAllTeacherLessons, type UnifiedScheduleLessonRow } from "./booking-actions";

const SYNC_STATUS_LABEL: Record<string, string> = {
  pending: "동기화 준비 중",
  synced: "동기화 완료",
  failed: "동기화 재시도 중",
  reconciliation_needed: "수동 확인 필요",
};

const ADMIN_TIMEZONE = "America/Los_Angeles";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: ADMIN_TIMEZONE,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function UnifiedScheduleTab() {
  const [lessons, setLessons] = useState<UnifiedScheduleLessonRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"today" | "week" | "month">("today");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setLessons(await listAllTeacherLessons());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const todayKey = todayKeyInTimezone(ADMIN_TIMEZONE);
  const weekGrid = useMemo(() => buildWeekGrid(todayKey), [todayKey]);
  const weekDateKeys = new Set(weekGrid.map((c) => c.dateKey));

  const teacherOptions = useMemo(
    () => Array.from(new Set((lessons ?? []).map((l) => l.teacherName ?? "(이름 없음)"))).sort(),
    [lessons]
  );
  const subjectOptions = useMemo(
    () => Array.from(new Set((lessons ?? []).map((l) => l.subjectName ?? "(과목 없음)"))).sort(),
    [lessons]
  );

  const filteredLessons = useMemo(() => {
    return (lessons ?? []).filter((l) => {
      if (teacherFilter !== "all" && (l.teacherName ?? "(이름 없음)") !== teacherFilter) return false;
      if (subjectFilter !== "all" && (l.subjectName ?? "(과목 없음)") !== subjectFilter) return false;
      if (statusFilter !== "all" && l.googleSyncStatus !== statusFilter) return false;
      return true;
    });
  }, [lessons, teacherFilter, subjectFilter, statusFilter]);

  const badgesByDate = useMemo(() => {
    const badges: Record<string, DayBadge> = {};
    for (const l of filteredLessons) {
      const key = dateKeyInTimezone(l.startsAt, ADMIN_TIMEZONE);
      const tone: DayBadge["tone"] = l.externalChangeStatus !== "none" ? "red" : "ink";
      badges[key] = { count: (badges[key]?.count ?? 0) + 1, tone };
    }
    return badges;
  }, [filteredLessons]);

  const visibleLessons = useMemo(() => {
    if (view === "today") return filteredLessons.filter((l) => dateKeyInTimezone(l.startsAt, ADMIN_TIMEZONE) === todayKey);
    if (view === "week") {
      if (selectedDateKey) return filteredLessons.filter((l) => dateKeyInTimezone(l.startsAt, ADMIN_TIMEZONE) === selectedDateKey);
      return filteredLessons.filter((l) => weekDateKeys.has(dateKeyInTimezone(l.startsAt, ADMIN_TIMEZONE)));
    }
    if (selectedDateKey) return filteredLessons.filter((l) => dateKeyInTimezone(l.startsAt, ADMIN_TIMEZONE) === selectedDateKey);
    return filteredLessons;
  }, [filteredLessons, view, selectedDateKey, todayKey, weekDateKeys]);

  return (
    <div className="max-w-[880px] px-8 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">통합 일정</h1>
        <div className="flex gap-1.5">
          {(["today", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setSelectedDateKey(null);
              }}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${view === v ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
            >
              {v === "today" ? "오늘" : v === "week" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">
        전체 선생님의 확정 예약을 ALTON DB 기준으로 중앙 조회합니다(`official` 계정에 개별 Google Calendar를 공유하지
        않음). 취소·재동기화는 "예약 운영" 탭에서 처리하세요. 빨간 점은 Google 외부 변경 감지로 관리자 확인이 필요한
        예약입니다.
      </p>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      <div className="flex gap-2 flex-wrap mb-4">
        <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="all">전체 선생님</option>
          {teacherOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="all">전체 과목</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">전체 동기화 상태</option>
          {Object.entries(SYNC_STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <button onClick={refresh} disabled={loading} className="text-[12px] font-bold text-ink underline disabled:opacity-50">
          새로고침
        </button>
      </div>

      {view === "month" && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-3 mb-4 max-w-[360px]">
          <MonthCalendar
            timezone={ADMIN_TIMEZONE}
            selectedDateKey={selectedDateKey}
            onSelectDate={(k) => setSelectedDateKey(k === selectedDateKey ? null : k)}
            badgesByDate={badgesByDate}
            initialYearMonth={todayKey.slice(0, 7)}
          />
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-1 mb-4 max-w-[420px]">
          {weekGrid.map((cell) => {
            const badge = badgesByDate[cell.dateKey];
            const isSelected = cell.dateKey === selectedDateKey;
            return (
              <button
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey === selectedDateKey ? null : cell.dateKey)}
                className={
                  "rounded-lg py-2 text-[12px] flex flex-col items-center gap-0.5 border-[1.5px] " +
                  (isSelected ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
                }
              >
                <span>{cell.day}</span>
                {badge && badge.count > 0 && (
                  <span
                    className={"w-1.5 h-1.5 rounded-full " + (isSelected ? "bg-white" : badge.tone === "red" ? "bg-red" : "bg-ink")}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {loading && !lessons ? (
        <div className="text-[13px] text-grey-500">불러오는 중…</div>
      ) : visibleLessons.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">해당 범위에 예약이 없습니다.</div>
      ) : (
        visibleLessons.map((l) => (
          <div key={l.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">
                  {l.teacherName ?? "(이름 없음)"} 선생님 · {l.studentName ?? "(학생 미확인)"} · {l.subjectName ?? "(과목 없음)"}
                </div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(l.startsAt)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-grey-100 text-grey-500">
                {SYNC_STATUS_LABEL[l.googleSyncStatus] ?? l.googleSyncStatus}
              </span>
              {l.externalChangeStatus !== "none" && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">외부 변경 감지·확인 필요</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
