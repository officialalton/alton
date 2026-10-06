"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherLesson } from "./dashboard-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtIntl } from "@/lib/format-datetime";

type ReportType = "teacher_late" | "student_no_show_reported";

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  teacher_late: "I was late",
  student_no_show_reported: "Student no-show",
};

export type ReportSessionIssueParams = {
  sessionId: string;
  reportType: ReportType;
  minutesLate?: number;
  notes?: string;
};

export default function ScheduleTab({
  upcoming,
  past,
  reviewedSessionIds = [],
  onReportSessionIssue,
}: {
  upcoming: TeacherLesson[];
  past: TeacherLesson[];
  reviewedSessionIds?: string[];
  onReportSessionIssue?: (params: ReportSessionIssueParams) => Promise<void>;
}) {
  const [subtab, setSubtab] = useState<"upcoming" | "past">("upcoming");

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">Lessons</h1>

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
            {id === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      {subtab === "upcoming" ? (
        <LessonList lessons={upcoming} emptyText="No upcoming lessons." actionLabel="Lesson prep" />
      ) : (
        <LessonList
          lessons={past}
          emptyText="No past lessons."
          actionLabel="Lesson record"
          reviewedSessionIds={reviewedSessionIds}
          onReportSessionIssue={onReportSessionIssue}
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
  onReportSessionIssue,
}: {
  lessons: TeacherLesson[];
  emptyText: string;
  actionLabel: string;
  reviewedSessionIds?: string[];
  onReportSessionIssue?: (params: ReportSessionIssueParams) => Promise<void>;
}) {
  const tz = useViewerTimezone();
  const router = useRouter();
  const reviewedSet = new Set(reviewedSessionIds ?? []);
  const [reportingSessionId, setReportingSessionId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("student_no_show_reported");
  const [minutesLate, setMinutesLate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportedSessionIds, setReportedSessionIds] = useState<Set<string>>(new Set());

  if (lessons.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        {emptyText}
      </div>
    );
  }

  function openReportForm(sessionId: string) {
    setReportingSessionId(sessionId);
    setReportType("student_no_show_reported");
    setMinutesLate("");
    setNotes("");
    setError(null);
  }

  async function handleSubmitReport(sessionId: string) {
    if (!onReportSessionIssue) return;
    setSubmitting(true);
    setError(null);
    try {
      await onReportSessionIssue({
        sessionId,
        reportType,
        minutesLate: reportType === "teacher_late" ? Number(minutesLate) || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      setReportedSessionIds((prev) => new Set(prev).add(sessionId));
      setReportingSessionId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {lessons.map((lesson) => (
        <div
          key={lesson.sessionId}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
        >
          <div className="text-[12px] text-grey-500 mb-1.5">
            {formatKoreanDateTime(lesson.scheduledAt, tz)}
          </div>
          <div className="text-[13px] font-bold text-ink mb-1.5">
            {lesson.studentName} · {lesson.subjectName} · Session {lesson.sessionNumber}
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
                {reviewedSet.has(lesson.sessionId) ? "Edit review" : "Write review"}
              </button>
            )}
            {onReportSessionIssue &&
              reportingSessionId !== lesson.sessionId &&
              (reportedSessionIds.has(lesson.sessionId) ? (
                <span className="text-[12px] font-semibold text-grey-500">Report submitted</span>
              ) : (
                <button
                  disabled={submitting}
                  onClick={() => openReportForm(lesson.sessionId)}
                  className="text-[12px] font-semibold text-red disabled:opacity-50"
                >
                  Report late / no-show
                </button>
              ))}
          </div>
          {error && reportingSessionId === lesson.sessionId && (
            <div className="mt-2 text-[12px] font-semibold text-red">{error}</div>
          )}
          {reportingSessionId === lesson.sessionId && (
            <div className="mt-3 border-t border-grey-200 pt-3">
              <label className="block text-[11px] font-bold text-grey-500 mb-1">Report type</label>
              <select
                className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                {(Object.keys(REPORT_TYPE_LABEL) as ReportType[]).map((k) => (
                  <option key={k} value={k}>
                    {REPORT_TYPE_LABEL[k]}
                  </option>
                ))}
              </select>
              {reportType === "teacher_late" && (
                <>
                  <label className="block text-[11px] font-bold text-grey-500 mb-1">Minutes late</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                    value={minutesLate}
                    onChange={(e) => setMinutesLate(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </>
              )}
              <label className="block text-[11px] font-bold text-grey-500 mb-1">Details (optional)</label>
              <input
                className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe what happened"
              />
              <div className="flex gap-2 justify-end">
                <button
                  disabled={submitting}
                  onClick={() => setReportingSessionId(null)}
                  className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  disabled={submitting || (reportType === "teacher_late" && !minutesLate)}
                  onClick={() => handleSubmitReport(lesson.sessionId)}
                  className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Submit report
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function formatKoreanDateTime(iso: string | null, tz: string) {
  if (!iso) return "";
  return fmtIntl(new Date(iso), {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }, tz);
}
