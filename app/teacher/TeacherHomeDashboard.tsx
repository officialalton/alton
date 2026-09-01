"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TeacherDashboardData } from "./dashboard-data";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function TeacherHomeDashboard({
  data,
  onShowSchedule,
}: {
  data: TeacherDashboardData;
  onShowSchedule: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const status = data.status;

  return (
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-6">
        {data.teacherName} 선생님, 안녕하세요
      </h1>

      {status === "pending" && (
        <div className="border-[1.5px] border-ink rounded-xl px-5 py-4.5 mb-6">
          <h2 className="text-[14px] font-bold text-ink mb-1.5">
            계정이 아직 활성화되지 않았습니다
          </h2>
          <p className="text-[12.5px] text-grey-500 leading-[1.6]">
            Google Workspace 연결·시급 설정·계약 확인 등 필요한 절차가
            완료되면 관리자가 활동을 시작할 수 있도록 승인합니다.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <CalendarCard data={data} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        <UpcomingWidget upcoming={data.upcoming} onShowAll={onShowSchedule} />
      </div>
    </div>
  );
}

function CalendarCard({
  data,
  selectedDay,
  onSelectDay,
}: {
  data: TeacherDashboardData;
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

  const selectedSessions = selectedDay !== null ? calendarByDay[selectedDay] ?? [] : [];

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
                    "w-1.5 h-1.5 rounded-full " + (isSelected ? "bg-white" : "bg-blue")
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
            {data.calendarMonth + 1}월 {selectedDay}일 수업
          </h3>
          {selectedSessions.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">예정된 수업이 없습니다.</p>
          ) : (
            selectedSessions.map((s) => (
              <div
                key={s.sessionId}
                className="text-[12.5px] text-ink px-3 py-2 rounded-lg bg-grey-100 mb-1.5"
              >
                {s.studentName} · {s.subjectName} · {s.sessionNumber}회차
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
  upcoming: TeacherDashboardData["upcoming"];
  onShowAll: () => void;
}) {
  const router = useRouter();
  const top = upcoming.slice(0, 5);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-ink">예정된 수업</h2>
        <button onClick={onShowAll} className="text-[11.5px] font-semibold text-grey-500">
          전체 보기 →
        </button>
      </div>
      {top.length === 0 ? (
        <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-3 py-4 text-center">
          예정된 수업이 없습니다.
        </p>
      ) : (
        top.map((lesson) => (
          <button
            key={lesson.sessionId}
            onClick={() => router.push(`/session/${lesson.sessionId}`)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-lg px-3.5 py-3 mb-2 last:mb-0"
          >
            <div className="text-[12px] text-grey-500 mb-1">
              {formatKoreanDateTime(lesson.scheduledAt)}
            </div>
            <div className="text-[13px] font-semibold text-ink">
              {lesson.studentName} · {lesson.subjectName} · {lesson.sessionNumber}회차
              {lesson.unitTitle ? ` · ${lesson.unitTitle}` : ""}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function formatKoreanDateTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
