"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherLesson } from "./dashboard-data";

export default function ScheduleTab({
  upcoming,
  past,
  reviewedSessionIds = [],
}: {
  upcoming: TeacherLesson[];
  past: TeacherLesson[];
  reviewedSessionIds?: string[];
}) {
  const [subtab, setSubtab] = useState<"upcoming" | "past">("upcoming");

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">수업</h1>

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {(["upcoming", "past"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setSubtab(id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === id
                ? "text-ink border-ink"
                : "text-grey-500 border-transparent")
            }
          >
            {id === "upcoming" ? "예정된 수업" : "지난 수업"}
          </button>
        ))}
      </div>

      {subtab === "upcoming" ? (
        <LessonList lessons={upcoming} emptyText="예정된 수업이 없습니다." actionLabel="수업 준비" />
      ) : (
        <LessonList
          lessons={past}
          emptyText="지난 수업이 없습니다."
          actionLabel="수업 기록"
          reviewedSessionIds={reviewedSessionIds}
        />
      )}
    </div>
  );
}

function LessonList({
  lessons,
  emptyText,
  actionLabel,
  reviewedSessionIds,
}: {
  lessons: TeacherLesson[];
  emptyText: string;
  actionLabel: string;
  reviewedSessionIds?: string[];
}) {
  const router = useRouter();
  const reviewedSet = new Set(reviewedSessionIds ?? []);

  if (lessons.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      {lessons.map((lesson) => (
        <div
          key={lesson.sessionId}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
        >
          <div className="text-[12px] text-grey-500 mb-1.5">
            {formatKoreanDateTime(lesson.scheduledAt)}
          </div>
          <div className="text-[13px] font-bold text-ink mb-1.5">
            {lesson.studentName} · {lesson.subjectName} · {lesson.sessionNumber}회차
            {lesson.unitTitle ? ` · ${lesson.unitTitle}` : ""}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/session/${lesson.sessionId}`)}
              className="text-[12px] font-semibold text-blue"
            >
              {actionLabel}
            </button>
            {reviewedSessionIds !== undefined && (
              <button
                onClick={() => router.push(`/teacher/review/${lesson.sessionId}`)}
                className="text-[12px] font-semibold text-blue"
              >
                {reviewedSet.has(lesson.sessionId) ? "리뷰 수정" : "리뷰 작성"}
              </button>
            )}
          </div>
        </div>
      ))}
    </>
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
