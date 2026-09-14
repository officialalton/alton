"use client";

import { useState } from "react";
import type { LessonItem } from "./lessons-data";
import type { CurriculumData } from "./curriculum-data";
import type { Memo } from "./memo-data";
import type { ReviewData, StudentFeedback } from "./review-data";
import type { LessonBookingTabProps } from "./LessonBookingTab";
import LessonBookingTab from "./LessonBookingTab";
import LessonsTab from "./LessonsTab";

// "수업" 탭 정리(A안, 2026-09-06) — 학생 포털의 "레슨"(레거시 legacy_sessions 뷰,
// 커리큘럼·리뷰 연동)과 "예약"(v3 sessions/reservations, Calendar/Meet 연동) 탭이
// 기능 중복이라는 지적에 따라 하나의 "수업" 탭으로 합쳤다. 선생님 포털에서 이미 쓴
// 패턴과 동일하게 v3(예약) 화면을 기본으로 하고, 레거시 화면(커리큘럼 진입·리뷰 열람)은
// 딱 두 개의 서브탭("예정 수업"/"지난 수업") 안에 흡수한다 — v3와 레거시는 서로 다른
// 테이블(sessions vs legacy_sessions)이라 행 단위로 합칠 수 없어(스키마 변경은 R9
// 범위 밖), v3 블록 아래에 레거시 블록을 이어서 보여주는 방식으로 정리했다.
export type ClassesTabProps = {
  upcoming: LessonItem[];
  past: LessonItem[];
  curricula: CurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  myFeedback: Record<string, StudentFeedback>;
} & Omit<LessonBookingTabProps, "mode" | "hideHeader">;

export default function ClassesTab({
  upcoming,
  past,
  curricula,
  memosByEnrollment,
  reviews,
  myFeedback,
  bookableEnrollments,
  pendingActivationSubjects,
  upcomingBookings,
  pastSessionsForReport,
  timezone,
  onListSlots,
  onCreateBooking,
  onCreateWeeklySeries,
  onCancelBooking,
  onUpdateTimezone,
  onReportTeacherIssue,
}: ClassesTabProps) {
  const [subtab, setSubtab] = useState<"upcoming" | "past">("upcoming");

  return (
    <div>
      <div className="px-8 pt-8">
        <h1 className="text-[20px] font-extrabold text-ink mb-3">수업</h1>
        <div className="flex gap-1.5">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSubtab(s)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                subtab === s ? "bg-ink text-white" : "bg-grey-100 text-grey-500"
              }`}
            >
              {s === "upcoming" ? "예정 수업" : "지난 수업"}
            </button>
          ))}
        </div>
      </div>

      <LessonBookingTab
        bookableEnrollments={bookableEnrollments}
        pendingActivationSubjects={pendingActivationSubjects}
        upcomingBookings={upcomingBookings}
        pastSessionsForReport={pastSessionsForReport}
        timezone={timezone}
        onListSlots={onListSlots}
        onCreateBooking={onCreateBooking}
        onCreateWeeklySeries={onCreateWeeklySeries}
        onCancelBooking={onCancelBooking}
        onUpdateTimezone={onUpdateTimezone}
        onReportTeacherIssue={onReportTeacherIssue}
        mode={subtab}
        hideHeader
      />

      <div className="max-w-[640px] px-8">
        <details className="border-t border-grey-200 pt-4 pb-8">
          <summary className="text-[12.5px] font-semibold text-grey-500 cursor-pointer">
            커리큘럼 진행·리뷰 (레거시 수업 기록)
          </summary>
          <div className="mt-3">
            <LessonsTab
              upcoming={upcoming}
              past={past}
              curricula={curricula}
              memosByEnrollment={memosByEnrollment}
              reviews={reviews}
              myFeedback={myFeedback}
              forcedSubtab={subtab}
              hideHeader
            />
          </div>
        </details>
      </div>
    </div>
  );
}
