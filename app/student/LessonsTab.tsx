"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeSessionViewState } from "@/lib/session-view";
import type { LessonItem } from "./lessons-data";
import type { CurriculumData } from "./curriculum-data";
import type { Memo } from "./memo-data";
import type { ReviewData, StudentFeedback } from "./review-data";
import type { BookableEnrollment } from "./booking-data";
import CurriculumView from "./CurriculumView";
import ReviewPanel from "./ReviewPanel";
import CalendlyWidget from "@/app/CalendlyWidget";

type SubView =
  | { type: "list" }
  | { type: "curriculum"; enrollmentId: string }
  | { type: "review"; sessionId: string }
  | { type: "booking"; enrollment: BookableEnrollment };

export default function LessonsTab({
  upcoming,
  past,
  curricula,
  memosByEnrollment,
  reviews,
  myFeedback,
  bookableEnrollments = [],
  readOnly = false,
}: {
  upcoming: LessonItem[];
  past: LessonItem[];
  curricula: CurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  myFeedback: Record<string, StudentFeedback>;
  bookableEnrollments?: BookableEnrollment[];
  readOnly?: boolean;
}) {
  const [subtab, setSubtab] = useState<"upcoming" | "past">("upcoming");
  const [subView, setSubView] = useState<SubView>({ type: "list" });

  if (subView.type === "booking") {
    const url = `${subView.enrollment.calendlySchedulingUrl}${
      subView.enrollment.calendlySchedulingUrl.includes("?") ? "&" : "?"
    }utm_content=${subView.enrollment.enrollmentId}`;
    return (
      <div className="max-w-[640px] px-8 py-8">
        <button
          onClick={() => setSubView({ type: "list" })}
          className="text-[13px] text-grey-500 font-semibold mb-4"
        >
          ← 뒤로
        </button>
        <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
          {subView.enrollment.teacherName}과(와) 다음 회차 예약
        </h1>
        <p className="text-[13px] text-grey-500 mb-5">
          {subView.enrollment.subjectName} · {subView.enrollment.currentSession}/
          {subView.enrollment.totalSessions}회차
        </p>
        <CalendlyWidget url={url} />
      </div>
    );
  }

  if (subView.type === "curriculum") {
    const data = curricula.find((c) => c.enrollmentId === subView.enrollmentId);
    if (!data) return null;
    return (
      <CurriculumView
        data={data}
        initialMemos={memosByEnrollment[data.enrollmentId] ?? []}
        onBack={() => setSubView({ type: "list" })}
        onReview={(sessionId) => setSubView({ type: "review", sessionId })}
        readOnly={readOnly}
      />
    );
  }

  if (subView.type === "review") {
    return (
      <ReviewPanel
        sessionId={subView.sessionId}
        review={reviews[subView.sessionId] ?? null}
        myFeedback={myFeedback[subView.sessionId] ?? null}
        onBack={() => setSubView({ type: "list" })}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">레슨</h1>

      {bookableEnrollments.length > 0 && (
        <div className="mb-6 flex flex-col gap-2.5">
          {bookableEnrollments.map((e) => (
            <div
              key={e.enrollmentId}
              className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5"
            >
              <div>
                <div className="text-[13px] font-bold text-ink">
                  {e.teacherName} · {e.subjectName}
                </div>
                <div className="text-[12px] text-grey-500 mt-0.5">
                  {e.currentSession}/{e.totalSessions}회차
                </div>
              </div>
              <button
                onClick={() => setSubView({ type: "booking", enrollment: e })}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white shrink-0"
              >
                다음 회차 예약하기
              </button>
            </div>
          ))}
        </div>
      )}

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
        <UpcomingList
          lessons={upcoming}
          onOpenCurriculum={(enrollmentId) =>
            setSubView({ type: "curriculum", enrollmentId })
          }
        />
      ) : (
        <PastList
          lessons={past}
          reviews={reviews}
          onOpenCurriculum={(enrollmentId) =>
            setSubView({ type: "curriculum", enrollmentId })
          }
          onReview={(sessionId) => setSubView({ type: "review", sessionId })}
        />
      )}
    </div>
  );
}

function UpcomingList({
  lessons,
  onOpenCurriculum,
}: {
  lessons: LessonItem[];
  onOpenCurriculum: (enrollmentId: string) => void;
}) {
  const router = useRouter();

  if (lessons.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        예정된 수업이 없습니다.
      </div>
    );
  }

  return (
    <>
      {lessons.map((lesson) => {
        const state = lesson.scheduledAt
          ? computeSessionViewState(
              lesson.status,
              lesson.scheduledAt,
              lesson.durationMinutes
            )
          : "prep";
        return (
          <div
            key={lesson.sessionId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
          >
            <div className="text-[12px] text-grey-500 mb-1.5">
              {formatKoreanDateTime(lesson.scheduledAt)}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <button
                onClick={() => onOpenCurriculum(lesson.enrollmentId)}
                className="text-[13px] font-bold text-ink"
              >
                {lesson.subjectName} · {lesson.sessionNumber}회차
                {lesson.unitTitle ? ` · ${lesson.unitTitle}` : ""}
              </button>
            </div>
            <div className="text-[12px] text-grey-500 mb-3">
              {lesson.teacherName}
            </div>
            <button
              onClick={() => router.push(`/session/${lesson.sessionId}`)}
              className="text-[12px] font-bold px-4 py-2 rounded-lg bg-ink text-white"
            >
              {state === "live" ? "수업 입장" : "수업 준비"}
            </button>
          </div>
        );
      })}
    </>
  );
}

function PastList({
  lessons,
  reviews,
  onOpenCurriculum,
  onReview,
}: {
  lessons: LessonItem[];
  reviews: Record<string, ReviewData>;
  onOpenCurriculum: (enrollmentId: string) => void;
  onReview: (sessionId: string) => void;
}) {
  const router = useRouter();

  if (lessons.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        지난 수업이 없습니다.
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
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <button
              onClick={() => onOpenCurriculum(lesson.enrollmentId)}
              className="text-[13px] font-bold text-ink"
            >
              {lesson.subjectName} · {lesson.sessionNumber}회차
              {lesson.unitTitle ? ` · ${lesson.unitTitle}` : ""}
            </button>
          </div>
          <div className="text-[12px] text-grey-500 mb-3">
            {lesson.teacherName}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/session/${lesson.sessionId}`)}
              className="text-[12px] font-semibold text-blue"
            >
              수업 기록
            </button>
            <button
              onClick={() => onReview(lesson.sessionId)}
              className="text-[12px] font-semibold text-blue"
            >
              리뷰 보기
              {reviews[lesson.sessionId] ? "" : " (미작성)"}
            </button>
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
