"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DashboardData } from "./dashboard-data";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function HomeDashboard({
  studentName,
  data,
  onShowLessons,
  onShowStats,
}: {
  studentName: string;
  data: DashboardData;
  onShowLessons: () => void;
  onShowStats: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-extrabold text-ink">
          {studentName}의 학습 현황
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <div>
          <CalendarCard
            data={data}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </div>
        <div className="flex flex-col gap-6">
          <UpcomingWidget upcoming={data.upcoming} onShowAll={onShowLessons} />
          <StatsWidget
            attendanceRate={data.attendanceRate}
            onShowAll={onShowStats}
          />
        </div>
      </div>
    </div>
  );
}

function CalendarCard({
  data,
  selectedDay,
  onSelectDay,
}: {
  data: DashboardData;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}) {
  const { calendarYear, calendarMonth, calendarByDay } = data;
  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedSessions =
    selectedDay !== null ? calendarByDay[selectedDay] ?? [] : [];

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <h2 className="text-[14px] font-bold text-ink mb-3">
        {calendarYear}년 {calendarMonth + 1}월
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-bold text-grey-300 py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const sessions = day !== null ? calendarByDay[day] ?? [] : [];
          const isSelected = day !== null && day === selectedDay;
          return (
            <button
              key={i}
              disabled={day === null}
              onClick={() => day !== null && onSelectDay(isSelected ? null : day)}
              className={
                "aspect-square rounded-lg text-[12.5px] flex flex-col items-center justify-center gap-0.5 " +
                (day === null
                  ? ""
                  : isSelected
                  ? "bg-ink text-white font-bold"
                  : "text-ink hover:bg-grey-100")
              }
            >
              <span>{day ?? ""}</span>
              {sessions.length > 0 && (
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full " +
                    (isSelected ? "bg-white" : "bg-blue")
                  }
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay !== null && (
        <div className="mt-4 pt-4 border-t border-grey-200">
          <h3 className="text-[12.5px] font-bold text-ink mb-2">
            {calendarMonth + 1}월 {selectedDay}일 수업
          </h3>
          {selectedSessions.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">예정된 수업이 없습니다.</p>
          ) : (
            selectedSessions.map((s) => (
              <div
                key={s.sessionId}
                className="text-[12.5px] text-ink px-3 py-2 rounded-lg bg-grey-100 mb-1.5"
              >
                {s.subjectName} · {s.sessionNumber}회차
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function UpcomingWidget({
  upcoming,
  onShowAll,
}: {
  upcoming: DashboardData["upcoming"];
  onShowAll: () => void;
}) {
  const router = useRouter();

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-ink">예정된 수업</h2>
        <button
          onClick={onShowAll}
          className="text-[11.5px] font-semibold text-grey-500"
        >
          전체 보기 →
        </button>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-3 py-4 text-center">
          예정된 수업이 없습니다.
        </p>
      ) : (
        upcoming.map((lesson) => (
          <button
            key={lesson.sessionId}
            onClick={() => router.push(`/session/${lesson.sessionId}`)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-lg px-3.5 py-3 mb-2 last:mb-0"
          >
            <div className="text-[12px] text-grey-500 mb-1">
              {formatKoreanDateTime(lesson.scheduledAt)}
            </div>
            <div className="text-[13px] font-semibold text-ink">
              {lesson.subjectName} · {lesson.sessionNumber}회차
              {lesson.unitTitle ? ` · ${lesson.unitTitle}` : ""}
            </div>
            <div className="text-[11.5px] text-grey-500 mt-0.5">
              {lesson.teacherName}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function StatsWidget({
  attendanceRate,
  onShowAll,
}: {
  attendanceRate: number | null;
  onShowAll: () => void;
}) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-ink">통계 요약</h2>
        <button
          onClick={onShowAll}
          className="text-[11.5px] font-semibold text-grey-500"
        >
          전체 보기 →
        </button>
      </div>
      <div className="bg-grey-100 rounded-lg px-4 py-4">
        <div className="text-[11.5px] font-bold text-grey-500 mb-1">
          수업 참여율
        </div>
        <div className="text-[22px] font-extrabold text-ink">
          {attendanceRate !== null ? `${attendanceRate}%` : "—"}
        </div>
      </div>
    </div>
  );
}

function formatKoreanDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
