"use client";

// R6 6/N — 관리자 예약 운영 화면: Calendar/Meet 동기화 불일치(reconciliation_needed/failed)
// 예약 목록 확인, 수동 재처리 트리거, 회사/선생님 귀책 취소.

import { useState } from "react";
import { useTabCachedData } from "./use-tab-cached-data";
import {
  loadBookingReconciliationDashboardAction,
  retryCalendarSyncNow,
  adminCancelLessonBooking,
  resolveExternalCalendarChange,
  resolveExternalChangeAcceptGoogleTime,
  resolveExternalChangeKeepAltonTime,
  resolveExternalChangeRecreateAfterDeletion,
  resolveExternalChangeCancelDueToDeletion,
  retryExternalCalendarReconciliationNow,
  adminFinalizeLessonSession,
  adminReopenSession,
  adminFinalizeSessionAsInfraIncident,
  adminResolveTeacherPartialInterruption,
  adminApplyMakeupTimeToBooking,
  resolveSessionJudgmentReconciliationTask,
  setReconciliationTaskStudentCancelledDisposition,
  type ExternalChangeResolution,
  type SessionOutcome,
  type TeacherReconciliationResult,
  type BookingReconciliationDashboard,
} from "./booking-actions";

const FINAL_STATUS_LABEL: Record<string, string> = {
  completed: "정상 완료",
  student_no_show: "학생 노쇼",
  teacher_no_show: "선생님 노쇼",
  student_cancelled: "학생 취소",
  teacher_cancelled: "선생님 취소",
  company_cancelled: "회사 취소",
  interrupted: "중단(장애)",
};

const ENTITLEMENT_DISPOSITION_LABEL: Record<string, string> = {
  consume: "소진(consume)",
  release: "해제(release)",
};

const EXTERNAL_CHANGE_STATUS_LABEL: Record<string, string> = {
  time_changed: "Google에서 시간 변경됨",
  deleted: "Google에서 이벤트 삭제됨",
  meet_link_changed: "Google에서 Meet 링크 변경됨",
};

const INCIDENT_REPORT_TYPE_LABEL: Record<string, string> = {
  teacher_late: "선생님 지각",
  student_no_show_reported: "학생 노쇼",
  teacher_no_show_reported: "선생님 노쇼",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, string> = {
  failed: "재시도 중(Calendar 동기화 실패)",
  reconciliation_needed: "수동 확인 필요(재시도 한도 초과)",
};

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  booking_confirmed: "예약 확정 알림",
  booking_cancelled: "예약 취소 알림",
  reminder_24h: "24시간 전 리마인드",
  reminder_2h: "2시간 전 리마인드",
};

// 2026-09-10(P1-2) — 이 화면의 여러 하위 영역이 데이터 도착 전 아무것도 그리지
// 않던 문제(UX 보완, 성능 개선 근거 아님)를 없애기 위한 최종 목록 형태 스켈레톤.
function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 mb-3" data-testid="booking-list-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 animate-pulse">
          <div className="h-3.5 w-1/3 bg-grey-100 rounded mb-2" />
          <div className="h-3 w-1/2 bg-grey-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// 2026-09-10(P1 재진입 성능 배치) — "예약"은 상태 변화가 잦은 화면으로
// 분류돼 TTL 10초를 쓴다.
const BOOKING_TTL_MS = 10_000;

