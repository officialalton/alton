"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherLessonScheduleItem, ExternalBusyBlock } from "./lesson-schedule-actions";
import type { AvailabilityExceptionRow } from "./availability-actions";
import MonthCalendar, { type DayBadge } from "@/app/components/MonthCalendar";
import { dateKeyInTimezone, dateKeysCoveredByInterval, buildWeekGrid, todayKeyInTimezone } from "@/lib/calendar-date-utils";
import LessonReviewForm from "./LessonReviewForm";
import {
  listMyTrialSessionsNeedingReview,
  listActiveReviewCategories,
  saveTrialLessonReviewDraft,
  finalizeTrialLessonReview,
  type TrialSessionNeedingReview,
  type ReviewCategoryOption,
} from "./trial-review-actions";

// M4 UAT #5 — 사용자가 실제로 써보고 지적한 대로, 체험 수업 리뷰 작성 진입점을
// "배정" 탭(TrialReviewPanel, 이제 삭제됨)에서 이 화면("정규수업" 탭, 실제로
// 진행한 v3 세션이 예정/지난으로 보이는 곳)으로 옮겼다. 완료된 체험 수업은
// 리뷰를 확정하기 전까지 "예정된 수업" 쪽에 남아있다가, 확정해야 "지난 수업"
// 목록으로 넘어간다(정규 수업은 R9 범위 밖 — 기존 날짜/상태 기준 그대로 유지).
function isPastLesson(lesson: TeacherLessonScheduleItem, nowMs: number): boolean {
  const ended = new Date(lesson.endsAt).getTime() < nowMs;
  if (!ended) return false;
  if (lesson.isTrial && lesson.reviewStatus !== "final") return false;
  return true;
}

// 2026-09-03 정책 전환(요구사항 1) — 선생님이 organizer로 생성한 Calendar 이벤트의
// 생성·변경·취소·동기화 상태. 내부 Google 오류 원문은 노출하지 않는다(관리자 화면 전용).
const SYNC_STATUS_LABEL: Record<string, string> = {
  pending: "내 Calendar에 일정 생성 준비 중",
  synced: "내 Calendar에 일정 생성됨(학생 초대 발송)",
  failed: "Calendar 일정 생성 재시도 중",
  reconciliation_needed: "Calendar 일정 생성 실패 — 관리자 조치 중",
};

function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
}