export default function BookingReconciliationPanel({
  initialDashboard,
}: {
  initialDashboard?: BookingReconciliationDashboard;
}) {
  const {
    data: dashboard,
    error: fetchError,
    refreshing,
    refresh,
  } = useTabCachedData<BookingReconciliationDashboard>({
    cacheKey: "booking-dashboard",
    ttlMs: BOOKING_TTL_MS,
    seedData: initialDashboard,
    fetcher: loadBookingReconciliationDashboardAction,
  });
  const loading = dashboard === null;
  const rows = dashboard?.reconciliationNeeded ?? null;
  const outboxSummary = dashboard?.outboxSummary ?? null;
  const incidentReports = dashboard?.incidentReports ?? null;
  const externalChanges = dashboard?.externalChanges ?? null;
  const judgmentRows = dashboard?.sessionsNeedingJudgment ?? null;
  const finalizedRows = dashboard?.recentlyFinalized ?? null;
  const makeupObligations = dashboard?.makeupObligations ?? null;
  const reconciliationTasks = dashboard?.reconciliationTasks ?? null;
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const error = mutationError ?? fetchError;
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [resolvingReservationId, setResolvingReservationId] = useState<string | null>(null);
  const [resolveReasonDraft, setResolveReasonDraft] = useState("");
  const [judgmentBusyId, setJudgmentBusyId] = useState<string | null>(null);
  const [reopeningSessionId, setReopeningSessionId] = useState<string | null>(null);
  const [reopenReasonDraft, setReopenReasonDraft] = useState("");
  const [infraIncidentSessionId, setInfraIncidentSessionId] = useState<string | null>(null);
  const [infraIncidentReasonDraft, setInfraIncidentReasonDraft] = useState("");
  const [infraIncidentMinutesDraft, setInfraIncidentMinutesDraft] = useState("0");
  const [partialInterruptionSessionId, setPartialInterruptionSessionId] = useState<string | null>(null);
  const [partialInterruptionReasonDraft, setPartialInterruptionReasonDraft] = useState("");
  const [partialInterruptionMinutesDraft, setPartialInterruptionMinutesDraft] = useState("");
  const [applyingObligationId, setApplyingObligationId] = useState<string | null>(null);
  const [applyReservationIdDraft, setApplyReservationIdDraft] = useState("");
  const [applyMinutesDraft, setApplyMinutesDraft] = useState("");
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [dispositionSelectTaskId, setDispositionSelectTaskId] = useState<string | null>(null);
  const [dispositionDraft, setDispositionDraft] = useState<"consume" | "release">("consume");
  const [dispositionReasonDraft, setDispositionReasonDraft] = useState("");
  const [submittingDispositionTaskId, setSubmittingDispositionTaskId] = useState<string | null>(null);
  const [retryResults, setRetryResults] = useState<TeacherReconciliationResult[] | null>(null);
  // 2026-09-10(P1 재진입 성능 배치) — 예전엔 이 화면 전체의 최초-로딩
  // 플래그(loading)를 handleRetryNow/handleCancel/handleResolveExternalChange의
  // 진행 중 표시로도 같이 썼다. loading을 캐시 기반 "아직 한 번도 못 읽음"
  // 의미로 좁히면서, 저 세 액션 진행 중 버튼 비활성화는 별도 플래그로 분리했다.
  const [actionBusy, setActionBusy] = useState(false);

  async function handleResolveReconciliationTask(taskId: string) {
    setResolvingTaskId(taskId);
    setMutationError(null);
    try {
      const { result } = await resolveSessionJudgmentReconciliationTask({ taskId, reason: "관리자 확인 후 반영" });
      setMessage(
        result === "needs_review"
          ? "세션 상태가 작업 생성 시점과 달라져 반영하지 않았습니다 — needs_review로 전환됐습니다. 다시 확인해주세요."
          : "대사 작업을 반영했습니다(entitlement 조정 완료)."
      );
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolvingTaskId(null);
    }
  }

  async function handleSubmitStudentCancelledDisposition(taskId: string) {
    if (!dispositionReasonDraft.trim()) {
      setMutationError("사유를 입력해야 합니다.");
      return;
    }
    setSubmittingDispositionTaskId(taskId);
    setMutationError(null);
    try {
      await setReconciliationTaskStudentCancelledDisposition({
        taskId,
        disposition: dispositionDraft,
        reason: dispositionReasonDraft.trim(),
      });
      setMessage("수업권 처리 방식을 확정했습니다 — 이제 '반영'을 눌러 적용하세요.");
      setDispositionSelectTaskId(null);
      setDispositionReasonDraft("");
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmittingDispositionTaskId(null);
    }
  }

  // 2026-09-10(P1-2) — "지금 재처리"는 페이지 최초 로딩과 분리된 사용자 트리거
  // 동작으로 유지한다(자동 로딩 경로에 넣지 않음). retryExternalCalendarReconciliationNow()가
  // 이제 교사별 성공/실패를 그대로 반환하므로, 집계 숫자 뒤에 실패한 교사를
  // retryResults에 남겨 화면에서 바로 확인할 수 있게 한다 — 클릭 한 번에 개별
  // 실패가 묻히지 않게 하기 위함.
  async function handleRetryNow() {
    setActionBusy(true);
    setMutationError(null);
    setMessage(null);
    setRetryResults(null);
    try {
      const [result, externalResults] = await Promise.all([
        retryCalendarSyncNow(),
        retryExternalCalendarReconciliationNow(),
      ]);
      const checked = externalResults.filter((r) => r.checked).length;
      const changesDetected = externalResults.reduce((sum, r) => sum + r.changesDetected, 0);
      const failed = externalResults.filter((r) => r.error);
      setMessage(
        `${result.attempted}건 재시도 — 성공 ${result.succeeded}, 재시도 대기 ${result.failed}, 수동확인 필요 ${result.reconciliationNeeded}` +
          ` · 외부 변경 대조: 선생님 ${checked}명 확인, 신규 감지 ${changesDetected}건` +
          (failed.length > 0 ? ` · 대조 실패 ${failed.length}명(아래 목록 참고)` : "")
      );
      setRetryResults(externalResults);
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancel(reservationId: string) {
    const reason = cancelReasonDraft.trim() || "관리자 취소";
    setActionBusy(true);
    setMutationError(null);
    try {
      await adminCancelLessonBooking({ reservationId, cancelledByRole: "company", reason });
      setMessage("취소 처리됐습니다(수업권 release + 필요 시 만료일 30일 연장).");
      setCancellingReservationId(null);
      setCancelReasonDraft("");
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResolveExternalChange(reservationId: string, resolution: ExternalChangeResolution) {
    const reason = resolveReasonDraft.trim() || "관리자 확인";
    setActionBusy(true);
    setMutationError(null);
    try {
      if (resolution === "accepted_google_time") {
        await resolveExternalChangeAcceptGoogleTime({ reservationId, reason });
      } else if (resolution === "kept_alton_time") {
        await resolveExternalChangeKeepAltonTime({ reservationId, reason });
      } else if (resolution === "recreated_after_deletion") {
        await resolveExternalChangeRecreateAfterDeletion({ reservationId, reason });
      } else if (resolution === "confirmed_cancelled") {
        await resolveExternalChangeCancelDueToDeletion({ reservationId, reason });
      } else {
        await resolveExternalCalendarChange({ reservationId, resolution, reason });
      }
      setMessage(
        resolution === "accepted_google_time"
          ? "Google 시간을 재검증 후 ALTON에 반영했습니다."
          : resolution === "kept_alton_time"
            ? "Google 이벤트를 ALTON 기준 시간으로 복원했습니다."
            : resolution === "recreated_after_deletion"
              ? "ALTON 일정을 유지하고 Calendar 이벤트를 재생성했습니다."
              : resolution === "confirmed_cancelled"
                ? "정식 취소 절차로 예약을 정리했습니다."
                : "외부 변경을 확인 처리했습니다."
      );
      setResolvingReservationId(null);
      setResolveReasonDraft("");
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleFinalizeJudgment(sessionId: string, outcome: SessionOutcome) {
    const reasonByOutcome: Record<SessionOutcome, string> = {
      completed: "관리자 확인 — 정상 완료",
      student_no_show: "관리자 확인 — 학생 15분 이상 미접속 최종 노쇼",
      teacher_no_show: "관리자 확인 — 선생님 노쇼",
    };
    setJudgmentBusyId(sessionId);
    setMutationError(null);
    setMessage(null);
    try {
      await adminFinalizeLessonSession({ sessionId, outcome, reason: reasonByOutcome[outcome] });
      setMessage("세션을 확정했습니다.");
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setJudgmentBusyId(null);
    }
  }

  async function handleFinalizeInfraIncident(sessionId: string) {
    const reason = infraIncidentReasonDraft.trim() || "회사·Meet 인프라 장애";
    const providedMinutes = Number(infraIncidentMinutesDraft) || 0;
    setJudgmentBusyId(sessionId);
    setMutationError(null);
    setMessage(null);
    try {
      await adminFinalizeSessionAsInfraIncident({ sessionId, reason, providedMinutes });
      setMessage(
        providedMinutes > 0
          ? "중단으로 확정했습니다(120분 상한 내 정산 + 못 제공한 분은 보충시간으로 이관됨)."
          : "미시작으로 확정했습니다(수업권 hold 복원, 예약 취소 — 학생이 다시 예약할 수 있습니다)."
      );
      setInfraIncidentSessionId(null);
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setJudgmentBusyId(null);
    }
  }

  async function handleResolveTeacherPartialInterruption(sessionId: string) {
    const minutes = Number(partialInterruptionMinutesDraft);
    if (!Number.isFinite(minutes) || minutes < 0) {
      setMutationError("실제 제공 분은 0 이상이어야 합니다.");
      return;
    }
    const reason = partialInterruptionReasonDraft.trim() || "선생님 사유로 일부만 제공";
    setJudgmentBusyId(sessionId);
    setMutationError(null);
    setMessage(null);
    try {
      await adminResolveTeacherPartialInterruption({ sessionId, actualProvidedMinutes: minutes, reason });
      setMessage("선생님 사유 부분중단으로 확정했습니다(실제 제공 분만 지급, 미제공분은 보충시간으로 이관).");
      setPartialInterruptionSessionId(null);
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setJudgmentBusyId(null);
    }
  }

  async function handleApplyMakeupTime(obligationId: string) {
    const minutes = Number(applyMinutesDraft);
    if (!applyReservationIdDraft.trim()) {
      setMutationError("적용할 예약 ID를 입력하세요.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setMutationError("적용 분은 0보다 커야 합니다.");
      return;
    }
    setApplyingObligationId(obligationId);
    setMutationError(null);
    setMessage(null);
    try {
      await adminApplyMakeupTimeToBooking({ reservationId: applyReservationIdDraft.trim(), obligationId, minutes });
      setMessage("보충시간을 해당 예약 뒤에 이어붙였습니다(수업권 추가 소진 없음).");
      setApplyReservationIdDraft("");
      setApplyMinutesDraft("");
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplyingObligationId(null);
    }
  }

  async function handleReopen(sessionId: string) {
    const reason = reopenReasonDraft.trim() || "관리자 재검토";
    setJudgmentBusyId(sessionId);
    setMutationError(null);
    setMessage(null);
    try {
      await adminReopenSession({ sessionId, reason });
      setMessage("세션을 재개방했습니다 — 위 '세션 최종판정' 섹션에서 올바른 상태로 다시 확정하세요.");
      setReopeningSessionId(null);
      setReopenReasonDraft("");
      await refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
    } finally {
      setJudgmentBusyId(null);
    }
  }

  return (
    <div className="max-w-[880px] px-8 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">예약 운영 · Calendar 동기화 불일치</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-[12px] font-bold text-ink underline disabled:opacity-50"
          >
            {refreshing ? "새로고침 중..." : "새로고침"}
          </button>
          <button
            disabled={loading || actionBusy}
            onClick={handleRetryNow}
            className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            지금 재처리
          </button>
        </div>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">
        Google Calendar/Meet 생성이 실패했거나 재시도 한도(5회)를 넘긴 예약입니다. 예약·수업권 hold 자체는
        영향받지 않습니다 — Google 쪽 산출물(이벤트·Meet 링크)만 재처리 대상입니다.
      </p>

      {message && <div className="mb-4 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{message}</div>}
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {retryResults && retryResults.some((r) => r.error) && (
        <div className="mb-6 border-[1.5px] border-red/30 bg-red/5 rounded-xl px-4 py-3" data-testid="retry-failures">
          <h2 className="text-[13px] font-bold text-red mb-2">외부 변경 대조 실패한 선생님</h2>
          <ul className="space-y-1">
            {retryResults
              .filter((r) => r.error)
              .map((r) => (
                <li key={r.teacherId} className="text-[12px] text-red">
                  {r.teacherName ?? r.teacherId}: {r.error}
                </li>
              ))}
          </ul>
        </div>
      )}

      {outboxSummary && outboxSummary.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-ink mb-2">알림 발송 대기 현황</h2>
          <p className="text-[12px] text-grey-500 mb-2">
            실제 이메일·메시지 발송 인프라는 아직 없습니다(정식 오픈 전 필수 작업으로 별도 등록됨) — 아래는
            "발송 대기(pending)" 상태까지만 표시합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {outboxSummary.map((s) => (
              <span
                key={`${s.notificationType}-${s.status}`}
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-grey-100 text-grey-500"
              >
                {NOTIFICATION_TYPE_LABEL[s.notificationType] ?? s.notificationType} · {s.status} {s.count}건
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <ListSkeleton />
      ) : !rows || rows.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          불일치 예약이 없습니다.
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">{r.teacherName ?? "(이름 없음)"} 선생님</div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(r.startsAt)}</div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                {STATUS_LABEL[r.googleSyncStatus] ?? r.googleSyncStatus}
              </span>
            </div>
            {r.googleSyncError && (
              <div className="mt-2 text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
                최근 오류: {r.googleSyncError} (재시도 {r.googleSyncRetryCount}회)
              </div>
            )}
            {cancellingReservationId !== r.reservationId ? (
              <div className="mt-3 flex justify-end">
                <button
                  disabled={loading || actionBusy}
                  onClick={() => {
                    setCancellingReservationId(r.reservationId);
                    setCancelReasonDraft("");
                  }}
                  className="text-[12px] font-bold text-red disabled:opacity-50"
                >
                  이 예약 취소(회사 귀책)
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">취소 사유(회사 귀책)</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={cancelReasonDraft}
                  onChange={(e) => setCancelReasonDraft(e.target.value)}
                  placeholder="예: Google Workspace 계정 미발급"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={loading || actionBusy}
                    onClick={() => setCancellingReservationId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    닫기
                  </button>
                  <button
                    disabled={loading || actionBusy}
                    onClick={() => handleCancel(r.reservationId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    취소 확정
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">Google 외부 변경 감지</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        선생님/관리자가 Google Calendar에서 이 수업 이벤트를 ALTON 모르게 직접 바꿨을 때만
        여기 나타납니다. 예약·세션·수업권 hold는 감지만으로는 전혀 바뀌지 않습니다 — 아래에서
        관리자가 확인 처리해야만 확정됩니다. **UI 고도화 예정**: 지금은 이 목록 형태로만
        제공하고, 선생님별 금주/주간/월간 통합 일정 캘린더 뷰는 후속 작업으로 남아 있습니다.
      </p>
      {externalChanges === null ? (
        <ListSkeleton />
      ) : externalChanges.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">
          감지된 외부 변경이 없습니다.
        </div>
      ) : (
        externalChanges.map((c) => (
          <div key={c.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">{c.teacherName ?? "(이름 없음)"} 선생님</div>
                <div className="text-[13px] text-grey-500 mt-0.5">ALTON 기준: {formatDateTime(c.startsAt)}</div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                {EXTERNAL_CHANGE_STATUS_LABEL[c.externalChangeStatus] ?? c.externalChangeStatus}
              </span>
            </div>
            {c.externalChangeDetail && (
              <div className="mt-2 text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
                Google 쪽 값: {JSON.stringify(c.externalChangeDetail)}
              </div>
            )}
            {resolvingReservationId !== c.reservationId ? (
              <div className="mt-3 flex justify-end">
                <button
                  disabled={loading || actionBusy}
                  onClick={() => {
                    setResolvingReservationId(c.reservationId);
                    setResolveReasonDraft("");
                  }}
                  className="text-[12px] font-bold text-ink disabled:opacity-50"
                >
                  확인 처리
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">처리 사유</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={resolveReasonDraft}
                  onChange={(e) => setResolveReasonDraft(e.target.value)}
                  placeholder="예: 선생님과 통화로 확인함"
                />
                {c.externalChangeStatus === "deleted" ? (
                  <p className="text-[11px] text-grey-500 mb-2">
                    Google 이벤트가 삭제됐습니다 — 예약·세션·수업권 hold는 자동으로 취소·재생성되지 않습니다.
                    아래 둘 중 하나를 반드시 선택하세요("무시"는 허용되지 않습니다): "ALTON 일정 유지"는 예약을
                    그대로 두고 Calendar 이벤트+Meet을 새로 만들고, "예약 취소"는 정식 취소 절차(수업권
                    release/30일 연장 포함)로 예약 자체를 정리합니다.
                  </p>
                ) : (
                  <p className="text-[11px] text-grey-500 mb-2">
                    "Google 시간 반영"은 가용성·버퍼·중복예약·수업권을 재검증한 뒤 ALTON DB를 Google 시간으로
                    맞춥니다. "ALTON 시간 유지"는 ALTON 시간은 그대로 두고 Google 이벤트만 되돌립니다. 두 처리
                    모두 감사 이력(`reservation_reschedules`)에 남습니다.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    disabled={loading || actionBusy}
                    onClick={() => setResolvingReservationId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    닫기
                  </button>
                  {c.externalChangeStatus === "deleted" ? (
                    <>
                      <button
                        disabled={loading || actionBusy}
                        onClick={() => handleResolveExternalChange(c.reservationId, "recreated_after_deletion")}
                        className="text-[12px] font-bold text-ink disabled:opacity-50"
                      >
                        ALTON 일정 유지(재생성)
                      </button>
                      <button
                        disabled={loading || actionBusy}
                        onClick={() => handleResolveExternalChange(c.reservationId, "confirmed_cancelled")}
                        className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        예약 취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={loading || actionBusy}
                        onClick={() => handleResolveExternalChange(c.reservationId, "dismissed")}
                        className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                      >
                        무시(오탐)
                      </button>
                      <button
                        disabled={loading || actionBusy}
                        onClick={() => handleResolveExternalChange(c.reservationId, "kept_alton_time")}
                        className="text-[12px] font-bold text-ink disabled:opacity-50"
                      >
                        ALTON 시간 유지
                      </button>
                      <button
                        disabled={loading || actionBusy}
                        onClick={() => handleResolveExternalChange(c.reservationId, "accepted_google_time")}
                        className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        Google 시간 반영
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">지각·노쇼 신고 (최근 100건)</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        학생·보호자·선생님이 제출한 신고 원문입니다. 이 신고 자체는 출석을 확정하지 않습니다 —
        최종 판정은 아래 "세션 최종판정" 섹션에서 관리자가 명확한 규칙 기반 함수로 직접 확정합니다.
      </p>
      {!incidentReports || incidentReports.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          제출된 신고가 없습니다.
        </div>
      ) : (
        incidentReports.map((r) => (
          <div key={r.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-ink">
                {r.studentName ?? "(학생 미확인)"} · {r.teacherName ?? "(선생님 미확인)"} 선생님
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                {INCIDENT_REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}
              </span>
            </div>
            <div className="text-[12px] text-grey-500 mt-1">
              {formatDateTime(r.reportedAt)} · 신고자: {r.reportedByName ?? "(알 수 없음)"}
              {r.minutesLate !== null ? ` · 지각 ${r.minutesLate}분` : ""}
            </div>
            {r.notes && <div className="mt-2 text-[12px] text-ink bg-grey-100 rounded-lg px-3 py-2">{r.notes}</div>}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">세션 최종판정 (예약 시간 경과, 미확정)</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        선생님이 "수업 종료"를 누르지 않았거나 관리자가 직접 확정해야 하는 건입니다. 완료/학생 노쇼/선생님
        노쇼 중 하나로 확정하면 수업권 소진·해제와 정산 항목(payable_minutes)이 같은 트랜잭션으로 반영됩니다.
      </p>
      {judgmentRows === null ? (
        <ListSkeleton />
      ) : judgmentRows.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">판정 대기 중인 세션이 없습니다.</div>
      ) : (
        judgmentRows.map((s) => (
          <div key={s.sessionId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-ink">
                {s.studentName ?? "(학생 미확인)"} · {s.teacherName ?? "(선생님 미확인)"} · {s.subjectName ?? ""}
                {s.isTrial ? " (체험)" : ""}
              </div>
              {s.incidentReportCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                  신고 {s.incidentReportCount}건
                </span>
              )}
            </div>
            <div className="text-[12px] text-grey-500 mt-1">
              {formatDateTime(s.startsAt)} ~ {formatDateTime(s.endsAt)} · 현재 상태: {s.finalStatus}
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <button
                disabled={judgmentBusyId === s.sessionId}
                onClick={() => handleFinalizeJudgment(s.sessionId, "completed")}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink text-white disabled:opacity-50"
              >
                완료로 확정
              </button>
              <button
                disabled={judgmentBusyId === s.sessionId}
                onClick={() => handleFinalizeJudgment(s.sessionId, "student_no_show")}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red/10 text-red disabled:opacity-50"
              >
                학생 노쇼로 확정(소진+지급)
              </button>
              <button
                disabled={judgmentBusyId === s.sessionId}
                onClick={() => handleFinalizeJudgment(s.sessionId, "teacher_no_show")}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-ink disabled:opacity-50"
              >
                선생님 노쇼로 확정(해제, 지급 없음)
              </button>
              <button
                disabled={judgmentBusyId === s.sessionId}
                onClick={() => {
                  setInfraIncidentSessionId(s.sessionId === infraIncidentSessionId ? null : s.sessionId);
                  setInfraIncidentReasonDraft("");
                  setInfraIncidentMinutesDraft("0");
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red/5 text-red disabled:opacity-50"
              >
                회사·Meet 장애로 확정
              </button>
              <button
                disabled={judgmentBusyId === s.sessionId}
                onClick={() => {
                  setPartialInterruptionSessionId(s.sessionId === partialInterruptionSessionId ? null : s.sessionId);
                  setPartialInterruptionReasonDraft("");
                  setPartialInterruptionMinutesDraft("");
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red/5 text-red disabled:opacity-50"
              >
                선생님 사유 부분중단으로 확정
              </button>
            </div>
            {partialInterruptionSessionId === s.sessionId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <p className="text-[11.5px] text-grey-500 mb-2">
                  선생님 사유로 일부만 제공된 경우(예: 예정 120분 중 80분만 제공) — 수업권은 1장 소진되고,
                  실제 제공한 분만 지급됩니다. 미제공분은 보충시간(makeup_obligations)으로 자동 이관되고,
                  실제 제공 시간이 90분 미만이면 QC 경고도 함께 생성됩니다. 이미 지각 처리(당일 연장)가
                  적용된 세션에는 사용할 수 없습니다(중복 차감 방지).
                </p>
                <div className="flex gap-2 items-end mb-2">
                  <div>
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">실제 제공 분</label>
                    <input
                      type="number"
                      min={0}
                      className="w-24 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                      value={partialInterruptionMinutesDraft}
                      onChange={(e) => setPartialInterruptionMinutesDraft(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">사유</label>
                    <input
                      className="w-full border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                      value={partialInterruptionReasonDraft}
                      onChange={(e) => setPartialInterruptionReasonDraft(e.target.value)}
                      placeholder="예: 선생님 사정으로 80분만 진행 후 종료"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setPartialInterruptionSessionId(null)} className="text-[12px] font-semibold text-grey-500">
                    닫기
                  </button>
                  <button
                    disabled={judgmentBusyId === s.sessionId}
                    onClick={() => handleResolveTeacherPartialInterruption(s.sessionId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    확정
                  </button>
                </div>
              </div>
            )}
            {infraIncidentSessionId === s.sessionId && (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <p className="text-[11.5px] text-grey-500 mb-2">
                  자동 장애 감지는 없습니다 — 관리자가 직접 판단해 선택합니다. 제공 분을 0(또는 비움)으로
                  두면 "미시작"(수업권 hold 복원 + 예약 취소로 재예약 가능, 0분 정산)으로, 1분 이상 입력하면
                  "중단"(120분 상한 내 정산 + 못 제공한 분은 보충시간으로 자동 이관)으로 처리됩니다.
                </p>
                <div className="flex gap-2 items-end mb-2">
                  <div>
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">실제 제공 분(0=미시작)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-24 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                      value={infraIncidentMinutesDraft}
                      onChange={(e) => setInfraIncidentMinutesDraft(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">사유</label>
                    <input
                      className="w-full border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                      value={infraIncidentReasonDraft}
                      onChange={(e) => setInfraIncidentReasonDraft(e.target.value)}
                      placeholder="예: Google Meet 장애로 접속 불가"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setInfraIncidentSessionId(null)} className="text-[12px] font-semibold text-grey-500">
                    닫기
                  </button>
                  <button
                    disabled={judgmentBusyId === s.sessionId}
                    onClick={() => handleFinalizeInfraIncident(s.sessionId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    확정
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">최근 확정된 세션 — 재검토 (최근 50건)</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        잘못 확정된 세션은 재개방 후 올바른 상태로 재확정할 수 있습니다(기존 확정 기록은 지우지 않고
        이력으로 남습니다 — session_status_events에 append-only로 쌓입니다). payable_minutes/정산
        항목은 새 상태 기준으로 자동 재계산되지만, 수업권 소진/해제 자체가 바뀌어야 하는 경우(예:
        완료→선생님 노쇼)는 "수업권 원장" 탭의 조정 기능으로 별도 반영해야 합니다.
      </p>
      {finalizedRows === null ? (
        <ListSkeleton />
      ) : finalizedRows.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">확정된 세션이 없습니다.</div>
      ) : (
        finalizedRows.map((s) => (
          <div key={s.sessionId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-ink">
                {s.studentName ?? "(학생 미확인)"} · {s.teacherName ?? "(선생님 미확인)"} · {s.subjectName ?? ""}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">{s.finalStatus}</span>
            </div>
            <div className="text-[12px] text-grey-500 mt-1">{formatDateTime(s.startsAt)} ~ {formatDateTime(s.endsAt)}</div>
            {reopeningSessionId === s.sessionId ? (
              <div className="mt-2 border-t border-grey-200 pt-2">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">재개방 사유</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={reopenReasonDraft}
                  onChange={(e) => setReopenReasonDraft(e.target.value)}
                  placeholder="예: 선생님이 완료를 잘못 눌렀음, 실제로는 선생님 노쇼"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setReopeningSessionId(null)} className="text-[12px] font-semibold text-grey-500">
                    닫기
                  </button>
                  <button
                    disabled={judgmentBusyId === s.sessionId}
                    onClick={() => handleReopen(s.sessionId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    재개방
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReopeningSessionId(s.sessionId);
                  setReopenReasonDraft("");
                }}
                className="mt-2 text-[11px] font-bold text-red"
              >
                재개방(재판정 필요)
              </button>
            )}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">잔여 보충시간 (미이행 지각·장애분)</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        선생님 지각 당일 연장으로 다 못 채운 분, 회사·Meet 장애로 중단돼 못 제공한 분이 여기 쌓입니다. 학생의
        미래 정규 예약 ID를 입력해 그 예약 뒤에 이어붙이면 소비됩니다(새 예약 생성 없음, 수업권 추가 소진 없음).
      </p>
      {makeupObligations === null ? (
        <ListSkeleton />
      ) : makeupObligations.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">잔여 보충시간이 없습니다.</div>
      ) : (
        makeupObligations.map((o) => (
          <div key={o.obligationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-ink">
                {o.childName ?? "(학생 미확인)"} · {o.teacherName ?? "(선생님 미확인)"} 선생님
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                잔여 {o.remainingMinutes}분 / 발생 {o.owedMinutes}분
              </span>
            </div>
            <div className="text-[12px] text-grey-500 mt-1">
              사유: {o.reason === "teacher_late" ? "선생님 지각" : o.reason === "company_meet_interruption" ? "회사·Meet 장애 중단" : o.reason}{" "}
              · {formatDateTime(o.createdAt)}
            </div>
            <div className={`text-[12px] mt-0.5 ${new Date(o.expiresAt) <= new Date() ? "text-red font-bold" : "text-grey-500"}`}>
              {new Date(o.expiresAt) <= new Date()
                ? `만료됨(${formatDateTime(o.expiresAt)}) — 적용 불가, 필요하면 관리자가 새 보충시간을 등록하세요.`
                : `사용 기한: ${formatDateTime(o.expiresAt)}까지(생성 후 30일)`}
            </div>
            {applyingObligationId === o.obligationId ? (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <div className="flex gap-2 items-end mb-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">적용할 미래 예약 ID</label>
                    <input
                      autoFocus
                      className="w-full border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                      value={applyReservationIdDraft}
                      onChange={(e) => setApplyReservationIdDraft(e.target.value)}
                      placeholder="reservation UUID"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-grey-500 mb-1">적용 분</label>
                    <input
                      type="number"
                      min={1}
                      max={o.remainingMinutes}
                      className="w-20 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]"
                      value={applyMinutesDraft}
                      onChange={(e) => setApplyMinutesDraft(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setApplyingObligationId(null)} className="text-[12px] font-semibold text-grey-500">
                    닫기
                  </button>
                  <button
                    onClick={() => handleApplyMakeupTime(o.obligationId)}
                    className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5"
                  >
                    적용
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setApplyingObligationId(o.obligationId);
                  setApplyReservationIdDraft("");
                  setApplyMinutesDraft(String(o.remainingMinutes));
                }}
                className="mt-2 text-[11px] font-bold text-ink"
              >
                미래 예약에 적용
              </button>
            )}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">재판정 대사(reconciliation) 작업</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        세션을 재개방(reopen)→재확정(recomplete)하면 payable_minutes/정산 항목은 자동 재계산되지만
        수업권 소진·해제(entitlement_ledger)는 예약당 1건 제약상 자동으로 뒤집히지 않습니다. 아래는
        그 차이를 자동 계산한 필수 대사 작업 목록 — "반영"을 누르면 필요한 수업권 조정이 실제로
        적용됩니다(같은 작업은 한 번만 반영 가능). 이미 지급 완료(paid)된 정산 항목의 금액 자체는
        여기서 바뀌지 않고 역분개 대상으로 표시만 됩니다.
      </p>
      {reconciliationTasks === null ? (
        <ListSkeleton />
      ) : reconciliationTasks.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">대사 작업이 없습니다.</div>
      ) : (
        reconciliationTasks.map((t) => (
          <div key={t.taskId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-ink">
                {FINAL_STATUS_LABEL[t.priorFinalStatus] ?? t.priorFinalStatus} → {FINAL_STATUS_LABEL[t.newFinalStatus] ?? t.newFinalStatus}
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                  t.status === "resolved" || t.status === "superseded" ? "bg-grey-100 text-grey-500" : "bg-red/10 text-red"
                }`}
              >
                {t.status === "resolved"
                  ? "반영 완료"
                  : t.status === "superseded"
                    ? "대체됨(같은 세션 재판정)"
                    : t.status === "needs_review"
                      ? "재검토 필요(전제 변경됨)"
                      : "반영 필요"}
              </span>
            </div>
            <div className="text-[12px] text-grey-500 mt-1">
              정산 분: {t.priorPayableMinutes ?? "-"}분 → {t.newPayableMinutes ?? "-"}분 · {formatDateTime(t.createdAt)}
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              수업권 상태: 현재 {t.currentEntitlementDisposition ? ENTITLEMENT_DISPOSITION_LABEL[t.currentEntitlementDisposition] ?? t.currentEntitlementDisposition : "확인 불가"}
              {" → "}
              필요 {t.expectedEntitlementDisposition ? ENTITLEMENT_DISPOSITION_LABEL[t.expectedEntitlementDisposition] ?? t.expectedEntitlementDisposition : "관리자 확인 필요(학생 취소 시점 기준 판정 불가)"}
            </div>
            {t.requiredEntitlementAdjustmentAmount !== 0 && (
              <div className="text-[12px] font-bold text-red mt-0.5">
                필요 조정: {t.requiredEntitlementAdjustmentAmount > 0 ? "+" : ""}
                {t.requiredEntitlementAdjustmentAmount}장
              </div>
            )}
            {t.adminDispositionReason && (
              <div className="text-[11px] text-grey-500 mt-0.5">관리자 확인 사유: {t.adminDispositionReason}</div>
            )}
            {t.status === "pending" && t.expectedEntitlementDisposition === null ? (
              dispositionSelectTaskId === t.taskId ? (
                <div className="mt-2 border border-grey-200 rounded-lg p-3 bg-grey-100/50">
                  <div className="text-[11px] font-bold text-ink mb-1.5">
                    취소 기록이 없어 자동 판정이 불가능합니다 — 수업권 처리 방식을 직접 선택하세요.
                  </div>
                  <div className="flex gap-3 mb-2">
                    <label className="flex items-center gap-1 text-[12px]">
                      <input
                        type="radio"
                        checked={dispositionDraft === "consume"}
                        onChange={() => setDispositionDraft("consume")}
                      />
                      소진(consume)
                    </label>
                    <label className="flex items-center gap-1 text-[12px]">
                      <input
                        type="radio"
                        checked={dispositionDraft === "release"}
                        onChange={() => setDispositionDraft("release")}
                      />
                      해제(release)
                    </label>
                  </div>
                  <textarea
                    value={dispositionReasonDraft}
                    onChange={(e) => setDispositionReasonDraft(e.target.value)}
                    placeholder="사유(필수)"
                    className="w-full text-[12px] border border-grey-200 rounded-lg px-2 py-1.5 mb-2"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitStudentCancelledDisposition(t.taskId)}
                      disabled={submittingDispositionTaskId === t.taskId}
                      className="text-[11px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                    >
                      {submittingDispositionTaskId === t.taskId ? "저장 중…" : "확정"}
                    </button>
                    <button
                      onClick={() => {
                        setDispositionSelectTaskId(null);
                        setDispositionReasonDraft("");
                      }}
                      className="text-[11px] font-bold text-grey-500 px-3 py-1.5"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDispositionSelectTaskId(t.taskId);
                    setDispositionDraft("consume");
                    setDispositionReasonDraft("");
                  }}
                  className="mt-2 text-[11px] font-bold text-white bg-ink rounded-lg px-3 py-1.5"
                >
                  수업권 처리 방식 선택
                </button>
              )
            ) : (
              t.status === "pending" && (
                <button
                  onClick={() => handleResolveReconciliationTask(t.taskId)}
                  disabled={resolvingTaskId === t.taskId}
                  className="mt-2 text-[11px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {resolvingTaskId === t.taskId ? "반영 중…" : "반영"}
                </button>
              )
            )}
          </div>
        ))
      )}
    </div>
  );
}