function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type TeacherLessonScheduleTabProps = {
  lessons: TeacherLessonScheduleItem[];
  exceptions: AvailabilityExceptionRow[];
  timezone: string;
  onCancel: (reservationId: string, reason: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onLoadExternalBusy: (params: { rangeStart: string; rangeEnd: string }) => Promise<ExternalBusyBlock[]>;
  // M5-a(R7) — 수업 시작/종료. finalize의 outcome은 선생님이 직접 판정할 수 있는
  // completed/student_no_show만(본인 노쇼는 관리자 전용).
  onStartSession: (sessionId: string) => Promise<void>;
  onFinalizeSession: (params: {
    sessionId: string;
    outcome: "completed" | "student_no_show";
    reason: string;
    earlyEndReason?: "student_reason";
  }) => Promise<void>;
  // M5-b(R7) — 진행 중(live)인 수업에서 선생님 지각분을 당일 상호 합의로 연장(가능한
  // 만큼)하고, 나머지는 자동으로 보충시간(makeup_obligations)으로 이관한다.
  onResolveLateness: (params: { sessionId: string; lateMinutes: number; agreedExtendMinutes: number; reason: string }) => Promise<void>;
};

export default function TeacherLessonScheduleTab({
  lessons,
  exceptions,
  timezone,
  onCancel,
  onRefresh,
  onLoadExternalBusy,
  onStartSession,
  onFinalizeSession,
  onResolveLateness,
}: TeacherLessonScheduleTabProps) {
  const router = useRouter();
  const [view, setView] = useState<"week-list" | "week" | "month">("week-list");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [externalBusyBlocks, setExternalBusyBlocks] = useState<ExternalBusyBlock[]>([]);
  const [reviewCategories, setReviewCategories] = useState<ReviewCategoryOption[]>([]);
  const [reviewModalSession, setReviewModalSession] = useState<TrialSessionNeedingReview | null>(null);
  const [reviewModalLoading, setReviewModalLoading] = useState(false);
  const [reviewModalError, setReviewModalError] = useState<string | null>(null);
  const [showPastLessons, setShowPastLessons] = useState(false);
  const [sessionActionBusyId, setSessionActionBusyId] = useState<string | null>(null);
  const [noShowConfirmingSessionId, setNoShowConfirmingSessionId] = useState<string | null>(null);
  const [latenessSessionId, setLatenessSessionId] = useState<string | null>(null);
  const [lateMinutesDraft, setLateMinutesDraft] = useState("10");
  const [extendMinutesDraft, setExtendMinutesDraft] = useState("10");

  const todayKey = todayKeyInTimezone(timezone);
  const nowMs = Date.now();

  async function openReviewModal(sessionId: string) {
    setReviewModalError(null);
    setReviewModalLoading(true);
    try {
      const [sessions, categories] = await Promise.all([
        listMyTrialSessionsNeedingReview(),
        reviewCategories.length ? Promise.resolve(reviewCategories) : listActiveReviewCategories(),
      ]);
      setReviewCategories(categories);
      const match = sessions.find((s) => s.sessionId === sessionId) ?? null;
      if (!match) {
        setReviewModalError("리뷰 작성 대상을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.");
        return;
      }
      setReviewModalSession(match);
    } catch (e) {
      setReviewModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewModalLoading(false);
    }
  }

  async function handleReviewSaved() {
    await onRefresh();
  }

  useEffect(() => {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 35);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 35);
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

  const externalBusyForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return externalBusyBlocks.filter((b) => dateKeysCoveredByInterval(b.startsAt, b.endsAt, timezone).includes(selectedDateKey));
  }, [externalBusyBlocks, selectedDateKey, timezone]);

  const badgesByDate = useMemo(() => {
    const badges: Record<string, DayBadge> = {};
    for (const ex of exceptions) {
      badges[ex.exceptionDate] = { count: 1, tone: ex.kind === "blocked" ? "red" : "grey" };
    }
    for (const lesson of lessons) {
      const key = dateKeyInTimezone(lesson.startsAt, timezone);
      const existing = badges[key];
      badges[key] = { count: (existing?.count ?? 0) + 1, tone: "ink" };
    }
    return badges;
  }, [lessons, exceptions, timezone]);

  const weekGrid = useMemo(() => buildWeekGrid(todayKey), [todayKey]);
  const weekDateKeys = new Set(weekGrid.map((c) => c.dateKey));

  const visibleLessons = useMemo(() => {
    if (view === "week-list") {
      return lessons.filter((l) => weekDateKeys.has(dateKeyInTimezone(l.startsAt, timezone)));
    }
    if (selectedDateKey) {
      return lessons.filter((l) => dateKeyInTimezone(l.startsAt, timezone) === selectedDateKey);
    }
    return lessons;
  }, [lessons, view, selectedDateKey, timezone, weekDateKeys]);

  // M4 UAT #5 — "예정된 수업"/"지난 수업" 분리. 정규 수업은 시간 경과만 기준(기존 그대로),
  // 체험 수업은 리뷰 확정 전까지 시간이 지나도 예정된 수업 쪽에 남는다(isPastLesson 참고).
  const upcomingLessons = useMemo(
    () => visibleLessons.filter((l) => !isPastLesson(l, nowMs)),
    [visibleLessons, nowMs]
  );
  const pastLessons = useMemo(
    () => visibleLessons.filter((l) => isPastLesson(l, nowMs)),
    [visibleLessons, nowMs]
  );

  function renderLessonCard(lesson: TeacherLessonScheduleItem) {
    const needsReview = lesson.isTrial && lesson.finalStatus === "completed" && lesson.reviewStatus !== "final";
    return (
      <div key={lesson.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-ink flex items-center gap-1.5">
              <span
                className={
                  "text-[10.5px] font-bold px-1.5 py-0.5 rounded " +
                  (lesson.isTrial ? "bg-red/10 text-red" : "bg-ink/10 text-ink")
                }
              >
                {lesson.isTrial ? "체험" : "정규"}
              </span>
              {lesson.studentName} · {lesson.subjectName}
            </div>
            <div className="text-[13px] text-grey-500 mt-0.5">
              {formatDateTime(lesson.startsAt, timezone)} · {durationMinutes(lesson.startsAt, lesson.endsAt)}분
            </div>
          </div>
          {cancellingReservationId !== lesson.reservationId && (
            <button
              disabled={submitting}
              onClick={() => {
                setCancellingReservationId(lesson.reservationId);
                setCancelReasonDraft("");
              }}
              className="text-[12px] font-bold text-red disabled:opacity-50"
            >
              취소
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-grey-100 text-grey-500">
            {SYNC_STATUS_LABEL[lesson.googleSyncStatus] ?? lesson.googleSyncStatus}
          </span>
          {lesson.externalChangeStatus !== "none" && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">관리자 확인 필요(외부 변경 감지)</span>
          )}
          {lesson.googleMeetLink && (
            <a href={lesson.googleMeetLink} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-ink underline">
              Meet 입장
            </a>
          )}
          {lesson.smartNotesDriveFileId && (
            <a
              href={`https://drive.google.com/file/d/${lesson.smartNotesDriveFileId}/view`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-semibold text-ink underline"
            >
              Smart Notes 보기
            </a>
          )}
          {needsReview && (
            <button
              disabled={reviewModalLoading}
              onClick={() => openReviewModal(lesson.sessionId)}
              className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-ink text-white disabled:opacity-50"
            >
              수업 리뷰 작성
            </button>
          )}
          {lesson.isTrial && lesson.reviewStatus === "draft" && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-grey-100 text-grey-500">리뷰 초안 저장됨 · 비공개</span>
          )}
        </div>
        {(lesson.finalStatus === "scheduled" || lesson.finalStatus === "live") && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {lesson.finalStatus === "scheduled" && (
              <button
                disabled={sessionActionBusyId === lesson.sessionId}
                onClick={() => handleStartSession(lesson.sessionId)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink text-white disabled:opacity-50"
              >
                수업 시작
              </button>
            )}
            {lesson.finalStatus === "live" && (
              <button
                disabled={sessionActionBusyId === lesson.sessionId}
                onClick={() => handleFinalizeSession(lesson.sessionId, "completed")}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-ink disabled:opacity-50"
              >
                수업 종료(완료)
              </button>
            )}
            {lesson.finalStatus === "live" && (
              <button
                disabled={sessionActionBusyId === lesson.sessionId}
                onClick={() => {
                  setLatenessSessionId(lesson.sessionId === latenessSessionId ? null : lesson.sessionId);
                  setLateMinutesDraft("10");
                  setExtendMinutesDraft("10");
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-ink disabled:opacity-50"
              >
                지각 당일 연장
              </button>
            )}
            {lesson.finalStatus === "live" &&
              (noShowConfirmingSessionId === lesson.sessionId ? (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red/10 text-red">
                  학생 미접속 확정?{" "}
                  <button
                    disabled={sessionActionBusyId === lesson.sessionId}
                    onClick={() => handleFinalizeSession(lesson.sessionId, "student_no_show")}
                    className="underline font-bold"
                  >
                    확정
                  </button>{" "}
                  ·{" "}
                  <button onClick={() => setNoShowConfirmingSessionId(null)} className="underline">
                    취소
                  </button>
                </span>
              ) : (
                <button
                  disabled={sessionActionBusyId === lesson.sessionId}
                  onClick={() => setNoShowConfirmingSessionId(lesson.sessionId)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red/5 text-red disabled:opacity-50"
                >
                  학생 노쇼 확정(수업 시작 15분 후부터, 학생 접속기록 없을 때만)
                </button>
              ))}
          </div>
        )}
        {latenessSessionId === lesson.sessionId && (
          <div className="mt-3 border-t border-grey-200 pt-3">
            <p className="text-[11.5px] text-grey-500 mb-2">
              지각분 전체를 연장하지 못하면 나머지는 자동으로 학생의 보충시간으로 이관됩니다(선생님 가능시간·기존
              예약과 겹치는 경우 연장이 거부될 수 있습니다).
            </p>
            <div className="flex gap-2 items-end mb-2">
              <div>
                <label className="block text-[11px] font-bold text-grey-500 mb-1">지각 분</label>
                <input
                  type="number"
                  min={1}
                  className="w-20 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                  value={lateMinutesDraft}
                  onChange={(e) => setLateMinutesDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-grey-500 mb-1">합의 연장 분</label>
                <input
                  type="number"
                  min={0}
                  className="w-20 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                  value={extendMinutesDraft}
                  onChange={(e) => setExtendMinutesDraft(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                disabled={sessionActionBusyId === lesson.sessionId}
                onClick={() => setLatenessSessionId(null)}
                className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
              >
                닫기
              </button>
              <button
                disabled={sessionActionBusyId === lesson.sessionId}
                onClick={() => handleResolveLateness(lesson.sessionId)}
                className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                연장 확정
              </button>
            </div>
          </div>
        )}
        {cancellingReservationId === lesson.reservationId && (
          <div className="mt-3 border-t border-grey-200 pt-3">
            <label className="block text-[11px] font-bold text-grey-500 mb-1">취소 사유</label>
            <input
              autoFocus
              className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
              value={cancelReasonDraft}
              onChange={(e) => setCancelReasonDraft(e.target.value)}
              placeholder="예: 개인 사정"
            />
            <div className="flex gap-2 justify-end">
              <button
                disabled={submitting}
                onClick={() => setCancellingReservationId(null)}
                className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
              >
                닫기
              </button>
              <button
                disabled={submitting}
                onClick={() => handleCancel(lesson.reservationId)}
                className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                취소 확정
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  async function handleCancel(reservationId: string) {
    const reason = cancelReasonDraft.trim() || "선생님 취소";
    setSubmitting(true);
    setError(null);
    try {
      await onCancel(reservationId, reason);
      setCancellingReservationId(null);
      setCancelReasonDraft("");
      router.refresh();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartSession(sessionId: string) {
    setSessionActionBusyId(sessionId);
    setError(null);
    try {
      await onStartSession(sessionId);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSessionActionBusyId(null);
    }
  }

  async function handleResolveLateness(sessionId: string) {
    const lateMinutes = Number(lateMinutesDraft);
    const agreedExtendMinutes = Number(extendMinutesDraft);
    if (!Number.isFinite(lateMinutes) || lateMinutes <= 0) {
      setError("지각 분(late minutes)은 0보다 커야 합니다.");
      return;
    }
    if (!Number.isFinite(agreedExtendMinutes) || agreedExtendMinutes < 0 || agreedExtendMinutes > lateMinutes) {
      setError("합의 연장분은 0 이상, 지각분 이하여야 합니다.");
      return;
    }
    setSessionActionBusyId(sessionId);
    setError(null);
    try {
      await onResolveLateness({
        sessionId,
        lateMinutes,
        agreedExtendMinutes,
        reason: "선생님 지각 당일 상호 합의 연장",
      });
      setLatenessSessionId(null);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSessionActionBusyId(null);
    }
  }

  async function handleFinalizeSession(sessionId: string, outcome: "completed" | "student_no_show") {
    setSessionActionBusyId(sessionId);
    setError(null);
    try {
      await onFinalizeSession({
        sessionId,
        outcome,
        reason: outcome === "completed" ? "선생님 수업 종료" : "선생님 확인 — 학생 15분 이상 미접속",
      });
      setNoShowConfirmingSessionId(null);
      await onRefresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // 2026-09-06: 예약 종료시각 전 조기 완료는 사유가 필요하다(서버가 최종 강제).
      // 학생 사유(조퇴 등)인 경우에만 이 화면에서 바로 확인 후 재시도한다 — 선생님/회사
      // 귀책 조기종료는 "지각 당일 연장"이나 관리자 장애 판정 경로를 안내한다.
      if (message.includes("조기 종료 사유가 필요합니다") && outcome === "completed") {
        const confirmed = window.confirm(
          "예약 종료 시각이 아직 되지 않았습니다. 학생 사유(조퇴 등)로 지금 완료 처리하시겠습니까?\n\n선생님 귀책으로 일찍 끝난 경우 '지각 당일 연장'을, 회사·Meet 장애인 경우 관리자에게 장애 판정을 요청해주세요."
        );
        if (confirmed) {
          try {
            await onFinalizeSession({
              sessionId,
              outcome: "completed",
              reason: "학생 사유 조기 종료",
              earlyEndReason: "student_reason",
            });
            setNoShowConfirmingSessionId(null);
            await onRefresh();
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : String(e2));
          }
        }
      } else {
        setError(message);
      }
    } finally {
      setSessionActionBusyId(null);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">수업 일정</h1>
        <div className="flex gap-1.5">
          {(["week-list", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${view === v ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
            >
              {v === "week-list" ? "금주 목록" : v === "week" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">
        확정 수업(파란 점)과 등록해둔 휴무·임시 오픈(빨강·회색 점)을 함께 표시합니다. 밑줄이 있는 날짜는 Google
        캘린더의 다른 개인 일정이 있어 "외부 일정·예약 불가"입니다(제목·내용·참석자는 절대 표시하지 않습니다). 실제
        Google 조회는 Sandbox 승인 전까지 항상 빈 결과를 반환합니다.
      </p>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {view === "month" && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-3 mb-4">
          <MonthCalendar
            timezone={timezone}
            selectedDateKey={selectedDateKey}
            onSelectDate={(k) => setSelectedDateKey(k === selectedDateKey ? null : k)}
            badgesByDate={badgesByDate}
            externalBusyDates={externalBusyDateKeys}
            initialYearMonth={(lessons[0] ? dateKeyInTimezone(lessons[0].startsAt, timezone) : todayKey).slice(0, 7)}
          />
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekGrid.map((cell) => {
            const badge = badgesByDate[cell.dateKey];
            const isSelected = cell.dateKey === selectedDateKey;
            const hasExternalBusy = externalBusyDateKeys.has(cell.dateKey);
            return (
              <button
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey === selectedDateKey ? null : cell.dateKey)}
                title={hasExternalBusy ? "외부 일정 있음(예약 불가)" : undefined}
                className={
                  "rounded-lg py-2 text-[12px] flex flex-col items-center gap-0.5 border-[1.5px] " +
                  (isSelected ? "bg-ink text-white border-ink" : "border-grey-200 text-ink") +
                  (hasExternalBusy ? " underline decoration-grey-500 decoration-2 underline-offset-2" : "")
                }
              >
                <span>{cell.day}</span>
                {badge && badge.count > 0 && (
                  <span
                    className={
                      "w-1.5 h-1.5 rounded-full " +
                      (isSelected ? "bg-white" : badge.tone === "red" ? "bg-red" : badge.tone === "grey" ? "bg-grey-500" : "bg-ink")
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedDateKey && externalBusyForSelectedDate.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-grey-500 mb-1">외부 일정(예약 불가)</div>
          <div className="flex flex-wrap gap-1.5">
            {externalBusyForSelectedDate.map((b, i) => (
              <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                외부 일정 · {formatDateTime(b.startsAt, timezone).split(" ").slice(-2).join(" ")}~
                {formatDateTime(b.endsAt, timezone).split(" ").slice(-2).join(" ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {upcomingLessons.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {view !== "week-list" && selectedDateKey ? "이 날짜에 예정된 수업이 없습니다." : "예정된 수업이 없습니다."}
        </div>
      ) : (
        upcomingLessons.map((lesson) => renderLessonCard(lesson))
      )}

      {pastLessons.length > 0 && (
        <div className="mt-6 border-t border-grey-200 pt-4">
          <button
            onClick={() => setShowPastLessons((v) => !v)}
            className="text-[12.5px] font-semibold text-grey-500"
          >
            지난 수업 ({pastLessons.length}) {showPastLessons ? "숨기기 ▲" : "펼치기 ▼"}
          </button>
          {showPastLessons && <div className="mt-3">{pastLessons.map((lesson) => renderLessonCard(lesson))}</div>}
        </div>
      )}

      {reviewModalError && !reviewModalSession && (
        <div className="mt-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{reviewModalError}</div>
      )}

      {reviewModalSession && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl max-w-[520px] w-full max-h-[85vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-extrabold text-ink">수업 리뷰 작성</h2>
              <button
                onClick={() => {
                  setReviewModalSession(null);
                  setReviewModalError(null);
                }}
                className="text-[13px] font-semibold text-grey-500"
              >
                닫기
              </button>
            </div>
            <p className="text-[12.5px] text-grey-500 mb-3">
              초안 저장은 비공개입니다. <b>공개 확정</b>을 눌러야 보호자·학생 화면에 노출되고, 이 수업이 지난
              수업으로 이동합니다.
            </p>
            {reviewModalError && <div className="mb-2 text-[12px] text-red">{reviewModalError}</div>}
            <LessonReviewForm
              sessionId={reviewModalSession.sessionId}
              categories={reviewCategories}
              initial={{
                aiSummary: reviewModalSession.aiSummary,
                draftText: reviewModalSession.draftText ?? "",
                categoryNotes: Object.fromEntries(
                  Object.entries(reviewModalSession.categoryNotes).map(([k, v]) => [k, v ?? ""])
                ),
              }}
              onSaveDraft={async (value) => {
                await saveTrialLessonReviewDraft({
                  sessionId: reviewModalSession.sessionId,
                  aiSummary: value.aiSummary,
                  draftText: value.draftText,
                  categoryNotes: value.categoryNotes,
                });
                await handleReviewSaved();
              }}
              onFinalize={async (finalText) => {
                await finalizeTrialLessonReview({ sessionId: reviewModalSession.sessionId, finalText });
                setReviewModalSession(null);
                await handleReviewSaved();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
